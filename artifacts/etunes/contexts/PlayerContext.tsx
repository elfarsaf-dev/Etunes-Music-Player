import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import type { Track } from "@/lib/types";

import { useAuth } from "./AuthContext";

type RepeatMode = "off" | "one" | "all";

type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

type PlayerContextValue = {
  current: Track | null;
  queue: Track[];
  queueIndex: number;
  status: PlayerStatus;
  errorMessage: string | null;
  position: number;
  duration: number;
  repeat: RepeatMode;
  shuffle: boolean;
  playQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  playTrack: (track: Track) => Promise<void>;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (sec: number) => Promise<void>;
  setRepeat: (mode: RepeatMode) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  stop: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const RECENT_LIMIT = 30;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { apiKey } = useAuth();
  const playerRef = useRef<AudioPlayer | null>(null);

  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeatState] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);

  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const currentRef = useRef(current);
  const apiKeyRef = useRef(apiKey);
  const advancingRef = useRef(false);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  // Configure audio session for background playback + lock-screen controls
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {
      // ignore
    });
  }, []);

  // Persist last queue + recents
  const pushRecent = useCallback(async (track: Track) => {
    const recents = (await storage.get<Track[]>(storage.keys.recent)) ?? [];
    const next = [track, ...recents.filter((t) => t.id !== track.id)].slice(
      0,
      RECENT_LIMIT,
    );
    await storage.set(storage.keys.recent, next);
  }, []);

  const updateLockScreen = useCallback((track: Track) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.setActiveForLockScreen(true, {
        title: track.title,
        artist: track.artist,
        albumTitle: track.album,
        artworkUrl: track.thumbnail,
      });
    } catch {
      // ignore — not all platforms support
    }
  }, []);

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) {
      const p = createAudioPlayer(null, { updateInterval: 500 });
      playerRef.current = p;
      p.addListener("playbackStatusUpdate", (s) => {
        setPosition(s.currentTime ?? 0);
        if (s.duration && Number.isFinite(s.duration)) setDuration(s.duration);
        if (s.playing) setStatus("playing");
        else if (s.isLoaded && !s.playing && (s.currentTime ?? 0) > 0) {
          setStatus((prev) => (prev === "loading" ? prev : "paused"));
        }

        // Auto-advance: if playback finished, go next
        if (
          s.isLoaded &&
          s.duration > 0 &&
          (s.didJustFinish ||
            (!s.playing && s.currentTime >= s.duration - 0.25))
        ) {
          if (advancingRef.current) return;
          advancingRef.current = true;
          handleFinished().finally(() => {
            advancingRef.current = false;
          });
        }
      });
    }
    return playerRef.current;
  }, []);

  const loadAndPlay = useCallback(
    async (track: Track) => {
      const player = ensurePlayer();
      setCurrent(track);
      setStatus("loading");
      setErrorMessage(null);
      setPosition(0);
      setDuration(track.duration ?? 0);
      try {
        let uri = track.uri;
        if (track.source === "online") {
          if (!apiKeyRef.current) throw new Error("Sign in to stream songs");
          if (!track.spotifyUrl)
            throw new Error("Missing track URL");
          const resolved = await api.resolveStream(
            apiKeyRef.current,
            track.spotifyUrl,
          );
          uri = resolved.streamUrl;
        }
        if (!uri) throw new Error("No playable source");
        player.replace({ uri });
        player.play();
        updateLockScreen(track);
        await pushRecent(track);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Playback failed";
        setStatus("error");
        setErrorMessage(msg);
      }
    },
    [ensurePlayer, pushRecent, updateLockScreen],
  );

  const handleFinished = useCallback(async () => {
    const cur = currentRef.current;
    if (!cur) return;
    if (repeatRef.current === "one") {
      await loadAndPlay(cur);
      return;
    }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;

    let nextIdx: number;
    if (shuffleRef.current && q.length > 1) {
      let r = idx;
      while (r === idx) r = Math.floor(Math.random() * q.length);
      nextIdx = r;
    } else {
      nextIdx = idx + 1;
    }

    if (nextIdx >= q.length) {
      if (repeatRef.current === "all") {
        nextIdx = 0;
      } else {
        // stop at end
        playerRef.current?.pause();
        setStatus("paused");
        return;
      }
    }

    setQueueIndex(nextIdx);
    await loadAndPlay(q[nextIdx]);
  }, [loadAndPlay]);

  const playQueue = useCallback(
    async (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
      setQueue(tracks);
      setQueueIndex(idx);
      await loadAndPlay(tracks[idx]);
    },
    [loadAndPlay],
  );

  const playTrack = useCallback(
    async (track: Track) => {
      setQueue([track]);
      setQueueIndex(0);
      await loadAndPlay(track);
    },
    [loadAndPlay],
  );

  const pause = useCallback(() => {
    playerRef.current?.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    playerRef.current?.play();
    setStatus("playing");
  }, []);

  const toggle = useCallback(() => {
    if (status === "playing") pause();
    else if (current) resume();
  }, [status, current, pause, resume]);

  const next = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) return;
    let nextIdx = queueIndexRef.current + 1;
    if (shuffleRef.current && q.length > 1) {
      let r = queueIndexRef.current;
      while (r === queueIndexRef.current)
        r = Math.floor(Math.random() * q.length);
      nextIdx = r;
    }
    if (nextIdx >= q.length) nextIdx = repeatRef.current === "all" ? 0 : q.length - 1;
    setQueueIndex(nextIdx);
    await loadAndPlay(q[nextIdx]);
  }, [loadAndPlay]);

  const previous = useCallback(async () => {
    if (position > 3) {
      await playerRef.current?.seekTo(0);
      return;
    }
    const q = queueRef.current;
    if (q.length === 0) return;
    let prevIdx = queueIndexRef.current - 1;
    if (prevIdx < 0) prevIdx = repeatRef.current === "all" ? q.length - 1 : 0;
    setQueueIndex(prevIdx);
    await loadAndPlay(q[prevIdx]);
  }, [position, loadAndPlay]);

  const seekTo = useCallback(async (sec: number) => {
    await playerRef.current?.seekTo(sec);
    setPosition(sec);
  }, []);

  const setRepeat = useCallback((mode: RepeatMode) => setRepeatState(mode), []);

  const toggleRepeat = useCallback(() => {
    setRepeatState((prev) =>
      prev === "off" ? "all" : prev === "all" ? "one" : "off",
    );
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const stop = useCallback(() => {
    playerRef.current?.pause();
    try {
      playerRef.current?.clearLockScreenControls();
    } catch {
      // ignore
    }
    setStatus("idle");
    setCurrent(null);
    setQueue([]);
    setQueueIndex(0);
    setPosition(0);
    setDuration(0);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      try {
        playerRef.current?.remove();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      queueIndex,
      status,
      errorMessage,
      position,
      duration,
      repeat,
      shuffle,
      playQueue,
      playTrack,
      pause,
      resume,
      toggle,
      next,
      previous,
      seekTo,
      setRepeat,
      toggleRepeat,
      toggleShuffle,
      stop,
    }),
    [
      current,
      queue,
      queueIndex,
      status,
      errorMessage,
      position,
      duration,
      repeat,
      shuffle,
      playQueue,
      playTrack,
      pause,
      resume,
      toggle,
      next,
      previous,
      seekTo,
      setRepeat,
      toggleRepeat,
      toggleShuffle,
      stop,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
