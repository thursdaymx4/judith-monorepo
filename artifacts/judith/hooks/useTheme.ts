import { useMemo } from "react";

import { useJudith } from "@/contexts/JudithStore";
import { buildTheme, type Theme } from "@/constants/theme";

/** Returns the active Judith theme derived from the store (theme + accent). */
export function useTheme(): Theme {
  const { theme, accent } = useJudith();
  return useMemo(() => buildTheme(theme, accent), [theme, accent]);
}
