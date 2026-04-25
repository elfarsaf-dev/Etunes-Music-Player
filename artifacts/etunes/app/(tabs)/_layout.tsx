import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniPlayer } from "@/components/MiniPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, hydrated } = useAuth();
  const { current } = usePlayer();

  if (!hydrated) return null;
  if (!apiKey) return <Redirect href="/auth" />;

  const isWeb = Platform.OS === "web";
  const tabBarHeight = isWeb ? 84 : Platform.OS === "ios" ? 84 : 64;
  const miniPlayerOffset = current ? 64 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: isWeb ? 34 : Platform.OS === "ios" ? 28 : 8,
          },
          tabBarLabelStyle: {
            fontFamily: "Inter_500Medium",
            fontSize: 11,
          },
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: {
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 22,
          },
          headerShadowVisible: false,
          headerLargeTitle: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Discover",
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Feather
                name={focused ? "compass" : "compass"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <Feather name="hard-drive" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="playlists"
          options={{
            title: "Playlists",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <Feather name="list" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <Feather name="settings" size={22} color={color} />
            ),
          }}
        />
      </Tabs>
      <View
        pointerEvents="box-none"
        style={[
          styles.miniWrap,
          {
            bottom: tabBarHeight + (insets.bottom > 0 && !isWeb ? 0 : 0),
            paddingHorizontal: 8,
            opacity: current ? 1 : 0,
            height: miniPlayerOffset,
          },
        ]}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  miniWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
