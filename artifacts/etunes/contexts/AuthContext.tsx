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

type LoginInput =
  | { username: string; password: string }
  | { username: string; apiKey: string }
  | { apiKey: string };

type AuthContextValue = {
  apiKey: string | null;
  profile: Profile | null;
  usage: Usage | null;
  loading: boolean;
  hydrated: boolean;
  setApiKey: (key: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  refresh: () => Promise<void>;
  regenerate: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
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
    async (username: string, password: string) => {
      const res = await api.register(username, password);
      await setApiKey(res.api_key);
    },
    [setApiKey],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      let payload:
        | { username: string; password: string }
        | { username: string; api_key: string }
        | { api_key: string };
      if ("password" in input) {
        payload = { username: input.username, password: input.password };
      } else if ("username" in input) {
        payload = { username: input.username, api_key: input.apiKey };
      } else {
        payload = { api_key: input.apiKey };
      }
      const res = await api.login(payload);
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

  const updateUsername = useCallback(
    async (newUsername: string) => {
      if (!apiKey) return;
      const trimmed = newUsername.trim();
      if (!trimmed) throw new Error("Username wajib diisi.");
      await api.updateUsername(apiKey, trimmed);
      await fetchProfile(apiKey);
    },
    [apiKey, fetchProfile],
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      if (!apiKey) return;
      if (!newPassword) throw new Error("Password wajib diisi.");
      await api.updatePassword(apiKey, newPassword);
    },
    [apiKey],
  );

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
      login,
      refresh,
      regenerate,
      updateUsername,
      updatePassword,
    }),
    [
      apiKey,
      profile,
      usage,
      loading,
      hydrated,
      setApiKey,
      signOut,
      register,
      login,
      refresh,
      regenerate,
      updateUsername,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
