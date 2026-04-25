import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
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
  requestMediaPermission: () => Promise<MediaLibrary.PermissionStatus>;
  scanLocal: () => Promise<void>;
  pickFiles: () => Promise<Track[]>;
  removeLocalTrack: (trackId: string) => Promise<void>;

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
const REMOVED_LOCAL_KEY = "@etunes/removed_local";

function makeFavoritesPlaylist(): Playlist {
  return {
    id: FAVORITES_ID,
    name: "Favorites",
    createdAt: Date.now(),
    tracks: [],
  };
}

async function tryEnsureDir(base: string | null): Promise<string | null> {
  if (!base) return null;
  const normalized = base.endsWith("/") ? base : `${base}/`;
  const dir = `${normalized}downloads/`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch {
    return null;
  }
}

async function getDownloadsDir(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  // Try document dir first (persistent), then cache dir as fallback.
  // Some Android variants restrict makeDirectoryAsync on document dir;
  // cacheDirectory is always writable for the app.
  return (
    (await tryEnsureDir(FileSystem.documentDirectory)) ??
    (await tryEnsureDir(FileSystem.cacheDirectory)) ??
    FileSystem.cacheDirectory ??
    FileSystem.documentDirectory
  );
}

function safeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 80);
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [scanning, setScanning] = useState(false);
  const [permission, setPermission] =
    useState<MediaLibrary.PermissionStatus | null>(null);
  const [removedLocalIds, setRemovedLocalIds] = useState<Set<string>>(
    new Set(),
  );

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

  // Load playlists, downloads, and removed list from storage
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
      const removed =
        (await storage.get<string[]>(REMOVED_LOCAL_KEY)) ?? [];
      setRemovedLocalIds(new Set(removed));
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

  const persistRemovedLocal = useCallback(async (next: Set<string>) => {
    setRemovedLocalIds(next);
    await storage.set(REMOVED_LOCAL_KEY, Array.from(next));
  }, []);

  const requestMediaPermission =
    useCallback(async (): Promise<MediaLibrary.PermissionStatus> => {
      if (Platform.OS === "web") {
        setPermission(MediaLibrary.PermissionStatus.UNDETERMINED);
        return MediaLibrary.PermissionStatus.UNDETERMINED;
      }
      const perm = await MediaLibrary.requestPermissionsAsync();
      setPermission(perm.status);
      return perm.status;
    }, []);

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
          const id = `local:${a.id}`;
          if (removedLocalIds.has(id)) continue;
          all.push({
            id,
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
  }, [removedLocalIds]);

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
    // Un-hide if previously removed
    if (removedLocalIds.size > 0) {
      const next = new Set(removedLocalIds);
      let changed = false;
      for (const t of newTracks) {
        if (next.delete(t.id)) changed = true;
      }
      if (changed) await persistRemovedLocal(next);
    }
    setLocalTracks((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      return [...newTracks.filter((t) => !ids.has(t.id)), ...prev];
    });
    return newTracks;
  }, [removedLocalIds, persistRemovedLocal]);

  const removeLocalTrack = useCallback(
    async (trackId: string) => {
      // Hide from the in-memory list. We don't actually delete the file from
      // the user's device — that requires destructive permissions and is
      // surprising behavior. Instead persist a "hidden" set so re-scans
      // ignore it.
      setLocalTracks((prev) => prev.filter((t) => t.id !== trackId));
      const next = new Set(removedLocalIds);
      next.add(trackId);
      await persistRemovedLocal(next);
    },
    [removedLocalIds, persistRemovedLocal],
  );

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
        throw new Error("Download cuma bisa di aplikasi mobile.");
      }
      if (track.source === "local") return;
      if (downloads[track.id]) return;
      if (!track.spotifyUrl) {
        throw new Error("Lagu ini tidak punya sumber yang bisa diunduh.");
      }
      if (!apiKey) {
        throw new Error("Masuk dulu untuk download lagu.");
      }

      setDownloadStatus((prev) => ({ ...prev, [track.id]: "downloading" }));
      try {
        // Ask for media perm UPFRONT so download can land in public Music/etunes
        // folder (visible in File Manager and music apps).
        let mediaGranted = false;
        try {
          let perm = await MediaLibrary.getPermissionsAsync();
          if (perm.status !== "granted" && perm.canAskAgain) {
            perm = await MediaLibrary.requestPermissionsAsync();
            setPermission(perm.status);
          }
          mediaGranted = perm.status === "granted";
        } catch {
          mediaGranted = false;
        }

        // Resolve playable stream URL
        const resolved = await api.resolveStream(apiKey, track.spotifyUrl);

        // Pick a writable temp location. Prefer cache (always writable);
        // fall back to document dir.
        const stagingDir = await getDownloadsDir();
        if (!stagingDir) {
          throw new Error(
            "Perangkat tidak menyediakan folder yang bisa ditulis. Coba restart HP.",
          );
        }

        const ext = (() => {
          const u = resolved.streamUrl.split("?")[0];
          const m = u.match(/\.([a-zA-Z0-9]{2,4})$/);
          return m ? `.${m[1]}` : ".mp3";
        })();
        const fileName = `${safeFileName(track.id)}${ext}`;
        const stagingUri = `${stagingDir}${fileName}`;

        try {
          const existing = await FileSystem.getInfoAsync(stagingUri);
          if (existing.exists) {
            await FileSystem.deleteAsync(stagingUri, { idempotent: true });
          }
        } catch {
          // ignore — best effort cleanup before re-download
        }

        let downloadResult;
        try {
          downloadResult = await FileSystem.downloadAsync(
            resolved.streamUrl,
            stagingUri,
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`Gagal mendownload file: ${msg}`);
        }

        if (!downloadResult || downloadResult.status >= 400) {
          throw new Error(
            `Server lagu tidak merespon (status ${downloadResult?.status ?? "?"}). Coba lagi nanti.`,
          );
        }

        // Hand the file to MediaStore so it lands in the public
        // /storage/emulated/0/Music/etunes/ folder. Asset gets a stable
        // file:// URI we can play from later.
        let finalUri = downloadResult.uri;
        if (mediaGranted) {
          try {
            // createAssetAsync places the file in the default /Music folder.
            const asset = await MediaLibrary.createAssetAsync(
              downloadResult.uri,
            );
            let assetForPlayback: MediaLibrary.Asset = asset;

            try {
              const existingAlbum =
                await MediaLibrary.getAlbumAsync("etunes");
              if (existingAlbum) {
                // copy=false asks MediaLibrary to MOVE the asset into the
                // album. On Android scoped storage this often falls back to
                // a copy, leaving the original behind in /Music.
                await MediaLibrary.addAssetsToAlbumAsync(
                  [asset],
                  existingAlbum,
                  false,
                );
              } else {
                await MediaLibrary.createAlbumAsync("etunes", asset, false);
              }

              // Detect & clean up the duplicate that scoped storage leaves
              // behind in /Music. The album operation should leave us with
              // the asset inside /Music/etunes — if instead the original is
              // still in /Music, find the duplicate sitting in the etunes
              // album and delete the /Music original.
              try {
                const album = await MediaLibrary.getAlbumAsync("etunes");
                const info = await MediaLibrary.getAssetInfoAsync(asset);
                const currentUri =
                  info?.localUri ?? info?.uri ?? asset.uri ?? "";
                const inEtunesFolder = /\/etunes\//i.test(currentUri);

                if (album && !inEtunesFolder) {
                  // Look for the moved/copied twin inside the etunes album.
                  const page = await MediaLibrary.getAssetsAsync({
                    album,
                    mediaType: MediaLibrary.MediaType.audio,
                    first: 1000,
                    sortBy: [MediaLibrary.SortBy.creationTime],
                  });
                  const twin = page.assets.find(
                    (a) =>
                      a.id !== asset.id && a.filename === asset.filename,
                  );
                  if (twin) {
                    // Keep the twin (already inside /Music/etunes), drop
                    // the original from /Music.
                    try {
                      await MediaLibrary.deleteAssetsAsync([asset]);
                    } catch {
                      // best effort — if delete fails the user can clean
                      // up manually but at least we play the right one.
                    }
                    assetForPlayback = twin;
                  }
                }
              } catch {
                // best-effort dedupe; keep going either way
              }
            } catch {
              // Album ops are best-effort
            }

            // Prefer the public file path for playback when available
            try {
              const info =
                await MediaLibrary.getAssetInfoAsync(assetForPlayback);
              if (info?.localUri) {
                finalUri = info.localUri;
              } else if (assetForPlayback.uri) {
                finalUri = assetForPlayback.uri;
              }
            } catch {
              if (assetForPlayback.uri) finalUri = assetForPlayback.uri;
            }
          } catch {
            // MediaLibrary save failed — keep the staging copy
          }
        }

        const finalInfo = await FileSystem.getInfoAsync(finalUri).catch(
          () => null,
        );
        const fileSize =
          finalInfo && finalInfo.exists && "size" in finalInfo
            ? (finalInfo.size as number)
            : 0;

        const record: DownloadRecord = {
          trackId: track.id,
          uri: finalUri,
          size: fileSize,
          downloadedAt: Date.now(),
        };
        const nextDl = { ...downloads, [track.id]: record };
        await persistDownloads(nextDl);

        const nextMeta = {
          ...downloadedMeta,
          [track.id]: { ...track, localUri: finalUri },
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
        await FileSystem.deleteAsync(record.uri, { idempotent: true });
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
      requestMediaPermission,
      scanLocal,
      pickFiles,
      removeLocalTrack,
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
      requestMediaPermission,
      scanLocal,
      pickFiles,
      removeLocalTrack,
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
