/**
 * Judith design tokens — ported 1:1 from the prototype spec (§2).
 * RN StyleSheet cannot parse oklch()/color-mix(); every oklch value from the
 * spec is precomputed to sRGB hex here.
 */

export type ThemeName = "dark" | "light" | "system";
export type AccentId = "mint" | "violet" | "blue";

/** Brand accents — mint is the locked default. */
export const ACCENTS: Record<AccentId, string> = {
  mint: "#29d5a5", // oklch(0.78 0.15 168)
  violet: "#b394ff", // oklch(0.74 0.16 295)
  blue: "#36acff", // oklch(0.72 0.16 245)
};

/** Semantic urgency colors (theme-independent). */
export const SEMANTIC = {
  overdue: "#ea1d3b", // oklch(0.6 0.23 22) — past due
  urgent: "#ff645f", // oklch(0.7 0.19 25)  — due ≤3 days
  near: "#f7b83d", // oklch(0.82 0.15 80) — due ≤7 days
  ok: "#56d1a3", // oklch(0.78 0.13 165) — upcoming / paid
};

/** Category accent palette (for charts/logos, independent of brand accent). */
export const CAT_COLORS: Record<string, string> = {
  "Rent / Mortgage": "#ab8be3",
  Electricity: "#f28f29",
  Water: "#32b3e6",
  Internet: "#a289f8",
  Mobile: "#3cc998",
  Landline: "#7c9cbc",
  "Credit card": "#f75c61",
  Subscription: "#df86d7",
  Custom: "#909fb8",
  "TV / Streaming": "#df86d7",
  "Phone subscription": "#00bcc5",
  "Web app": "#75b168",
  "Personal loan": "#ef6856",
};

/** Per-persona avatar disc gradients (g1 -> g2). */
export const PERSONA_LOOKS = {
  pro: { g1: "#959af4", g2: "#433a85", label: "Professional" },
  funny: { g1: "#f8a64f", g2: "#ae4024", label: "Funny friend" },
  sib: { g1: "#43c3c3", g2: "#005d75", label: "Sarcastic" },
  mama: { g1: "#ec99a3", g2: "#8d3d67", label: "Mama mo" },
  marites: { g1: "#f472b6", g2: "#be185d", label: "Perky Pal" },
  britney: { g1: "#94a3b8", g2: "#1e293b", label: "Brutal Britney" },
} as const;

export interface Palette {
  canvas: string;
  surface1: string;
  surface2: string;
  surface3: string;
  hair: string;
  hair2: string;
  txtHi: string;
  txtMid: string;
  txtLow: string;
  /** Text color on accent-filled buttons. */
  onAccent: string;
}

export const DARK: Palette = {
  canvas: "#0a0b0e",
  surface1: "#121419",
  surface2: "#181b22",
  surface3: "#1f232c",
  hair: "rgba(255,255,255,0.09)",
  hair2: "rgba(255,255,255,0.055)",
  txtHi: "#f3f5f8",
  txtMid: "#a7adba",
  txtLow: "#6a7180",
  onAccent: "#07080a",
};

export const LIGHT: Palette = {
  canvas: "#f1f2f6",
  surface1: "#ffffff",
  surface2: "#fbfbfe",
  surface3: "#eceef4",
  hair: "rgba(16,18,28,0.10)",
  hair2: "rgba(16,18,28,0.06)",
  txtHi: "#14161d",
  txtMid: "#545b6b",
  txtLow: "#888fa0",
  onAccent: "#ffffff",
};

/** Shared scalar tokens (§2.6). */
export const RADIUS = { lg: 24, md: 16, sm: 12 } as const;
export const SPACE = { pad: 18, gap: 12 } as const;

export const FONTS = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  semibold: "SpaceGrotesk_600SemiBold",
  bold: "SpaceGrotesk_700Bold",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
  display: "PlayfairDisplay_800ExtraBold_Italic",
} as const;

export interface Theme extends Palette {
  name: ThemeName;
  accent: string;
  semantic: typeof SEMANTIC;
  radius: typeof RADIUS;
  space: typeof SPACE;
  fonts: typeof FONTS;
}

export function buildTheme(name: ThemeName, accentId: AccentId = "mint"): Theme {
  const palette = name === "dark" ? DARK : LIGHT;
  return {
    name,
    ...palette,
    accent: ACCENTS[accentId],
    semantic: SEMANTIC,
    radius: RADIUS,
    space: SPACE,
    fonts: FONTS,
  };
}

/** Urgency color for a given days-until-due. */
export function urgencyColor(dueDays: number): string {
  if (dueDays < 0) return SEMANTIC.overdue;
  if (dueDays <= 3) return SEMANTIC.urgent;
  if (dueDays <= 7) return SEMANTIC.near;
  return SEMANTIC.ok;
}
