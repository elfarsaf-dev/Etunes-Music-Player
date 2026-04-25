import { useCallback } from "react";

import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import type { Track } from "@/lib/types";

/**
 * Wraps the player so downloaded tracks play from local storage instead of
 * streaming. Use this in screens whenever a user starts playback.
 */
export function usePlayResolved() {
  const player = usePlayer();
  const { resolveTrack } = useLibrary();

  const playQueue = useCallback(
    async (tracks: Track[], startIndex = 0) => {
      await player.playQueue(tracks.map(resolveTrack), startIndex);
    },
    [player, resolveTrack],
  );

  const playTrack = useCallback(
    async (track: Track) => {
      await player.playTrack(resolveTrack(track));
    },
    [player, resolveTrack],
  );

  return { playQueue, playTrack };
}
