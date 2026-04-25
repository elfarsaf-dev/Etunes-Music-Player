import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToPlaylistSheet } from "@/components/AddToPlaylistSheet";
import { SongRow } from "@/components/SongRow";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors, useRadius } from "@/hooks/useColors";
import type { Track } from "@/lib/types";

export default function LibraryScreen() {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { localTracks, scanLocal, scanning, permission, pickFiles } =
    useLibrary();
  const { playQueue } = usePlayer();
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" && localTracks.length === 0) {
      scanLocal();
    }
  }, [localTracks.length, scanLocal]);

  const handlePlay = (idx: number) => {
    playQueue(localTracks, idx);
    router.push("/player");
  };

  const handlePlayAll = () => {
    if (localTracks.length === 0) return;
    playQueue(localTracks, 0);
    router.push("/player");
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            My Library
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {localTracks.length} {localTracks.length === 1 ? "song" : "songs"} on
            this device
          </Text>
        </View>
        <Pressable
          onPress={pickFiles}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.cardElevated,
              borderRadius: radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="plus" size={20} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={scanLocal}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.cardElevated,
              borderRadius: radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="refresh-cw" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {localTracks.length > 0 ? (
        <Pressable
          onPress={handlePlayAll}
          style={({ pressed }) => [
            styles.playAll,
            {
              backgroundColor: colors.primary,
              borderRadius: radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="play" size={18} color={colors.primaryForeground} />
          <Text
            style={[styles.playAllText, { color: colors.primaryForeground }]}
          >
            Play all
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        data={localTracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 180 }}
        renderItem={({ item, index }) => (
          <SongRow
            track={item}
            index={index}
            onPress={() => handlePlay(index)}
            onMore={() => setPickerTrack(item)}
            showIndex
          />
        )}
        ListEmptyComponent={
          scanning ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                Scanning your music...
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.cardElevated, borderRadius: 999 },
                ]}
              >
                <Feather name="music" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {permission === "denied"
                  ? "Permission needed"
                  : "No local music yet"}
              </Text>
              <Text
                style={[styles.emptySub, { color: colors.mutedForeground }]}
              >
                {permission === "denied"
                  ? "Enable media access in your device settings, or pick files manually."
                  : "Add audio files from your device or grant access to scan your music library."}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={pickFiles}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: radius,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.primaryBtnText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Pick files
                  </Text>
                </Pressable>
                <Pressable
                  onPress={scanLocal}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    {
                      backgroundColor: colors.cardElevated,
                      borderRadius: radius,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.primaryBtnText, { color: colors.foreground }]}
                  >
                    Scan device
                  </Text>
                </Pressable>
              </View>
            </View>
          )
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 10,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  playAll: {
    marginHorizontal: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
  },
  playAllText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  center: { paddingTop: 40, alignItems: "center", gap: 10 },
  helper: { fontSize: 13, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 30, gap: 12 },
  emptyIcon: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  primaryBtn: { paddingHorizontal: 20, height: 44, alignItems: "center", justifyContent: "center" },
  secondaryBtn: { paddingHorizontal: 20, height: 44, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 13 },
});
