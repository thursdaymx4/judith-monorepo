/** App-level, theme-able configuration. */

// Paywall gate is configurable per the spec. Off by default so the app is fully
// usable until RevenueCat products are configured; flip the env var to enable.
export const PAYWALL_ENABLED =
  process.env.EXPO_PUBLIC_PAYWALL_ENABLED === "true";

export const PRICE_LABEL = "₱79/buwan";
