import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLibrary } from "@/contexts/LibraryContext";
import { useColors, useRadius } from "@/hooks/useColors";
import type { Playlist } from "@/lib/types";

export default function PlaylistsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { playlists, createPlaylist } = useLibrary();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createPlaylist(name);
    setName("");
    setShowCreate(false);
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
            Playlists
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 180, paddingHorizontal: 16, gap: 10 }}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <PlaylistCard
            playlist={item}
            onPress={() => router.push(`/playlist/${item.id}`)}
          />
        )}
      />

      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCreate(false)}
        />
        <View style={styles.modalCenter}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.cardElevated,
                borderRadius: radius * 1.4,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              New playlist
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="My playlist"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderRadius: radius,
                },
              ]}
              autoFocus
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCreate(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.muted,
                    borderRadius: radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.foreground }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Create
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PlaylistCard({
  playlist,
  onPress,
}: {
  playlist: Playlist;
  onPress: () => void;
}) {
  const colors = useColors();
  const radius = useRadius();
  const isFavorites = playlist.id === "favorites";
  const cover = playlist.tracks.find((t) => t.thumbnail)?.thumbnail;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.cardElevated,
          borderRadius: radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[styles.cover, { borderRadius: radius - 4 }]}
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={[styles.coverImg, { borderRadius: radius - 4 }]}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={
              isFavorites
                ? [colors.accent, colors.gradientStart]
                : [colors.gradientStart, colors.gradientEnd]
            }
            style={[styles.coverImg, { borderRadius: radius - 4 }]}
          >
            <Feather
              name={isFavorites ? "heart" : "music"}
              size={32}
              color="#fff"
            />
          </LinearGradient>
        )}
      </View>
      <Text
        style={[styles.cardTitle, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {playlist.name}
      </Text>
      <Text
        style={[styles.cardSub, { color: colors.mutedForeground }]}
        numberOfLines={1}
      >
        {playlist.tracks.length}{" "}
        {playlist.tracks.length === 1 ? "song" : "songs"}
      </Text>
    </Pressable>
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
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { flex: 1, padding: 10, gap: 6, marginBottom: 6 },
  cover: { aspectRatio: 1, overflow: "hidden" },
  coverImg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    padding: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalInput: {
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
