import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { usePlayResolved } from "@/hooks/usePlayResolved";
import { useColors, useRadius } from "@/hooks/useColors";
import type { Track } from "@/lib/types";

type Tab = "local" | "downloads";

export default function LibraryScreen() {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    localTracks,
    downloadedTracks,
    scanLocal,
    scanning,
    permission,
    pickFiles,
    removeLocalTrack,
    removeDownload,
  } = useLibrary();
  const { playQueue } = usePlayResolved();

  const [tab, setTab] = useState<Tab>("local");
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);

  const tracks = useMemo<Track[]>(
    () => (tab === "local" ? localTracks : downloadedTracks),
    [tab, localTracks, downloadedTracks],
  );

  useEffect(() => {
    if (Platform.OS !== "web" && localTracks.length === 0) {
      scanLocal();
    }
  }, [localTracks.length, scanLocal]);

  const handlePlay = (idx: number) => {
    playQueue(tracks, idx);
    router.push("/player");
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    playQueue(tracks, 0);
    router.push("/player");
  };

  const openMenu = (track: Track) => {
    const isDownloadTab = tab === "downloads";
    Alert.alert(track.title, undefined, [
      {
        text: "Tambahkan ke playlist",
        onPress: () => setPickerTrack(track),
      },
      {
        text: isDownloadTab ? "Hapus download" : "Hapus dari Library",
        style: "destructive",
        onPress: () => {
          if (isDownloadTab) {
            removeDownload(track.id);
          } else {
            removeLocalTrack(track.id);
          }
        },
      },
      { text: "Batal", style: "cancel" },
    ]);
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
            Library
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {tab === "local"
              ? `${localTracks.length} ${localTracks.length === 1 ? "lagu" : "lagu"} di perangkat`
              : `${downloadedTracks.length} lagu yang sudah didownload`}
          </Text>
        </View>
        {tab === "local" ? (
          <>
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
          </>
        ) : null}
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setTab("local")}
          style={({ pressed }) => [
            styles.tab,
            {
              backgroundColor:
                tab === "local" ? colors.primary : colors.cardElevated,
              borderRadius: radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name="hard-drive"
            size={14}
            color={tab === "local" ? colors.primaryForeground : colors.foreground}
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  tab === "local"
                    ? colors.primaryForeground
                    : colors.foreground,
              },
            ]}
          >
            Di perangkat
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("downloads")}
          style={({ pressed }) => [
            styles.tab,
            {
              backgroundColor:
                tab === "downloads" ? colors.primary : colors.cardElevated,
              borderRadius: radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name="download"
            size={14}
            color={
              tab === "downloads"
                ? colors.primaryForeground
                : colors.foreground
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  tab === "downloads"
                    ? colors.primaryForeground
                    : colors.foreground,
              },
            ]}
          >
            Download
          </Text>
          {downloadedTracks.length > 0 ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    tab === "downloads"
                      ? colors.primaryForeground + "33"
                      : colors.primary + "33",
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      tab === "downloads"
                        ? colors.primaryForeground
                        : colors.foreground,
                  },
                ]}
              >
                {downloadedTracks.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {tracks.length > 0 ? (
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
            Putar semua
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 180 }}
        renderItem={({ item, index }) => (
          <SongRow
            track={item}
            index={index}
            onPress={() => handlePlay(index)}
            onMore={() => openMenu(item)}
            showIndex
          />
        )}
        ListEmptyComponent={
          tab === "local" ? (
            scanning ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  Memindai musik...
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
                    ? "Izin diperlukan"
                    : "Belum ada musik lokal"}
                </Text>
                <Text
                  style={[styles.emptySub, { color: colors.mutedForeground }]}
                >
                  {permission === "denied"
                    ? "Aktifkan akses media di pengaturan perangkat, atau pilih file manual."
                    : "Tambahkan file audio dari perangkat atau berikan izin agar kami bisa memindai musikmu."}
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
                      Pilih file
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
                      style={[
                        styles.primaryBtnText,
                        { color: colors.foreground },
                      ]}
                    >
                      Pindai
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          ) : (
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.cardElevated, borderRadius: 999 },
                ]}
              >
                <Feather name="download" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Belum ada download
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Tap ikon download di player untuk menyimpan lagu offline.
              </Text>
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
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 22,
    gap: 10,
    marginBottom: 12,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    marginLeft: 4,
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
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
