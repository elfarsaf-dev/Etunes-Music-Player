import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { ApiError, searchLyrics } from "@/lib/api";
import type { LyricsResult, Track } from "@/lib/types";

type Props = {
  track: Track;
  /** Current playback position in seconds. */
  position: number;
  /** Optional seek handler — taps on a synced line jump to that timestamp. */
  onSeek?: (seconds: number) => void;
};

const LYRICS_STALE_MS = 1000 * 60 * 60 * 24; // 24h

export function LyricsView({ track, position, onSeek }: Props) {
  const colors = useColors();
  const query = useMemo(() => buildQuery(track), [track]);

  const lyricsQuery = useQuery<LyricsResult | null, ApiError>({
    queryKey: ["lyrics", query],
    queryFn: () => searchLyrics(query),
    enabled: query.length > 0,
    staleTime: LYRICS_STALE_MS,
    retry: 0,
  });

  if (lyricsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          Cari lirik...
        </Text>
      </View>
    );
  }

  if (lyricsQuery.isError) {
    const msg =
      lyricsQuery.error instanceof Error
        ? lyricsQuery.error.message
        : "Gagal ambil lirik.";
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={20} color={colors.destructive} />
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {msg}
        </Text>
        <Pressable
          onPress={() => lyricsQuery.refetch()}
          style={({ pressed }) => [
            styles.retryBtn,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.retryText, { color: "#fff" }]}>Coba lagi</Text>
        </Pressable>
      </View>
    );
  }

  const lyrics = lyricsQuery.data;
  if (!lyrics) {
    return (
      <View style={styles.center}>
        <Feather name="file-text" size={20} color={colors.mutedForeground} />
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          Lirik gak ketemu untuk lagu ini.
        </Text>
      </View>
    );
  }

  if (lyrics.synced.length > 0) {
    return (
      <SyncedLyrics
        lines={lyrics.synced}
        position={position}
        onSeek={onSeek}
      />
    );
  }

  return <PlainLyrics lines={lyrics.plain} />;
}

function buildQuery(track: Track): string {
  return [track.title, track.artist]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function SyncedLyrics({
  lines,
  position,
  onSeek,
}: {
  lines: { time: number; text: string }[];
  position: number;
  onSeek?: (seconds: number) => void;
}) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const offsetsRef = useRef<number[]>([]);
  const viewportRef = useRef<number>(0);
  const lastScrolledRef = useRef<number>(-1);

  // Find the index of the active line: last line whose time <= position.
  const activeIndex = useMemo(() => {
    let lo = 0;
    let hi = lines.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].time <= position) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }, [lines, position]);

  // Auto-scroll active line into view (roughly centered).
  useEffect(() => {
    if (activeIndex < 0) return;
    if (activeIndex === lastScrolledRef.current) return;
    const offsets = offsetsRef.current;
    const y = offsets[activeIndex];
    if (typeof y !== "number") return;
    const viewportH = viewportRef.current || 320;
    const target = Math.max(0, y - viewportH / 2 + 24);
    scrollRef.current?.scrollTo({ y: target, animated: true });
    lastScrolledRef.current = activeIndex;
  }, [activeIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.syncedContent}
      onLayout={(e) => {
        viewportRef.current = e.nativeEvent.layout.height;
      }}
      showsVerticalScrollIndicator={false}
    >
      {lines.map((line, idx) => {
        const isActive = idx === activeIndex;
        const isPast = idx < activeIndex;
        const lineNode = (
          <Text
            style={[
              styles.lineText,
              {
                color: isActive
                  ? "#fff"
                  : isPast
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(255,255,255,0.7)",
                fontSize: isActive ? 20 : 17,
                fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
              },
            ]}
          >
            {line.text || " "}
          </Text>
        );
        return (
          <View
            key={`${line.time}-${idx}`}
            onLayout={(e) => {
              offsetsRef.current[idx] = e.nativeEvent.layout.y;
            }}
            style={styles.lineWrap}
          >
            {onSeek ? (
              <Pressable
                onPress={() => onSeek(Math.max(0, line.time - 0.05))}
                hitSlop={6}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                {lineNode}
              </Pressable>
            ) : (
              lineNode
            )}
          </View>
        );
      })}
      <View style={{ height: 80 }} />
      <View style={styles.attribution}>
        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
          Lirik via NexRay
        </Text>
      </View>
    </ScrollView>
  );
}

function PlainLyrics({ lines }: { lines: string[] }) {
  const colors = useColors();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.plainContent}
      showsVerticalScrollIndicator={false}
    >
      {lines.map((line, idx) => (
        <Text
          key={idx}
          style={[
            styles.lineText,
            {
              color: line ? "rgba(255,255,255,0.92)" : "transparent",
              fontSize: 17,
              fontFamily: "Inter_500Medium",
            },
          ]}
        >
          {line || " "}
        </Text>
      ))}
      <View style={{ height: 24 }} />
      <View style={styles.attribution}>
        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
          Lirik via NexRay
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  syncedContent: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 14,
  },
  plainContent: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 8,
  },
  lineWrap: {},
  lineText: {
    textAlign: "center",
    lineHeight: 26,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 28,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  attribution: {
    alignItems: "center",
    paddingTop: 12,
  },
});
