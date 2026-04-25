import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SongRow } from "@/components/SongRow";
import { useLibrary } from "@/contexts/LibraryContext";
import { useColors, useRadius } from "@/hooks/useColors";
import { usePlayResolved } from "@/hooks/usePlayResolved";

export default function PlaylistScreen() {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPlaylist, removeFromPlaylist, deletePlaylist } = useLibrary();
  const { playQueue } = usePlayResolved();
  const [shuffleMode, setShuffleMode] = useState(false);

  const playlist = getPlaylist(id);

  if (!playlist) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top + 60 },
        ]}
      >
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.notFound, { color: colors.foreground }]}>
          Playlist not found
        </Text>
      </View>
    );
  }

  const isFavorites = playlist.id === "favorites";
  const cover = playlist.tracks.find((t) => t.thumbnail)?.thumbnail;

  const handlePlay = (idx: number) => {
    playQueue(playlist.tracks, idx);
    router.push("/player");
  };

  const handlePlayAll = () => {
    if (playlist.tracks.length === 0) return;
    if (shuffleMode) {
      const order = [...playlist.tracks].sort(() => Math.random() - 0.5);
      playQueue(order, 0);
    } else {
      playQueue(playlist.tracks, 0);
    }
    router.push("/player");
  };

  const handleDelete = () => {
    if (isFavorites) return;
    Alert.alert("Delete playlist?", `"${playlist.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePlaylist(playlist.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "" }} />

      <FlatList
        data={playlist.tracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 200 }}
        ListHeaderComponent={
          <View>
            <View style={[styles.heroWrap, { paddingTop: insets.top + 36 }]}>
              <LinearGradient
                colors={
                  isFavorites
                    ? [colors.accent, colors.gradientStart, colors.background]
                    : [colors.gradientStart, colors.gradientEnd, colors.background]
                }
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  styles.cover,
                  {
                    borderRadius: radius,
                    shadowColor: "#000",
                  },
                ]}
              >
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={[styles.coverImg, { borderRadius: radius }]}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={
                      isFavorites
                        ? [colors.accent, colors.gradientStart]
                        : [colors.gradientStart, colors.gradientEnd]
                    }
                    style={[styles.coverImg, { borderRadius: radius }]}
                  >
                    <Feather
                      name={isFavorites ? "heart" : "music"}
                      size={56}
                      color="#fff"
                    />
                  </LinearGradient>
                )}
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {playlist.name}
              </Text>
              <Text style={styles.heroSub}>
                {playlist.tracks.length}{" "}
                {playlist.tracks.length === 1 ? "song" : "songs"}
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={handlePlayAll}
                disabled={playlist.tracks.length === 0}
                style={({ pressed }) => [
                  styles.playBtn,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: radius,
                    opacity:
                      pressed || playlist.tracks.length === 0 ? 0.7 : 1,
                  },
                ]}
              >
                <Feather
                  name="play"
                  size={18}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.playBtnText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Play
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShuffleMode((s) => !s)}
                style={({ pressed }) => [
                  styles.iconAction,
                  {
                    backgroundColor: colors.cardElevated,
                    borderRadius: radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather
                  name="shuffle"
                  size={20}
                  color={shuffleMode ? colors.primary : colors.foreground}
                />
              </Pressable>
              {!isFavorites ? (
                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => [
                    styles.iconAction,
                    {
                      backgroundColor: colors.cardElevated,
                      borderRadius: radius,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather
                    name="trash-2"
                    size={20}
                    color={colors.destructive}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <SongRow
            track={item}
            index={index}
            onPress={() => handlePlay(index)}
            onMore={() =>
              Alert.alert(item.title, undefined, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove from playlist",
                  style: "destructive",
                  onPress: () => removeFromPlaylist(playlist.id, item.id),
                },
              ])
            }
            showIndex
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="music" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No songs yet. Add some from search or your library.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", flex: 1, gap: 10 },
  notFound: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  heroWrap: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 16,
  },
  cover: {
    width: 200,
    height: 200,
    overflow: "hidden",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  coverImg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  heroSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: -4,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: "center",
  },
  playBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
  },
  playBtnText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  iconAction: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", padding: 40, gap: 10 },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
