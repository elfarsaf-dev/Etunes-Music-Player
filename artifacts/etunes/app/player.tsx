import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { AddToPlaylistSheet } from "@/components/AddToPlaylistSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors, useRadius } from "@/hooks/useColors";
import { formatTime } from "@/lib/utils";
import { Alert } from "react-native";

export default function PlayerScreen() {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    current,
    status,
    errorMessage,
    position,
    duration,
    repeat,
    shuffle,
    toggle,
    next,
    previous,
    seekTo,
    toggleRepeat,
    toggleShuffle,
  } = usePlayer();
  const { apiKey } = useAuth();
  const {
    isFavorite,
    toggleFavorite,
    isDownloaded,
    downloadStatus,
    downloadTrack,
    removeDownload,
  } = useLibrary();
  const [pickerOpen, setPickerOpen] = useState(false);

  const dlState = current ? downloadStatus[current.id] : undefined;
  const downloaded = current ? isDownloaded(current.id) : false;
  const downloading = dlState === "downloading";

  const handleDownload = async () => {
    if (!current) return;
    if (current.source === "local") return;
    if (downloaded) {
      Alert.alert("Remove download?", `"${current.title}" will be deleted from this device.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeDownload(current.id),
        },
      ]);
      return;
    }
    try {
      await downloadTrack(current, apiKey);
    } catch (e) {
      Alert.alert(
        "Download failed",
        e instanceof Error ? e.message : "Could not download",
      );
    }
  };

  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (status === "playing") {
      rotation.value = withRepeat(
        withTiming(360, { duration: 18000, easing: Easing.linear }),
        -1,
      );
    } else {
      rotation.value = withTiming(rotation.value, { duration: 0 });
    }
  }, [status, rotation]);

  const artStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!current) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="chevron-down" size={28} color={colors.foreground} />
        </Pressable>
        <View style={styles.emptyInner}>
          <Feather name="music" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Nothing playing
          </Text>
        </View>
      </View>
    );
  }

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  const handleSeek = (delta: number) => {
    seekTo(Math.max(0, Math.min(duration || position + delta, position + delta)));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.background]}
        locations={[0, 0.7]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="chevron-down" size={28} color="#fff" />
        </Pressable>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={styles.headerEyebrow}>Now playing</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {current.album ?? current.artist}
          </Text>
        </View>
        <Pressable
          onPress={() => setPickerOpen(true)}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="more-vertical" size={24} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.artContainer}>
        <Animated.View style={[styles.artWrap, artStyle]}>
          {current.thumbnail ? (
            <Image
              source={{ uri: current.thumbnail }}
              style={styles.art}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.art}
            >
              <Feather name="music" size={80} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
          )}
          <View style={[styles.artHole, { backgroundColor: colors.background }]} />
        </Animated.View>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {current.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {current.artist}
        </Text>
      </View>

      <View style={styles.progressWrap}>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: "rgba(255,255,255,0.18)" },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: "#fff" },
            ]}
          />
        </View>
        <View style={styles.progressTimes}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>
            {formatTime(duration || current.duration || 0)}
          </Text>
        </View>
      </View>

      {errorMessage ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {errorMessage}
        </Text>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          onPress={toggleShuffle}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather
            name="shuffle"
            size={22}
            color={shuffle ? colors.accent : "rgba(255,255,255,0.75)"}
          />
        </Pressable>
        <Pressable
          onPress={previous}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="skip-back" size={32} color="#fff" />
        </Pressable>
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.playBtn,
            { backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {status === "loading" ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Feather
              name={status === "playing" ? "pause" : "play"}
              size={32}
              color={colors.background}
              style={status === "playing" ? undefined : { marginLeft: 4 }}
            />
          )}
        </Pressable>
        <Pressable
          onPress={next}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather name="skip-forward" size={32} color="#fff" />
        </Pressable>
        <Pressable
          onPress={toggleRepeat}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Feather
            name={repeat === "one" ? "repeat" : "repeat"}
            size={22}
            color={repeat !== "off" ? colors.accent : "rgba(255,255,255,0.75)"}
          />
          {repeat === "one" ? (
            <View
              style={[styles.repeatDot, { backgroundColor: colors.accent }]}
            />
          ) : null}
        </Pressable>
      </View>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          onPress={() => handleSeek(-10)}
          style={({ pressed }) => [
            styles.bottomBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={6}
        >
          <Feather name="rewind" size={18} color="rgba(255,255,255,0.85)" />
          <Text style={styles.bottomLabel}>-10s</Text>
        </Pressable>
        <Pressable
          onPress={() => toggleFavorite(current)}
          style={({ pressed }) => [
            styles.bottomBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={6}
        >
          <Feather
            name="heart"
            size={20}
            color={isFavorite(current.id) ? colors.accent : "#fff"}
          />
          <Text style={styles.bottomLabel}>
            {isFavorite(current.id) ? "Favorited" : "Favorite"}
          </Text>
        </Pressable>
        {current.source === "online" ? (
          <Pressable
            onPress={handleDownload}
            disabled={downloading}
            style={({ pressed }) => [
              styles.bottomBtn,
              { opacity: pressed || downloading ? 0.6 : 1 },
            ]}
            hitSlop={6}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather
                name={downloaded ? "check-circle" : "download"}
                size={20}
                color={downloaded ? colors.success : "#fff"}
              />
            )}
            <Text style={styles.bottomLabel}>
              {downloading ? "..." : downloaded ? "Saved" : "Download"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            styles.bottomBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={6}
        >
          <Feather name="plus-circle" size={20} color="#fff" />
          <Text style={styles.bottomLabel}>Playlist</Text>
        </Pressable>
        <Pressable
          onPress={() => handleSeek(10)}
          style={({ pressed }) => [
            styles.bottomBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={6}
        >
          <Feather name="fast-forward" size={18} color="rgba(255,255,255,0.85)" />
          <Text style={styles.bottomLabel}>+10s</Text>
        </Pressable>
      </View>

      <AddToPlaylistSheet
        visible={pickerOpen}
        track={current}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const ART_SIZE = 280;

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, padding: 22 },
  closeBtn: { padding: 8 },
  emptyInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 12,
  },
  headerEyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  artContainer: { alignItems: "center", marginTop: 28 },
  artWrap: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 14,
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  artHole: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  info: { paddingHorizontal: 28, alignItems: "center", marginTop: 32, gap: 6 },
  title: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  artist: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  progressWrap: { paddingHorizontal: 28, marginTop: 22, gap: 6 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2 },
  progressTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  errorText: {
    paddingHorizontal: 28,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 8,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 36,
    marginTop: 28,
  },
  playBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatDot: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 22,
    marginTop: "auto",
    paddingTop: 24,
  },
  bottomBtn: { alignItems: "center", gap: 4, paddingVertical: 6, minWidth: 60 },
  bottomLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
