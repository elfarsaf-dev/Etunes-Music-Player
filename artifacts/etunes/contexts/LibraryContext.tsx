import * as DocumentPicker from "expo-document-picker";
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

import { storage } from "@/lib/storage";
import type { Playlist, Track } from "@/lib/types";
import { makeId } from "@/lib/utils";

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

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [scanning, setScanning] = useState(false);
  const [permission, setPermission] =
    useState<MediaLibrary.PermissionStatus | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([
    makeFavoritesPlaylist(),
  ]);

  // Load playlists from storage
  useEffect(() => {
    (async () => {
      const saved = await storage.get<Playlist[]>(storage.keys.playlists);
      if (saved && saved.length > 0) {
        // Make sure favorites always exists at the top
        const hasFav = saved.some((p) => p.id === FAVORITES_ID);
        setPlaylists(hasFav ? saved : [makeFavoritesPlaylist(), ...saved]);
      }
    })();
  }, []);

  const persistPlaylists = useCallback(async (next: Playlist[]) => {
    setPlaylists(next);
    await storage.set(storage.keys.playlists, next);
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
      // Page through assets
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
        playlists.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
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
        p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p,
      );
      await persistPlaylists(next);
    },
    [playlists, persistPlaylists],
  );

  const getPlaylist = useCallback(
    (id: string) => playlists.find((p) => p.id === id),
    [playlists],
  );

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
