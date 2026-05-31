/**
 * Judith design tokens — a dark "modern fintech / AI" system with a glowing
 * teal→violet voice orb as the visual anchor. Light tokens are provided for
 * completeness; the brand leans dark. Keep all colors here (theme-able UI).
 */

const brand = {
  orbStart: "#2DD4BF", // teal
  orbMid: "#22D3EE", // cyan
  orbEnd: "#8B5CF6", // violet
};

const colors = {
  dark: {
    // Legacy aliases
    text: "#F5F7FA",
    tint: brand.orbStart,

    background: "#0A0B0F",
    foreground: "#F5F7FA",

    card: "#14161D",
    cardForeground: "#F5F7FA",

    primary: "#2DD4BF",
    primaryForeground: "#04201C",

    secondary: "#1B1E27",
    secondaryForeground: "#E6E8EF",

    muted: "#1B1E27",
    mutedForeground: "#8A90A2",

    accent: "#8B5CF6",
    accentForeground: "#FFFFFF",

    destructive: "#F1576B",
    destructiveForeground: "#FFFFFF",

    border: "#232735",
    input: "#232735",

    // Status / urgency
    success: "#34D399",
    warning: "#FBBF24",
    urgent: "#F1576B",
    near: "#FBBF24",
    ok: "#34D399",

    overlay: "rgba(5,6,10,0.72)",

    ...brand,
  },

  light: {
    text: "#0A0B0F",
    tint: "#0D9488",

    background: "#F7F8FB",
    foreground: "#0A0B0F",

    card: "#FFFFFF",
    cardForeground: "#0A0B0F",

    primary: "#0D9488",
    primaryForeground: "#FFFFFF",

    secondary: "#EEF0F5",
    secondaryForeground: "#1A1D26",

    muted: "#EEF0F5",
    mutedForeground: "#5C6373",

    accent: "#7C3AED",
    accentForeground: "#FFFFFF",

    destructive: "#DC2626",
    destructiveForeground: "#FFFFFF",

    border: "#E2E5EC",
    input: "#E2E5EC",

    success: "#059669",
    warning: "#D97706",
    urgent: "#DC2626",
    near: "#D97706",
    ok: "#059669",

    overlay: "rgba(10,11,15,0.45)",

    ...brand,
  },

  radius: 16,
};

export default colors;
