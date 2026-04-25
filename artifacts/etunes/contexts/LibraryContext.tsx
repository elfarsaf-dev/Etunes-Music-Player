import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import type { DownloadRecord, Playlist, Track } from "@/lib/types";
import { makeId } from "@/lib/utils";

type DownloadStatus = "idle" | "downloading" | "done" | "error";

type LibraryContextValue = {
  localTracks: Track[];
  scanning: boolean;
  permission: MediaLibrary.PermissionStatus | null;
  scanLocal: () => Promise<void>;
  pickFiles: () => Promise<Track[]>;

  playlists: Playlist[];
  favoritesPlaylistId: string;
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (track: Track) => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  addToPlaylist: (id: string, track: Track) => Promise<void>;
  removeFromPlaylist: (id: string, trackId: string) => Promise<void>;
  getPlaylist: (id: string) => Playlist | undefined;

  downloads: Record<string, DownloadRecord>;
  downloadStatus: Record<string, DownloadStatus>;
  isDownloaded: (trackId: string) => boolean;
  downloadTrack: (track: Track, apiKey: string | null) => Promise<void>;
  removeDownload: (trackId: string) => Promise<void>;
  resolveTrack: (track: Track) => Track;
  downloadedTracks: Track[];
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

const FAVORITES_ID = "favorites";

function makeFavoritesPlaylist(): Playlist {
  return {
    id: FAVORITES_ID,
    name: "Favorites",
    createdAt: Date.now(),
    tracks: [],
  };
}

function getDownloadsDir(): Directory | null {
  if (Platform.OS === "web") return null;
  try {
    const dir = new Directory(Paths.document, "downloads");
    if (!dir.exists) dir.create({ intermediates: true });
    return dir;
  } catch {
    return null;
  }
}

function safeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 80);
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [scanning, setScanning] = useState(false);
  const [permission, setPermission] =
    useState<MediaLibrary.PermissionStatus | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([
    makeFavoritesPlaylist(),
  ]);
  const [downloads, setDownloads] = useState<Record<string, DownloadRecord>>(
    {},
  );
  const [downloadedMeta, setDownloadedMeta] = useState<Record<string, Track>>(
    {},
  );
  const [downloadStatus, setDownloadStatus] = useState<
    Record<string, DownloadStatus>
  >({});

  // Load playlists + downloads from storage
  useEffect(() => {
    (async () => {
      const saved = await storage.get<Playlist[]>(storage.keys.playlists);
      if (saved && saved.length > 0) {
        const hasFav = saved.some((p) => p.id === FAVORITES_ID);
        setPlaylists(hasFav ? saved : [makeFavoritesPlaylist(), ...saved]);
      }
      const dl =
        (await storage.get<Record<string, DownloadRecord>>(
          storage.keys.downloads,
        )) ?? {};
      setDownloads(dl);
      const meta =
        (await storage.get<Record<string, Track>>(
          `${storage.keys.downloads}/meta`,
        )) ?? {};
      setDownloadedMeta(meta);
    })();
  }, []);

  const persistPlaylists = useCallback(async (next: Playlist[]) => {
    setPlaylists(next);
    await storage.set(storage.keys.playlists, next);
  }, []);

  const persistDownloads = useCallback(
    async (next: Record<string, DownloadRecord>) => {
      setDownloads(next);
      await storage.set(storage.keys.downloads, next);
    },
    [],
  );

  const persistDownloadedMeta = useCallback(
    async (next: Record<string, Track>) => {
      setDownloadedMeta(next);
      await storage.set(`${storage.keys.downloads}/meta`, next);
    },
    [],
  );

  const scanLocal = useCallback(async () => {
    if (Platform.OS === "web") {
      setLocalTracks([]);
      return;
    }
    setScanning(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      setPermission(perm.status);
      if (perm.status !== "granted") {
        setScanning(false);
        return;
      }
      const all: Track[] = [];
      let after: string | undefined;
      for (let i = 0; i < 5; i++) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.audio,
          first: 200,
          after,
          sortBy: [MediaLibrary.SortBy.creationTime],
        });
        for (const a of page.assets) {
          all.push({
            id: `local:${a.id}`,
            title: a.filename.replace(/\.[^/.]+$/, ""),
            artist: "Local file",
            duration: a.duration,
            source: "local",
            uri: a.uri,
          });
        }
        if (!page.hasNextPage) break;
        after = page.endCursor;
      }
      setLocalTracks(all);
    } finally {
      setScanning(false);
    }
  }, []);

  const pickFiles = useCallback(async (): Promise<Track[]> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return [];
    const newTracks: Track[] = result.assets.map((a) => ({
      id: `local:${a.uri}`,
      title: (a.name ?? "Track").replace(/\.[^/.]+$/, ""),
      artist: "Local file",
      source: "local",
      uri: a.uri,
    }));
    setLocalTracks((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      return [...newTracks.filter((t) => !ids.has(t.id)), ...prev];
    });
    return newTracks;
  }, []);

  const isFavorite = useCallback(
    (trackId: string) => {
      const fav = playlists.find((p) => p.id === FAVORITES_ID);
      return !!fav?.tracks.some((t) => t.id === trackId);
    },
    [playlists],
  );

  const toggleFavorite = useCallback(
    async (track: Track) => {
      const next = playlists.map((p) => {
        if (p.id !== FAVORITES_ID) return p;
        const has = p.tracks.some((t) => t.id === track.id);
        return {
          ...p,
          tracks: has
            ? p.tracks.filter((t) => t.id !== track.id)
            : [track, ...p.tracks],
        };
      });
      await persistPlaylists(next);
    },
    [playlists, persistPlaylists],
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      const playlist: Playlist = {
        id: makeId(),
        name: name.trim() || "New Playlist",
        createdAt: Date.now(),
        tracks: [],
      };
      await persistPlaylists([...playlists, playlist]);
      return playlist;
    },
    [playlists, persistPlaylists],
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      if (id === FAVORITES_ID) return;
      await persistPlaylists(playlists.filter((p) => p.id !== id));
    },
    [playlists, persistPlaylists],
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      await persistPlaylists(
        playlists.map((p) =>
          p.id === id ? { ...p, name: name.trim() || p.name } : p,
        ),
      );
    },
    [playlists, persistPlaylists],
  );

  const addToPlaylist = useCallback(
    async (id: string, track: Track) => {
      const next = playlists.map((p) => {
        if (p.id !== id) return p;
        if (p.tracks.some((t) => t.id === track.id)) return p;
        return { ...p, tracks: [track, ...p.tracks] };
      });
      await persistPlaylists(next);
    },
    [playlists, persistPlaylists],
  );

  const removeFromPlaylist = useCallback(
    async (id: string, trackId: string) => {
      const next = playlists.map((p) =>
        p.id === id
          ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
          : p,
      );
      await persistPlaylists(next);
    },
    [playlists, persistPlaylists],
  );

  const getPlaylist = useCallback(
    (id: string) => playlists.find((p) => p.id === id),
    [playlists],
  );

  const isDownloaded = useCallback(
    (trackId: string) => !!downloads[trackId],
    [downloads],
  );

  const downloadTrack = useCallback(
    async (track: Track, apiKey: string | null) => {
      if (Platform.OS === "web") {
        throw new Error("Downloads are only available on mobile");
      }
      if (track.source === "local") return;
      if (downloads[track.id]) return;
      if (!track.spotifyUrl) throw new Error("Track has no source URL");
      if (!apiKey) throw new Error("Sign in to download");

      setDownloadStatus((prev) => ({ ...prev, [track.id]: "downloading" }));
      try {
        const resolved = await api.resolveStream(apiKey, track.spotifyUrl);
        const dir = getDownloadsDir();
        if (!dir) throw new Error("Cannot access storage");

        const ext = (() => {
          const u = resolved.streamUrl.split("?")[0];
          const m = u.match(/\.([a-zA-Z0-9]{2,4})$/);
          return m ? `.${m[1]}` : ".mp3";
        })();
        const fileName = `${safeFileName(track.id)}${ext}`;
        const destination = new File(dir, fileName);
        if (destination.exists) destination.delete();

        const downloaded = await File.downloadFileAsync(
          resolved.streamUrl,
          destination,
        );

        const record: DownloadRecord = {
          trackId: track.id,
          uri: downloaded.uri,
          size: downloaded.size,
          downloadedAt: Date.now(),
        };
        const nextDl = { ...downloads, [track.id]: record };
        await persistDownloads(nextDl);

        const nextMeta = {
          ...downloadedMeta,
          [track.id]: { ...track, localUri: downloaded.uri },
        };
        await persistDownloadedMeta(nextMeta);

        setDownloadStatus((prev) => ({ ...prev, [track.id]: "done" }));
      } catch (err) {
        setDownloadStatus((prev) => ({ ...prev, [track.id]: "error" }));
        throw err;
      }
    },
    [downloads, downloadedMeta, persistDownloads, persistDownloadedMeta],
  );

  const removeDownload = useCallback(
    async (trackId: string) => {
      const record = downloads[trackId];
      if (!record) return;
      try {
        const file = new File(record.uri);
        if (file.exists) file.delete();
      } catch {
        // ignore filesystem errors
      }
      const nextDl = { ...downloads };
      delete nextDl[trackId];
      await persistDownloads(nextDl);
      const nextMeta = { ...downloadedMeta };
      delete nextMeta[trackId];
      await persistDownloadedMeta(nextMeta);
      setDownloadStatus((prev) => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
    },
    [downloads, downloadedMeta, persistDownloads, persistDownloadedMeta],
  );

  const resolveTrack = useCallback(
    (track: Track): Track => {
      const dl = downloads[track.id];
      if (dl) return { ...track, localUri: dl.uri };
      return track;
    },
    [downloads],
  );

  const downloadedTracks = useMemo<Track[]>(() => {
    return Object.values(downloads)
      .sort((a, b) => b.downloadedAt - a.downloadedAt)
      .map((rec) => {
        const meta = downloadedMeta[rec.trackId];
        if (meta) return { ...meta, localUri: rec.uri };
        return {
          id: rec.trackId,
          title: rec.trackId,
          artist: "Downloaded",
          source: "online" as const,
          localUri: rec.uri,
        };
      });
  }, [downloads, downloadedMeta]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      localTracks,
      scanning,
      permission,
      scanLocal,
      pickFiles,
      playlists,
      favoritesPlaylistId: FAVORITES_ID,
      isFavorite,
      toggleFavorite,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      getPlaylist,
      downloads,
      downloadStatus,
      isDownloaded,
      downloadTrack,
      removeDownload,
      resolveTrack,
      downloadedTracks,
    }),
    [
      localTracks,
      scanning,
      permission,
      scanLocal,
      pickFiles,
      playlists,
      isFavorite,
      toggleFavorite,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      getPlaylist,
      downloads,
      downloadStatus,
      isDownloaded,
      downloadTrack,
      removeDownload,
      resolveTrack,
      downloadedTracks,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
