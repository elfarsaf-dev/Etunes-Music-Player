import { useTheme } from "@/contexts/ThemeContext";

export function useColors() {
  return useTheme().theme.colors;
}

export function useRadius() {
  return 14;
}
