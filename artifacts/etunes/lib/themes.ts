export type ThemeColors = {
  text: string;
  tint: string;

  background: string;
  foreground: string;

  card: string;
  cardForeground: string;
  cardElevated: string;

  primary: string;
  primaryForeground: string;

  secondary: string;
  secondaryForeground: string;

  muted: string;
  mutedForeground: string;

  accent: string;
  accentForeground: string;

  destructive: string;
  destructiveForeground: string;

  border: string;
  input: string;

  success: string;
  warning: string;

  gradientStart: string;
  gradientEnd: string;

  overlay: string;
  overlaySoft: string;

  isLight: boolean;
};

export type Theme = {
  id: string;
  name: string;
  swatch: [string, string, string];
  colors: ThemeColors;
};

const baseDark = {
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  success: "#22c55e",
  warning: "#f59e0b",
  isLight: false,
};

const baseLight = {
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  success: "#16a34a",
  warning: "#d97706",
  isLight: true,
};

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    swatch: ["#7c3aed", "#ec4899", "#0a0612"],
    colors: {
      ...baseDark,
      text: "#f5f5f7",
      tint: "#a78bfa",
      background: "#0a0612",
      foreground: "#f5f5f7",
      card: "#15101f",
      cardForeground: "#f5f5f7",
      cardElevated: "#1d1730",
      primary: "#a78bfa",
      primaryForeground: "#0a0612",
      secondary: "#1d1730",
      secondaryForeground: "#e9e3f7",
      muted: "#1a1428",
      mutedForeground: "#8a82a3",
      accent: "#ec4899",
      accentForeground: "#fff",
      border: "#231a36",
      input: "#1d1730",
      gradientStart: "#7c3aed",
      gradientEnd: "#ec4899",
      overlay: "rgba(10,6,18,0.85)",
      overlaySoft: "rgba(10,6,18,0.55)",
    },
  },
  {
    id: "sunshine",
    name: "Sunshine",
    swatch: ["#FFD60A", "#1E3A8A", "#FFFFFF"],
    colors: {
      ...baseLight,
      text: "#0f172a",
      tint: "#FFD60A",
      background: "#FFFFFF",
      foreground: "#0f172a",
      card: "#fffbe6",
      cardForeground: "#0f172a",
      cardElevated: "#fef3c7",
      primary: "#FFD60A",
      primaryForeground: "#1E3A8A",
      secondary: "#1E3A8A",
      secondaryForeground: "#FFFFFF",
      muted: "#fef9c3",
      mutedForeground: "#78716c",
      accent: "#60A5FA",
      accentForeground: "#FFFFFF",
      border: "#fde68a",
      input: "#fef3c7",
      gradientStart: "#FFD60A",
      gradientEnd: "#60A5FA",
      overlay: "rgba(255,255,255,0.92)",
      overlaySoft: "rgba(255,255,255,0.6)",
    },
  },
  {
    id: "forest",
    name: "Forest Clean",
    swatch: ["#16A34A", "#22C55E", "#FFFFFF"],
    colors: {
      ...baseLight,
      text: "#0f172a",
      tint: "#16A34A",
      background: "#FFFFFF",
      foreground: "#0f172a",
      card: "#f0fdf4",
      cardForeground: "#0f172a",
      cardElevated: "#dcfce7",
      primary: "#16A34A",
      primaryForeground: "#FFFFFF",
      secondary: "#6B7280",
      secondaryForeground: "#FFFFFF",
      muted: "#ecfccb",
      mutedForeground: "#6B7280",
      accent: "#22C55E",
      accentForeground: "#FFFFFF",
      border: "#bbf7d0",
      input: "#dcfce7",
      gradientStart: "#16A34A",
      gradientEnd: "#22C55E",
      overlay: "rgba(255,255,255,0.92)",
      overlaySoft: "rgba(255,255,255,0.6)",
    },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    swatch: ["#0F172A", "#EF4444", "#020617"],
    colors: {
      ...baseDark,
      text: "#f1f5f9",
      tint: "#EF4444",
      background: "#020617",
      foreground: "#f1f5f9",
      card: "#0F172A",
      cardForeground: "#f1f5f9",
      cardElevated: "#1F2937",
      primary: "#EF4444",
      primaryForeground: "#FFFFFF",
      secondary: "#1F2937",
      secondaryForeground: "#f1f5f9",
      muted: "#0F172A",
      mutedForeground: "#94a3b8",
      accent: "#EF4444",
      accentForeground: "#FFFFFF",
      border: "#1e293b",
      input: "#1F2937",
      gradientStart: "#EF4444",
      gradientEnd: "#0F172A",
      overlay: "rgba(2,6,23,0.9)",
      overlaySoft: "rgba(2,6,23,0.55)",
    },
  },
  {
    id: "indigo",
    name: "Indigo Dream",
    swatch: ["#3B82F6", "#8B5CF6", "#0F172A"],
    colors: {
      ...baseDark,
      text: "#e0e7ff",
      tint: "#A78BFA",
      background: "#0F172A",
      foreground: "#e0e7ff",
      card: "#1e1b4b",
      cardForeground: "#e0e7ff",
      cardElevated: "#312e81",
      primary: "#3B82F6",
      primaryForeground: "#FFFFFF",
      secondary: "#8B5CF6",
      secondaryForeground: "#FFFFFF",
      muted: "#1e1b4b",
      mutedForeground: "#a5b4fc",
      accent: "#A78BFA",
      accentForeground: "#FFFFFF",
      border: "#312e81",
      input: "#1e1b4b",
      gradientStart: "#3B82F6",
      gradientEnd: "#8B5CF6",
      overlay: "rgba(15,23,42,0.9)",
      overlaySoft: "rgba(15,23,42,0.55)",
    },
  },
  {
    id: "peach",
    name: "Peach Aesthetic",
    swatch: ["#FDBA74", "#FB923C", "#FFF7ED"],
    colors: {
      ...baseLight,
      text: "#7C2D12",
      tint: "#FB923C",
      background: "#FFF7ED",
      foreground: "#7C2D12",
      card: "#FFEDD5",
      cardForeground: "#7C2D12",
      cardElevated: "#FED7AA",
      primary: "#FDBA74",
      primaryForeground: "#7C2D12",
      secondary: "#7C2D12",
      secondaryForeground: "#FFF7ED",
      muted: "#FFEDD5",
      mutedForeground: "#9A3412",
      accent: "#FB923C",
      accentForeground: "#FFFFFF",
      border: "#FED7AA",
      input: "#FED7AA",
      gradientStart: "#FDBA74",
      gradientEnd: "#FB923C",
      overlay: "rgba(255,247,237,0.92)",
      overlaySoft: "rgba(255,247,237,0.55)",
    },
  },
  {
    id: "neon",
    name: "Cyberpunk Neon",
    swatch: ["#E879F9", "#1E1B4B", "#020617"],
    colors: {
      ...baseDark,
      text: "#f5d0fe",
      tint: "#E879F9",
      background: "#020617",
      foreground: "#f5d0fe",
      card: "#1E1B4B",
      cardForeground: "#f5d0fe",
      cardElevated: "#2e1065",
      primary: "#E879F9",
      primaryForeground: "#020617",
      secondary: "#1E1B4B",
      secondaryForeground: "#f5d0fe",
      muted: "#0F172A",
      mutedForeground: "#c084fc",
      accent: "#E879F9",
      accentForeground: "#020617",
      border: "#312e81",
      input: "#1E1B4B",
      gradientStart: "#E879F9",
      gradientEnd: "#1E1B4B",
      overlay: "rgba(2,6,23,0.9)",
      overlaySoft: "rgba(2,6,23,0.55)",
    },
  },
];

export const DEFAULT_THEME_ID = "midnight";

export function getTheme(id: string | null | undefined): Theme {
  if (!id) return THEMES[0];
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
