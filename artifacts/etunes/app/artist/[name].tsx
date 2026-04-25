import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToPlaylistSheet } from "@/components/AddToPlaylistSheet";
import { SongRow } from "@/components/SongRow";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { usePlayResolved } from "@/hooks/usePlayResolved";
import { api } from "@/lib/api";
import type { SearchResultRaw, Track } from "@/lib/types";
import { parseDurationStr, splitTitle } from "@/lib/utils";

function toTrack(r: SearchResultRaw): Track {
  const { artist, title } = r.artist
    ? { artist: r.artist, title: r.title }
    : splitTitle(r.title);
  return {
    id: `online:${r.url}`,
    title,
    artist,
    album: r.album,
    thumbnail: r.thumbnail,
    duration: parseDurationStr(r.duration),
    source: "online",
    spotifyUrl: r.url,
  };
}

export default function ArtistScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey } = useAuth();
  const { playQueue } = usePlayResolved();
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);

  const artistName = useMemo(
    () => decodeURIComponent(name ?? ""),
    [name],
  );

  const search = useQuery({
    queryKey: ["artist", artistName, apiKey],
    enabled: !!artistName && !!apiKey,
    queryFn: async () => (apiKey ? api.search(apiKey, artistName) : []),
  });

  const tracks = useMemo<Track[]>(() => {
    const all = (search.data ?? []).map(toTrack);
    const lower = artistName.toLowerCase();
    const matching = all.filter((t) =>
      t.artist?.toLowerCase().includes(lower),
    );
    return matching.length > 0 ? matching : all;
  }, [search.data, artistName]);

  const heroTrack = tracks[0];
  const avatar = heroTrack?.thumbnail;

  const handlePlay = (idx: number) => {
    playQueue(tracks, idx);
    router.push("/player");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 180 }}
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={[colors.gradientStart, colors.background]}
              locations={[0, 1]}
              style={[styles.hero, { paddingTop: insets.top + 12 }]}
            >
              <View style={styles.heroTopRow}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.backBtn,
                    {
                      backgroundColor: colors.overlaySoft,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="arrow-left" size={20} color={colors.foreground} />
                </Pressable>
              </View>

              <View style={styles.avatarWrap}>
                {avatar ? (
                  <Image
                    source={{ uri: avatar }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    style={styles.avatar}
                  >
                    <Feather name="user" size={56} color="#fff" />
                  </LinearGradient>
                )}
              </View>

              <Text
                style={[styles.artistName, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {artistName}
              </Text>
              <Text
                style={[styles.subtitle, { color: colors.mutedForeground }]}
              >
                {search.isFetching
                  ? "Loading..."
                  : `${tracks.length} ${tracks.length === 1 ? "song" : "songs"}`}
              </Text>

              {tracks.length > 0 ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => handlePlay(0)}
                    style={({ pressed }) => [
                      styles.playBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather name="play" size={18} color={colors.primaryForeground} />
                    <Text
                      style={[
                        styles.playLabel,
                        { color: colors.primaryForeground },
                      ]}
                    >
                      Play
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                      playQueue(shuffled, 0);
                      router.push("/player");
                    }}
                    style={({ pressed }) => [
                      styles.shuffleBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.cardElevated,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather name="shuffle" size={16} color={colors.foreground} />
                    <Text
                      style={[styles.shuffleLabel, { color: colors.foreground }]}
                    >
                      Shuffle
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </LinearGradient>

            {search.isFetching && tracks.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <SongRow
            track={item}
            index={index}
            showIndex
            linkArtist={false}
            onPress={() => handlePlay(index)}
            onMore={() => setPickerTrack(item)}
          />
        )}
        ListEmptyComponent={
          !search.isFetching ? (
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground }}>
                No songs found
              </Text>
            </View>
          ) : null
        }
      />

      <AddToPlaylistSheet
        visible={!!pickerTrack}
        track={pickerTrack}
        onClose={() => setPickerTrack(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    alignItems: "center",
  },
  heroTopRow: {
    width: "100%",
    flexDirection: "row",
    marginBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    marginTop: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  artistName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginTop: 18,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  playLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  shuffleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shuffleLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
