import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  apiKey: "@etunes/api_key",
  playlists: "@etunes/playlists",
  recent: "@etunes/recent",
  searchHistory: "@etunes/search_history",
  theme: "@etunes/theme",
  downloads: "@etunes/downloads",
} as const;

export const storage = {
  keys: KEYS,
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
