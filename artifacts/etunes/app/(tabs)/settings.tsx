import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors, useRadius } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, usage, apiKey, refresh, regenerate, signOut } = useAuth();
  const { stop } = usePlayer();
  const { downloads, downloadedTracks } = useLibrary();
  const { theme, themes, setThemeId } = useTheme();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!apiKey) return;
    await Clipboard.setStringAsync(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = () => {
    Alert.alert(
      "Regenerate API key?",
      "Your current key will stop working immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: () => regenerate().catch(() => {}),
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need your API key to sign back in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          stop();
          await signOut();
          router.replace("/auth");
        },
      },
    ]);
  };

  const usagePct =
    usage && usage.limit > 0
      ? Math.min(1, Math.max(0, usage.today / usage.limit))
      : 0;
  const remaining = usage ? Math.max(0, usage.limit - usage.today) : null;
  const maskedKey = apiKey
    ? showKey
      ? apiKey
      : `${apiKey.slice(0, 4)}${"•".repeat(Math.max(0, apiKey.length - 8))}${apiKey.slice(-4)}`
    : "";

  const totalDownloadBytes = Object.values(downloads).reduce(
    (sum, d) => sum + (d.size ?? 0),
    0,
  );
  const sizeMB = (totalDownloadBytes / 1024 / 1024).toFixed(1);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 220 }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Settings
          </Text>
        </View>

        <View
          style={[
            styles.profileCard,
            {
              borderRadius: radius * 1.4,
              borderColor: colors.border,
            },
          ]}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius * 1.4 }]}
          />
          <View style={styles.profileTop}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999 },
              ]}
            >
              <Feather name="user" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileLabel}>Account</Text>
              <Text style={styles.profileId} numberOfLines={1}>
                ID #{profile?.id ?? "—"}
              </Text>
            </View>
            <View
              style={[
                styles.tier,
                {
                  backgroundColor: profile?.is_premium
                    ? colors.warning
                    : "rgba(255,255,255,0.18)",
                },
              ]}
            >
              <Feather
                name={profile?.is_premium ? "star" : "zap"}
                size={12}
                color="#fff"
              />
              <Text style={styles.tierText}>
                {profile?.is_premium ? "Premium" : "Free"}
              </Text>
            </View>
          </View>

          {usage ? (
            <View style={styles.usageBlock}>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Today's streams</Text>
                <Text style={styles.usageValue}>
                  {usage.today} / {usage.limit}
                </Text>
              </View>
              <View style={styles.usageTrack}>
                <View
                  style={[styles.usageFill, { width: `${usagePct * 100}%` }]}
                />
              </View>
              <Text style={styles.usageHint}>
                {remaining === 0
                  ? "Daily limit reached. Resets at midnight UTC."
                  : `${remaining} streams left today.`}
              </Text>
            </View>
          ) : null}
        </View>

        <SectionHeader>Theme</SectionHeader>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.themeRow}
        >
          {themes.map((t) => {
            const active = t.id === theme.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setThemeId(t.id)}
                style={({ pressed }) => [
                  styles.themeCard,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: colors.cardElevated,
                    borderRadius: radius,
                    opacity: pressed ? 0.85 : 1,
                    borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <LinearGradient
                  colors={[t.swatch[0], t.swatch[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.themeSwatch, { borderRadius: radius - 4 }]}
                >
                  <View
                    style={[
                      styles.themeBgChip,
                      { backgroundColor: t.swatch[2] },
                    ]}
                  />
                </LinearGradient>
                <Text
                  style={[styles.themeName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {t.name}
                </Text>
                {active ? (
                  <View
                    style={[
                      styles.themeCheck,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={12}
                      color={colors.primaryForeground}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <SectionHeader>Downloads</SectionHeader>
        <View
          style={[
            styles.section,
            { backgroundColor: colors.cardElevated, borderRadius: radius },
          ]}
        >
          <View style={styles.row}>
            <Feather name="hard-drive" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                {downloadedTracks.length}{" "}
                {downloadedTracks.length === 1 ? "song" : "songs"} offline
              </Text>
              <Text
                style={[styles.rowMono, { color: colors.mutedForeground }]}
              >
                {sizeMB} MB on this device
              </Text>
            </View>
          </View>
        </View>

        <SectionHeader>API Key</SectionHeader>
        <View
          style={[
            styles.section,
            { backgroundColor: colors.cardElevated, borderRadius: radius },
          ]}
        >
          <Pressable
            style={styles.row}
            onPress={() => setShowKey((s) => !s)}
            android_ripple={{ color: colors.muted }}
          >
            <Feather name="key" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                Your key
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.rowMono, { color: colors.mutedForeground }]}
              >
                {maskedKey}
              </Text>
            </View>
            <Feather
              name={showKey ? "eye-off" : "eye"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.row}
            onPress={handleCopy}
            android_ripple={{ color: colors.muted }}
          >
            <Feather name="copy" size={20} color={colors.primary} />
            <Text
              style={[styles.rowTitle, { color: colors.foreground, flex: 1 }]}
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.row}
            onPress={handleRegenerate}
            android_ripple={{ color: colors.muted }}
          >
            <Feather name="refresh-cw" size={20} color={colors.warning} />
            <Text
              style={[styles.rowTitle, { color: colors.foreground, flex: 1 }]}
            >
              Regenerate key
            </Text>
          </Pressable>
        </View>

        <SectionHeader>Account</SectionHeader>
        <View
          style={[
            styles.section,
            { backgroundColor: colors.cardElevated, borderRadius: radius },
          ]}
        >
          <Pressable
            style={styles.row}
            onPress={refresh}
            android_ripple={{ color: colors.muted }}
          >
            <Feather name="rotate-cw" size={20} color={colors.primary} />
            <Text
              style={[styles.rowTitle, { color: colors.foreground, flex: 1 }]}
            >
              Refresh profile
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={styles.row}
            onPress={handleSignOut}
            android_ripple={{ color: colors.muted }}
          >
            <Feather name="log-out" size={20} color={colors.destructive} />
            <Text
              style={[styles.rowTitle, { color: colors.destructive, flex: 1 }]}
            >
              Sign out
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          etunes — made with ♪
        </Text>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 22, paddingVertical: 14 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  profileCard: {
    marginHorizontal: 16,
    padding: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  profileLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  profileId: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  tier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tierText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },
  usageBlock: { gap: 8 },
  usageRow: { flexDirection: "row", justifyContent: "space-between" },
  usageLabel: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  usageValue: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 },
  usageTrack: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 3,
    overflow: "hidden",
  },
  usageFill: { height: 6, backgroundColor: "#fff" },
  usageHint: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  sectionHeader: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: { marginHorizontal: 16, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowMono: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 32,
  },
  themeRow: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  themeCard: {
    width: 120,
    padding: 10,
    alignItems: "center",
  },
  themeSwatch: {
    width: 100,
    height: 70,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 8,
  },
  themeBgChip: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  themeName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  themeCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
