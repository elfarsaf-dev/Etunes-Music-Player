import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import type { Profile, Usage } from "@/lib/types";

type AuthContextValue = {
  apiKey: string | null;
  profile: Profile | null;
  usage: Usage | null;
  loading: boolean;
  hydrated: boolean;
  setApiKey: (key: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  regenerate: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const fetchProfile = useCallback(async (key: string) => {
    try {
      setLoading(true);
      const [p, u] = await Promise.all([api.me(key), api.usage(key)]);
      setProfile(p);
      setUsage(u);
    } catch {
      // silent — keep showing cached
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await storage.get<string>(storage.keys.apiKey);
      if (stored) {
        setApiKeyState(stored);
        await fetchProfile(stored);
      }
      setHydrated(true);
    })();
  }, [fetchProfile]);

  const setApiKey = useCallback(
    async (key: string) => {
      const trimmed = key.trim();
      await storage.set(storage.keys.apiKey, trimmed);
      setApiKeyState(trimmed);
      await fetchProfile(trimmed);
    },
    [fetchProfile],
  );

  const signOut = useCallback(async () => {
    await storage.remove(storage.keys.apiKey);
    setApiKeyState(null);
    setProfile(null);
    setUsage(null);
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await api.register(email, password);
      await setApiKey(res.api_key);
    },
    [setApiKey],
  );

  const refresh = useCallback(async () => {
    if (!apiKey) return;
    await fetchProfile(apiKey);
  }, [apiKey, fetchProfile]);

  const regenerate = useCallback(async () => {
    if (!apiKey) return;
    const res = await api.regenerateKey(apiKey);
    await setApiKey(res.api_key);
  }, [apiKey, setApiKey]);

  const value = useMemo<AuthContextValue>(
    () => ({
      apiKey,
      profile,
      usage,
      loading,
      hydrated,
      setApiKey,
      signOut,
      register,
      refresh,
      regenerate,
    }),
    [apiKey, profile, usage, loading, hydrated, setApiKey, signOut, register, refresh, regenerate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
