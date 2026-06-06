import { useMemo } from "react";
import { useColorScheme } from "react-native";

import { useJudith } from "@/contexts/JudithStore";
import { buildTheme, type Theme } from "@/constants/theme";

/** Returns the active Judith theme derived from the store (theme + accent).
 *  When theme is "system", follows the OS dark/light preference. */
export function useTheme(): Theme {
  const { theme, accent } = useJudith();
  const systemScheme = useColorScheme();
  return useMemo(() => {
    const resolved = theme === "system" ? (systemScheme ?? "dark") : theme;
    return buildTheme(resolved, accent);
  }, [theme, accent, systemScheme]);
}
