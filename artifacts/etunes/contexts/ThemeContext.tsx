import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { storage } from "@/lib/storage";
import { DEFAULT_THEME_ID, getTheme, THEMES, type Theme } from "@/lib/themes";

type ThemeContextValue = {
  theme: Theme;
  setThemeId: (id: string) => Promise<void>;
  themes: Theme[];
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(DEFAULT_THEME_ID);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.get<string>(storage.keys.theme);
      if (stored) setThemeIdState(stored);
      setHydrated(true);
    })();
  }, []);

  const setThemeId = useCallback(async (id: string) => {
    setThemeIdState(id);
    await storage.set(storage.keys.theme, id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: getTheme(themeId),
      setThemeId,
      themes: THEMES,
      hydrated,
    }),
    [themeId, setThemeId, hydrated],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
