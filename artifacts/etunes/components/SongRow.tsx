import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors, useRadius } from "@/hooks/useColors";
import type { Track } from "@/lib/types";
import { formatTime } from "@/lib/utils";

type Props = {
  track: Track;
  index?: number;
  onPress: () => void;
  onMore?: () => void;
  showIndex?: boolean;
  rightSlot?: React.ReactNode;
  /** Make the artist name tappable to open the artist screen. */
  linkArtist?: boolean;
};

export function SongRow({
  track,
  index,
  onPress,
  onMore,
  showIndex,
  rightSlot,
  linkArtist = true,
}: Props) {
  const colors = useColors();
  const radius = useRadius();
  const { current, status } = usePlayer();
  const { isDownloaded } = useLibrary();
  const isActive = current?.id === track.id;
  const downloaded = isDownloaded(track.id) || !!track.localUri;

  const openArtist = () => {
    if (!track.artist || track.artist === "Local file") return;
    router.push(`/artist/${encodeURIComponent(track.artist)}`);
  };

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.muted : "transparent" },
      ]}
    >
      <View style={styles.left}>
        {showIndex && index !== undefined ? (
          <View style={styles.indexWrap}>
            {isActive ? (
              <Feather name="bar-chart-2" size={16} color={colors.primary} />
            ) : (
              <Text style={[styles.index, { color: colors.mutedForeground }]}>
                {index + 1}
              </Text>
            )}
          </View>
        ) : null}
        {track.thumbnail ? (
          <Image
            source={{ uri: track.thumbnail }}
            style={[styles.art, { borderRadius: radius - 4 }]}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={[styles.art, { borderRadius: radius - 4 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Feather
              name={track.source === "local" ? "music" : "headphones"}
              size={20}
              color="#fff"
            />
          </LinearGradient>
        )}
      </View>

      <View style={styles.center}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: isActive ? colors.primary : colors.foreground,
              fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium",
            },
          ]}
        >
          {track.title}
        </Text>
        <View style={styles.metaRow}>
          {track.source === "local" ? (
            <Feather name="hard-drive" size={11} color={colors.mutedForeground} />
          ) : null}
          {downloaded ? (
            <Feather name="arrow-down-circle" size={11} color={colors.success} />
          ) : null}
          {linkArtist && track.source === "online" ? (
            <Pressable onPress={openArtist} hitSlop={6} style={{ flexShrink: 1 }}>
              <Text
                numberOfLines={1}
                style={[
                  styles.artist,
                  styles.artistLink,
                  { color: colors.mutedForeground },
                ]}
              >
                {track.artist}
                {track.album ? ` • ${track.album}` : ""}
              </Text>
            </Pressable>
          ) : (
            <Text
              numberOfLines={1}
              style={[styles.artist, { color: colors.mutedForeground }]}
            >
              {track.artist}
              {track.album ? ` • ${track.album}` : ""}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
        {track.duration ? (
          <Text style={[styles.duration, { color: colors.mutedForeground }]}>
            {formatTime(track.duration)}
          </Text>
        ) : null}
        {rightSlot}
        {onMore ? (
          <Pressable
            onPress={onMore}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather
              name="more-vertical"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
        {isActive && status === "playing" ? (
          <View style={[styles.playingDot, { backgroundColor: colors.primary }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  indexWrap: { width: 22, alignItems: "center" },
  index: { fontSize: 13, fontFamily: "Inter_500Medium" },
  art: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  artist: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  artistLink: { textDecorationLine: "none" },
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  duration: { fontSize: 12, fontFamily: "Inter_500Medium" },
  playingDot: { width: 6, height: 6, borderRadius: 3 },
});
