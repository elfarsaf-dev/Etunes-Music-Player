import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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
import type { Track } from "@/lib/types";

type Props = {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
};

export function AddToPlaylistSheet({ visible, track, onClose }: Props) {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const { playlists, addToPlaylist, createPlaylist } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const handleAdd = async (id: string) => {
    if (!track) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    await addToPlaylist(id, track);
    onClose();
  };

  const handleCreate = async () => {
    if (!track) return;
    if (!name.trim()) return;
    const playlist = await createPlaylist(name);
    await addToPlaylist(playlist.id, track);
    setName("");
    setCreating(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.cardElevated,
            borderTopLeftRadius: radius * 1.6,
            borderTopRightRadius: radius * 1.6,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Add to playlist
          </Text>
          {!creating ? (
            <Pressable onPress={() => setCreating(true)} hitSlop={10}>
              <Feather name="plus" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {creating ? (
          <View style={styles.createRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Playlist name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
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
            <Pressable
              onPress={handleCreate}
              style={({ pressed }) => [
                styles.createBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.createBtnText,
                  { color: colors.primaryForeground },
                ]}
              >
                Create
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {playlists.map((p) => {
            const has = !!track && p.tracks.some((t) => t.id === track.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => handleAdd(p.id)}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed ? colors.muted : "transparent",
                    borderRadius: radius,
                  },
                ]}
              >
                <View
                  style={[
                    styles.itemIcon,
                    { backgroundColor: colors.muted, borderRadius: radius - 4 },
                  ]}
                >
                  <Feather
                    name={p.id === "favorites" ? "heart" : "list"}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.itemTitle, { color: colors.foreground }]}
                  >
                    {p.name}
                  </Text>
                  <Text
                    style={[
                      styles.itemSub,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {p.tracks.length} {p.tracks.length === 1 ? "song" : "songs"}
                  </Text>
                </View>
                {has ? (
                  <Feather name="check" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: "75%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  createRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  createBtn: {
    paddingHorizontal: 18,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: { fontFamily: "Inter_600SemiBold" },
  list: { gap: 4, paddingTop: 4 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
  },
  itemIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
