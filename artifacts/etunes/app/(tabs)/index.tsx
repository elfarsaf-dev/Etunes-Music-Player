import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToPlaylistSheet } from "@/components/AddToPlaylistSheet";
import { SongRow } from "@/components/SongRow";
import { useAuth } from "@/contexts/AuthContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useColors, useRadius } from "@/hooks/useColors";
import { usePlayResolved } from "@/hooks/usePlayResolved";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
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

export default function HomeScreen() {
  const colors = useColors();
  const radius = useRadius();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { apiKey } = useAuth();
  const { current } = usePlayer();
  const { playQueue } = usePlayResolved();
  const { isFavorite, toggleFavorite } = useLibrary();

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [recents, setRecents] = useState<Track[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);

  useEffect(() => {
    (async () => {
      const r = (await storage.get<Track[]>(storage.keys.recent)) ?? [];
      const h = (await storage.get<string[]>(storage.keys.searchHistory)) ?? [];
      setRecents(r);
      setHistory(h);
    })();
  }, [current]);

  const search = useQuery({
    queryKey: ["search", submitted, apiKey],
    enabled: !!submitted && !!apiKey,
    queryFn: async () => {
      if (!apiKey) return [];
      return api.search(apiKey, submitted);
    },
  });

  const newReleases = useQuery({
    queryKey: ["section", "terbaru-2026", apiKey],
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 30,
    queryFn: async () =>
      apiKey ? api.search(apiKey, "terbaru 2026") : [],
  });

  const popular = useQuery({
    queryKey: ["section", "paling-populer", apiKey],
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 30,
    queryFn: async () =>
      apiKey ? api.search(apiKey, "paling populer") : [],
  });

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q) return;
    setSubmitted(q);
    const next = [q, ...history.filter((h) => h !== q)].slice(0, 8);
    setHistory(next);
    await storage.set(storage.keys.searchHistory, next);
  };

  const results = useMemo(() => (search.data ?? []).map(toTrack), [search.data]);
  const newReleaseTracks = useMemo(
    () => (newReleases.data ?? []).slice(0, 12).map(toTrack),
    [newReleases.data],
  );
  const popularTracks = useMemo(
    () => (popular.data ?? []).slice(0, 12).map(toTrack),
    [popular.data],
  );

  const handlePlayResult = (idx: number) => {
    playQueue(results, idx);
    router.push("/player");
  };

  const handlePlaySection = (tracks: Track[], idx: number) => {
    playQueue(tracks, idx);
    router.push("/player");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart + "40", colors.background]}
        locations={[0, 0.5]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.headerInner}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            Discover
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Search for any song, anywhere
          </Text>

          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.cardElevated,
                borderRadius: radius,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Songs, artists, albums..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
              onSubmitEditing={handleSubmit}
            />
            {query ? (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setSubmitted("");
                }}
                hitSlop={8}
              >
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={submitted ? results : []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 180 }}
        ListHeaderComponent={
          submitted ? (
            search.isFetching ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : search.error ? (
              <ErrorState
                message={
                  search.error instanceof Error
                    ? search.error.message
                    : "Search failed"
                }
              />
            ) : results.length === 0 ? (
              <EmptyState
                icon="search"
                title="No results"
                subtitle={`Nothing for "${submitted}"`}
              />
            ) : (
              <SectionHeader title={`Results for "${submitted}"`} />
            )
          ) : (
            <BrowseHome
              recents={recents}
              history={history}
              newReleases={newReleaseTracks}
              popular={popularTracks}
              loadingNew={newReleases.isFetching}
              loadingPopular={popular.isFetching}
              onSearch={(q) => {
                setQuery(q);
                setSubmitted(q);
              }}
              onPlayRecent={(t, idx) => handlePlaySection(recents, idx)}
              onPlaySection={handlePlaySection}
              onOpenArtist={(name) =>
                router.push(`/artist/${encodeURIComponent(name)}`)
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <SongRow
            track={item}
            onPress={() => handlePlayResult(index)}
            onMore={() => setPickerTrack(item)}
            rightSlot={
              <Pressable
                onPress={() => toggleFavorite(item)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Feather
                  name="heart"
                  size={18}
                  color={
                    isFavorite(item.id)
                      ? colors.accent
                      : colors.mutedForeground
                  }
                />
              </Pressable>
            }
          />
        )}
      />

      <AddToPlaylistSheet
        visible={!!pickerTrack}
        track={pickerTrack}
        onClose={() => setPickerTrack(null)}
      />
    </View>
  );
}

function BrowseHome({
  recents,
  history,
  newReleases,
  popular,
  loadingNew,
  loadingPopular,
  onSearch,
  onPlayRecent,
  onPlaySection,
  onOpenArtist,
}: {
  recents: Track[];
  history: string[];
  newReleases: Track[];
  popular: Track[];
  loadingNew: boolean;
  loadingPopular: boolean;
  onSearch: (q: string) => void;
  onPlayRecent: (track: Track, index: number) => void;
  onPlaySection: (tracks: Track[], index: number) => void;
  onOpenArtist: (name: string) => void;
}) {
  const colors = useColors();
  const radius = useRadius();

  const featuredArtists = useMemo(() => {
    const seen = new Set<string>();
    const list: { name: string; thumbnail?: string }[] = [];
    for (const t of [...popular, ...newReleases]) {
      if (!t.artist || t.artist === "Local file") continue;
      const key = t.artist.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ name: t.artist, thumbnail: t.thumbnail });
      if (list.length >= 10) break;
    }
    return list;
  }, [popular, newReleases]);

  return (
    <View style={{ paddingTop: 8 }}>
      {history.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Recent searches" />
          <View style={styles.chips}>
            {history.map((h) => (
              <Pressable
                key={h}
                onPress={() => onSearch(h)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: colors.cardElevated,
                    borderColor: colors.border,
                    borderRadius: 999,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text
                  style={[styles.chipText, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {h}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <CardCarousel
        title="New releases · 2026"
        subtitle="Lagu terbaru tahun ini"
        loading={loadingNew}
        tracks={newReleases}
        onPlay={(idx) => onPlaySection(newReleases, idx)}
      />

      {featuredArtists.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Top artists" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
          >
            {featuredArtists.map((a) => (
              <Pressable
                key={a.name}
                onPress={() => onOpenArtist(a.name)}
                style={({ pressed }) => [
                  styles.artistCard,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                {a.thumbnail ? (
                  <Image
                    source={{ uri: a.thumbnail }}
                    style={styles.artistAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    style={styles.artistAvatar}
                  >
                    <Feather name="user" size={28} color="#fff" />
                  </LinearGradient>
                )}
                <Text
                  style={[styles.artistName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <CardCarousel
        title="Most popular"
        subtitle="Yang lagi viral"
        loading={loadingPopular}
        tracks={popular}
        onPlay={(idx) => onPlaySection(popular, idx)}
      />

      {recents.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Recently played" />
          <FlatList
            data={recents.slice(0, 10)}
            horizontal
            keyExtractor={(t) => t.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => onPlayRecent(item, index)}
                style={({ pressed }) => [
                  styles.recentCard,
                  {
                    backgroundColor: colors.cardElevated,
                    borderRadius: radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {item.thumbnail ? (
                  <Image
                    source={{ uri: item.thumbnail }}
                    style={[styles.recentArt, { borderRadius: radius - 4 }]}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    style={[styles.recentArt, { borderRadius: radius - 4 }]}
                  >
                    <Feather name="music" size={28} color="#fff" />
                  </LinearGradient>
                )}
                <Text
                  style={[styles.recentTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.recentArtist,
                    { color: colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {item.artist}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {history.length === 0 &&
      recents.length === 0 &&
      newReleases.length === 0 &&
      popular.length === 0 &&
      !loadingNew &&
      !loadingPopular ? (
        <View style={{ paddingTop: 60 }}>
          <EmptyState
            icon="music"
            title="Start exploring"
            subtitle="Search for your favorite track to get started"
          />
        </View>
      ) : null}
    </View>
  );
}

function CardCarousel({
  title,
  subtitle,
  tracks,
  loading,
  onPlay,
}: {
  title: string;
  subtitle?: string;
  tracks: Track[];
  loading: boolean;
  onPlay: (idx: number) => void;
}) {
  const colors = useColors();
  const radius = useRadius();
  if (loading && tracks.length === 0) {
    return (
      <View style={styles.section}>
        <SectionHeader title={title} subtitle={subtitle} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }
  if (tracks.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} />
      <FlatList
        data={tracks}
        horizontal
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => onPlay(index)}
            style={({ pressed }) => [
              styles.bigCard,
              {
                backgroundColor: colors.cardElevated,
                borderRadius: radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                style={[styles.bigArt, { borderRadius: radius - 4 }]}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={[styles.bigArt, { borderRadius: radius - 4 }]}
              >
                <Feather name="music" size={32} color="#fff" />
              </LinearGradient>
            )}
            <Text
              style={[styles.bigTitle, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text
              style={[styles.bigArtist, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {item.artist}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4 }}>
      <Text style={[styles.sectionHeader, { color: colors.foreground }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[styles.sectionSub, { color: colors.mutedForeground }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.cardElevated, borderRadius: 999 },
        ]}
      >
        <Feather name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        {subtitle}
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.cardElevated, borderRadius: 999 },
        ]}
      >
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Couldn&apos;t search
      </Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerGradient: { paddingBottom: 16 },
  headerInner: { paddingHorizontal: 22, gap: 6, paddingTop: 12 },
  greeting: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 14 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  loadingWrap: { paddingTop: 60, alignItems: "center" },
  section: { paddingTop: 8, paddingBottom: 16, gap: 6 },
  sectionHeader: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 22,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  recentCard: { width: 140, padding: 10 },
  recentArt: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  recentTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  recentArtist: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  bigCard: { width: 160, padding: 10 },
  bigArt: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  bigTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 10 },
  bigArtist: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  artistCard: { alignItems: "center", width: 96 },
  artistAvatar: {
    width: 88,
    height: 88,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  artistName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
    textAlign: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
