import { Feather } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import {
  FEATURED_ARTISTS,
  orderArtistsByRegion,
  type FeaturedArtist,
} from "@/lib/featuredArtists";
import { detectRegion } from "@/lib/region";
import { storage } from "@/lib/storage";
import type { ArtistRegion } from "@/lib/featuredArtists";
import type { SearchResultRaw, Track } from "@/lib/types";
import { parseDurationStr, splitTitle } from "@/lib/utils";

const ARTIST_PHOTO_CACHE_KEY = "@etunes/artist_photos";

const HOME_QUERIES = [
  "top 2026",
  "tiktok viral 2026",
  "jb",
  "billie eilish",
] as const;

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

/**
 * Round-robin interleave several arrays so the home feed feels organic
 * instead of "all of query A, then all of query B".
 */
function interleave<T>(...arrays: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(...arrays.map((a) => a.length), 0);
  for (let i = 0; i < max; i++) {
    for (const arr of arrays) {
      if (i < arr.length) out.push(arr[i]);
    }
  }
  return out;
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    const key = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
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
  const [region, setRegion] = useState<ArtistRegion | null>(null);

  useEffect(() => {
    (async () => {
      const r = (await storage.get<Track[]>(storage.keys.recent)) ?? [];
      const h = (await storage.get<string[]>(storage.keys.searchHistory)) ?? [];
      setRecents(r);
      setHistory(h);
    })();
  }, [current]);

  useEffect(() => {
    detectRegion().then(setRegion);
  }, []);

  const search = useQuery({
    queryKey: ["search", submitted, apiKey],
    enabled: !!submitted && !!apiKey,
    queryFn: async () => {
      if (!apiKey) return [];
      return api.search(apiKey, submitted);
    },
  });

  const homeFeeds = useQueries({
    queries: HOME_QUERIES.map((q) => ({
      queryKey: ["home", q, apiKey],
      enabled: !!apiKey,
      staleTime: 1000 * 60 * 30,
      queryFn: async () => (apiKey ? api.search(apiKey, q) : []),
    })),
  });

  const homeLoading = homeFeeds.some((q) => q.isLoading);

  const mixedTracks = useMemo<Track[]>(() => {
    const arrays = homeFeeds.map((q) =>
      (q.data ?? []).slice(0, 12).map(toTrack),
    );
    return dedupeTracks(interleave<Track>(...arrays)).slice(0, 36);
  }, [homeFeeds]);

  // Quick "fresh" carousel from the first query (top 2026)
  const topTracks = useMemo<Track[]>(
    () => (homeFeeds[0]?.data ?? []).slice(0, 12).map(toTrack),
    [homeFeeds],
  );
  // Viral carousel from the tiktok viral query
  const viralTracks = useMemo<Track[]>(
    () => (homeFeeds[1]?.data ?? []).slice(0, 12).map(toTrack),
    [homeFeeds],
  );

  const orderedArtists = useMemo<FeaturedArtist[]>(
    () => orderArtistsByRegion(FEATURED_ARTISTS, region),
    [region],
  );

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q) return;
    setSubmitted(q);
    const next = [q, ...history.filter((h) => h !== q)].slice(0, 8);
    setHistory(next);
    await storage.set(storage.keys.searchHistory, next);
  };

  const results = useMemo(() => (search.data ?? []).map(toTrack), [search.data]);

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
            {region === "Indonesia"
              ? "Dengarkan yang lagi hits di Indonesia"
              : "Search for any song, anywhere"}
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
              placeholder="Cari lagu, artis, album..."
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
        data={submitted ? results : mixedTracks}
        keyExtractor={(t, idx) => `${t.id}-${idx}`}
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
                    : "Pencarian gagal"
                }
              />
            ) : results.length === 0 ? (
              <EmptyState
                icon="search"
                title="Tidak ada hasil"
                subtitle={`Tidak ditemukan "${submitted}"`}
              />
            ) : (
              <SectionHeader title={`Hasil "${submitted}"`} />
            )
          ) : (
            <BrowseHome
              recents={recents}
              history={history}
              topTracks={topTracks}
              viralTracks={viralTracks}
              loadingTop={homeFeeds[0]?.isFetching ?? false}
              loadingViral={homeFeeds[1]?.isFetching ?? false}
              loadingArtists={homeLoading}
              region={region}
              orderedArtists={orderedArtists}
              apiKey={apiKey}
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
            onPress={() =>
              submitted
                ? handlePlayResult(index)
                : handlePlaySection(mixedTracks, index)
            }
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
        ListFooterComponent={
          !submitted && mixedTracks.length === 0 && homeLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
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

function BrowseHome({
  recents,
  history,
  topTracks,
  viralTracks,
  loadingTop,
  loadingViral,
  loadingArtists,
  region,
  orderedArtists,
  apiKey,
  onSearch,
  onPlayRecent,
  onPlaySection,
  onOpenArtist,
}: {
  recents: Track[];
  history: string[];
  topTracks: Track[];
  viralTracks: Track[];
  loadingTop: boolean;
  loadingViral: boolean;
  loadingArtists: boolean;
  region: ArtistRegion | null;
  orderedArtists: FeaturedArtist[];
  apiKey: string | null;
  onSearch: (q: string) => void;
  onPlayRecent: (track: Track, index: number) => void;
  onPlaySection: (tracks: Track[], index: number) => void;
  onOpenArtist: (name: string) => void;
}) {
  const colors = useColors();
  const radius = useRadius();

  return (
    <View style={{ paddingTop: 8 }}>
      {history.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Pencarian terakhir" />
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

      <ArtistsRow
        artists={orderedArtists}
        loading={loadingArtists}
        region={region}
        apiKey={apiKey}
        onOpenArtist={onOpenArtist}
      />

      <CardCarousel
        title="Top 2026"
        subtitle="Yang lagi paling didengerin"
        loading={loadingTop}
        tracks={topTracks}
        onPlay={(idx) => onPlaySection(topTracks, idx)}
      />

      <CardCarousel
        title="TikTok Viral"
        subtitle="Lagu viral 2026"
        loading={loadingViral}
        tracks={viralTracks}
        onPlay={(idx) => onPlaySection(viralTracks, idx)}
      />

      {recents.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Baru diputar" />
          <FlatList
            data={recents.slice(0, 10)}
            horizontal
            keyExtractor={(t, idx) => `${t.id}-${idx}`}
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

      <SectionHeader title="Pilihan untukmu" subtitle="Campuran lagu hits" />
    </View>
  );
}

/**
 * Renders the curated artist list as a swipeable horizontal FlatList.
 * Each artist's photo is fetched once via the search API and persisted
 * in AsyncStorage so it stays static across launches.
 */
function ArtistsRow({
  artists,
  loading,
  region,
  apiKey,
  onOpenArtist,
}: {
  artists: FeaturedArtist[];
  loading: boolean;
  region: ArtistRegion | null;
  apiKey: string | null;
  onOpenArtist: (name: string) => void;
}) {
  const colors = useColors();
  const [photos, setPhotos] = useState<Record<string, string>>({});

  // Load cached photos
  useEffect(() => {
    storage
      .get<Record<string, string>>(ARTIST_PHOTO_CACHE_KEY)
      .then((cached) => {
        if (cached) setPhotos(cached);
      });
  }, []);

  // Lazily fetch missing photos one artist at a time
  useEffect(() => {
    if (!apiKey) return;
    const missing = artists.find((a) => !photos[a.name]);
    if (!missing) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.search(apiKey, missing.name);
        const pic = res.find((r) => r.thumbnail)?.thumbnail;
        if (!pic || cancelled) return;
        setPhotos((prev) => {
          if (prev[missing.name]) return prev;
          const next = { ...prev, [missing.name]: pic };
          storage.set(ARTIST_PHOTO_CACHE_KEY, next);
          return next;
        });
      } catch {
        // ignore failures — placeholder will keep showing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artists, photos, apiKey]);

  if (artists.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={
          region === "Indonesia" ? "Artis populer Indonesia" : "Top artists"
        }
        subtitle={
          region === "Indonesia"
            ? "Geser untuk lihat lebih banyak"
            : "Swipe to explore"
        }
      />
      <FlatList
        data={artists}
        horizontal
        keyExtractor={(a) => a.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
        renderItem={({ item }) => {
          const photo = photos[item.name];
          return (
            <Pressable
              onPress={() => onOpenArtist(item.name)}
              style={({ pressed }) => [
                styles.artistCard,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={styles.artistAvatar}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  style={styles.artistAvatar}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Feather name="user" size={28} color="#fff" />
                  )}
                </LinearGradient>
              )}
              <Text
                style={[styles.artistName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[styles.artistRegion, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {item.region === "Indonesia" ? "🇮🇩 Indonesia" : "🌍 International"}
              </Text>
            </Pressable>
          );
        }}
      />
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
        keyExtractor={(t, idx) => `${t.id}-${idx}`}
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
        Pencarian gagal
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
    overflow: "hidden",
  },
  artistName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
    textAlign: "center",
  },
  artistRegion: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
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
