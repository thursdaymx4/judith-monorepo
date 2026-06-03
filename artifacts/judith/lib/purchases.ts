import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { Platform } from "react-native";

import type { AskTier } from "@/contexts/JudithStore";

// ─── API keys ────────────────────────────────────────────────────────────────
// Set both in your Replit secrets / .env:
//   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS     → your Apple app's RC public key
//   EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID → your Google app's RC public key
//
// For Expo Go: RC automatically enters "Preview API Mode" when it cannot find
// the native SDK, so the app still runs without a real key. In-app purchase
// flows are no-ops in Expo Go regardless — test actual purchases on TestFlight
// or an Android internal/closed-testing build.
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "";
const API_KEY = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;

export const isPurchasesConfigured = Boolean(API_KEY);

// ─── Entitlement IDs (must match what you set in the RevenueCat dashboard) ──
// Chat Ask entitlement covers unlimited text asks.
// Voice Ask entitlement covers unlimited text + voice asks.
export const CHAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT_CHAT ?? "chat_ask";
export const VOICE_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT_VOICE ?? "voice_ask";

// Offering identifier — create a single "default" offering in RC containing
// two packages: one with your monthly Chat product, one with your monthly
// Voice product. The package identifiers should be "chat_ask" and "voice_ask".
const OFFERING_ID = process.env.EXPO_PUBLIC_RC_OFFERING ?? "default";

let configured = false;

export function configurePurchases(userId?: string): void {
  if (configured || !API_KEY) return;
  try {
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    configured = true;
  } catch {
    // Expo Go / missing native binary — RC is in preview mode, silently ignore.
  }
}

/** Identify a signed-in user so purchases are tied to their Supabase UID. */
export async function identifyUser(userId: string): Promise<void> {
  if (!API_KEY) return;
  configurePurchases();
  try {
    await Purchases.logIn(userId);
  } catch {
    /* best-effort */
  }
}

export async function resetUser(): Promise<void> {
  if (!API_KEY) return;
  try {
    await Purchases.logOut();
  } catch {
    /* best-effort */
  }
}

/**
 * Returns the highest active tier for the current customer.
 * Voice Ask > Chat Ask > free.
 */
export async function getActiveTier(): Promise<AskTier> {
  if (!API_KEY) return "free";
  configurePurchases();
  try {
    const info = await Purchases.getCustomerInfo();
    const active = info.entitlements.active;
    if (active[VOICE_ENTITLEMENT_ID]) return "voice";
    if (active[CHAT_ENTITLEMENT_ID]) return "chat";
    return "free";
  } catch {
    return "free";
  }
}

/** Check whether the user has an active entitlement for the given tier. */
export async function hasActiveEntitlement(tier: "chat" | "voice"): Promise<boolean> {
  if (!API_KEY) return false;
  configurePurchases();
  try {
    const info = await Purchases.getCustomerInfo();
    const id = tier === "voice" ? VOICE_ENTITLEMENT_ID : CHAT_ENTITLEMENT_ID;
    return Boolean(info.entitlements.active[id]);
  } catch {
    return false;
  }
}

export interface TierPackages {
  chat: PurchasesPackage | null;
  voice: PurchasesPackage | null;
}

/** Fetch both subscription packages from the RC offering. */
export async function getTierPackages(): Promise<TierPackages> {
  if (!API_KEY) return { chat: null, voice: null };
  configurePurchases();
  try {
    const offerings = await Purchases.getOfferings();
    const offering =
      offerings.all[OFFERING_ID] ?? offerings.current ?? null;
    if (!offering) return { chat: null, voice: null };

    const pkgs = offering.availablePackages;
    const find = (id: string) =>
      pkgs.find((p) => p.identifier === id) ?? null;

    return {
      chat: find("chat_ask"),
      voice: find("voice_ask"),
    };
  } catch {
    return { chat: null, voice: null };
  }
}

/** Returns the offering package for the given tier, or null if unavailable. */
export async function getPackageForTier(tier: "chat" | "voice"): Promise<PurchasesPackage | null> {
  const packages = await getTierPackages();
  return packages[tier];
}

/**
 * Purchase a subscription package. Returns the new tier on success,
 * or "free" if the purchase failed / was cancelled.
 */
export async function purchaseForTier(
  pkg: PurchasesPackage,
): Promise<AskTier> {
  configurePurchases();
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = customerInfo.entitlements.active;
    if (active[VOICE_ENTITLEMENT_ID]) return "voice";
    if (active[CHAT_ENTITLEMENT_ID]) return "chat";
    return "free";
  } catch {
    return "free";
  }
}

/**
 * Purchase a package and return the tier that became active, or null on failure.
 * The caller is responsible for updating the store with subscribe(tier).
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
  tier: "chat" | "voice",
): Promise<AskTier | null> {
  configurePurchases();
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const entitlementId = tier === "voice" ? VOICE_ENTITLEMENT_ID : CHAT_ENTITLEMENT_ID;
    if (customerInfo.entitlements.active[entitlementId]) return tier;
    return null;
  } catch {
    return null;
  }
}

/**
 * Restore previous purchases. Returns the recovered tier (or "free" if none).
 */
export async function restorePurchases(): Promise<AskTier> {
  if (!API_KEY) return "free";
  configurePurchases();
  try {
    const info = await Purchases.restorePurchases();
    const active = info.entitlements.active;
    if (active[VOICE_ENTITLEMENT_ID]) return "voice";
    if (active[CHAT_ENTITLEMENT_ID]) return "chat";
    return "free";
  } catch {
    return "free";
  }
}
