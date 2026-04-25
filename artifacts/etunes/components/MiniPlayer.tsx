import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { usePlayer } from "@/contexts/PlayerContext";
import { useColors, useRadius } from "@/hooks/useColors";

export function MiniPlayer() {
  const colors = useColors();
  const radius = useRadius();
  const router = useRouter();
  const { current, status, toggle, next, position, duration } = usePlayer();

  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === "playing") {
      const loop = Animated.loop(
        Animated.timing(rotate, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status, rotate]);

  if (!current) return null;

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.cardElevated,
          borderRadius: radius,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.progressTrack,
          { backgroundColor: colors.border, borderTopLeftRadius: radius, borderTopRightRadius: radius },
        ]}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, borderTopLeftRadius: radius },
          ]}
        />
      </View>

      <Pressable
        onPress={() => router.push("/player")}
        style={styles.row}
        android_ripple={{ color: colors.muted }}
      >
        <Animated.View style={[styles.artWrap, { transform: [{ rotate: spin }] }]}>
          {current.thumbnail ? (
            <Image
              source={{ uri: current.thumbnail }}
              style={[styles.art, { borderRadius: 999 }]}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={[styles.art, { borderRadius: 999 }]}
            >
              <Feather name="music" size={18} color="#fff" />
            </LinearGradient>
          )}
          <View
            style={[
              styles.artCenter,
              { backgroundColor: colors.cardElevated },
            ]}
          />
        </Animated.View>

        <View style={styles.info}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {current.title}
          </Text>
          <Text
            style={[styles.artist, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {current.artist}
          </Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              toggle();
            }}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={8}
          >
            {status === "loading" ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Feather
                name={status === "playing" ? "pause" : "play"}
                size={22}
                color={colors.foreground}
              />
            )}
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              next();
            }}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={8}
          >
            <Feather name="skip-forward" size={22} color={colors.foreground} />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  progressTrack: {
    height: 2,
    width: "100%",
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 12,
  },
  artWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  artCenter: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  artist: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  controls: { flexDirection: "row", gap: 14, alignItems: "center" },
  iconBtn: { padding: 6 },
});
