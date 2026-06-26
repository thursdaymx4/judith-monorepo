import { useMemo } from "react";
import { useColorScheme } from "react-native";

import { useJudithSelect } from "@/contexts/JudithStore";
import { buildTheme, type Theme } from "@/constants/theme";

/** Returns the active Judith theme derived from the store (theme + accent).
 *  When theme is "system", follows the OS dark/light preference.
 *
 *  Subscribes to ONLY the theme + accent slices via useJudithSelect — not the
 *  full store value. Because nearly every UI primitive (Txt, Mono, Card, Chip,
 *  rows…) calls useTheme(), reading the whole store here meant every themed
 *  component re-rendered on ANY state mutation (mark one bill paid, a toast, a
 *  toggle). Narrowing to two primitive slices stops that tree-wide storm. */
export function useTheme(): Theme {
  const theme = useJudithSelect((s) => s.theme);
  const accent = useJudithSelect((s) => s.accent);
  const systemScheme = useColorScheme();
  return useMemo(() => {
    const resolved = theme === "system" ? (systemScheme ?? "dark") : theme;
    return buildTheme(resolved, accent);
  }, [theme, accent, systemScheme]);
}
