/**
 * JudithFinanceKit — on-device discovery of recurring bills from Apple Card /
 * Apple Cash / Apple Savings transactions via Apple's FinanceKit framework.
 *
 * Available iOS 17.4+ for users with an eligible Apple Card account. The
 * native module reports `isAvailable() === false` for everyone else (older
 * iOS, Android, Expo Go, no Apple Card history) — callers must always check
 * before showing the FK-gated UI in onboarding.
 *
 * Privacy invariant: NO transaction data leaves the device. The Swift side
 * performs the clustering and only returns BillCandidate aggregates
 * (provider, median amount, typical due day, count, confidence). Raw
 * transactions never cross the React Native bridge.
 */
import { NativeModules, Platform } from "react-native";

export type FKAuthStatus =
  | "notDetermined"
  | "authorized"
  | "denied"
  | "unavailable";

/**
 * Aggregate emitted by on-device clustering. Nothing in here is tied to a
 * specific transaction — the user's raw txns stay on-device.
 */
export interface BillCandidate {
  /** Normalized merchant name suitable for use as a bill provider. */
  provider: string;
  /** Median paid amount across detected occurrences. */
  medianAmount: number;
  /** Day-of-month (1-31) the recurring charge typically lands. */
  typicalDueDay: number;
  /** Number of matching occurrences detected in the window. */
  occurrences: number;
  /**
   * Confidence in the recurrence pattern (0..1). Higher = tighter amount
   * cluster + more regular cadence. Drives UI ordering and the default
   * "checked" state for low-confidence candidates.
   */
  confidence: number;
}

interface NativeModuleShape {
  isAvailable(): Promise<boolean>;
  currentAuthorizationStatus(): Promise<FKAuthStatus>;
  requestAuthorization(): Promise<FKAuthStatus>;
  findRecurringBills(days: number): Promise<BillCandidate[]>;
  /** DEBUG-only. No-op in Release builds. */
  setMockEnabled?(enabled: boolean): boolean;
  /** DEBUG-only. Returns false in Release builds. */
  isMockEnabled?(): boolean;
}

const FK = (NativeModules.JudithFinanceKitModule ?? null) as NativeModuleShape | null;

/**
 * True only on iOS 17.4+ devices where the user has FinanceKit-eligible
 * accounts (typically requires Apple Card history). Always false on Android,
 * Expo Go, and pre-iOS-17.4 devices.
 */
export async function isAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || !FK) return false;
  try {
    return await FK.isAvailable();
  } catch {
    return false;
  }
}

export async function currentAuthorizationStatus(): Promise<FKAuthStatus> {
  if (Platform.OS !== "ios" || !FK) return "unavailable";
  try {
    return await FK.currentAuthorizationStatus();
  } catch {
    return "unavailable";
  }
}

/**
 * Prompts the user for FinanceKit access. Resolves to the new authorization
 * status. The system permission alert is shown by Apple — callers are
 * responsible for pre-explaining WHY before invoking this.
 */
export async function requestAuthorization(): Promise<FKAuthStatus> {
  if (Platform.OS !== "ios" || !FK) return "unavailable";
  try {
    return await FK.requestAuthorization();
  } catch {
    return "unavailable";
  }
}

/**
 * Returns up to ~20 recurring bill candidates detected in the last `days`
 * window. Performs clustering ENTIRELY on-device — no transaction data is
 * exposed to JS or sent off-device.
 *
 * Returns [] when FK is unavailable, unauthorized, or the user simply has
 * no recurring pattern yet (e.g. brand new account).
 */
export async function findRecurringBills(
  opts: { days?: number } = {},
): Promise<BillCandidate[]> {
  if (Platform.OS !== "ios" || !FK) return [];
  try {
    return await FK.findRecurringBills(opts.days ?? 90);
  } catch {
    return [];
  }
}

/**
 * **DEBUG BUILDS ONLY.** Flips an in-memory toggle inside the Swift module
 * so that `isAvailable()`, `requestAuthorization()`, and
 * `findRecurringBills()` return canned data instead of hitting FinanceKit.
 *
 * Enables Phase-2 UI testing on iPhones with no Apple Card (e.g. all PH
 * devices). The mock implementation lives inside `#if DEBUG` in the
 * Swift module, so Release / App Store builds compile WITHOUT this code
 * — calling this function in production is a silent no-op and Apple
 * reviewers cannot enable it.
 *
 * The flag does not persist across app launches.
 */
export function setMockEnabled(enabled: boolean): boolean {
  if (Platform.OS !== "ios" || !FK || !FK.setMockEnabled) return false;
  try {
    return FK.setMockEnabled(enabled);
  } catch {
    return false;
  }
}

export function isMockEnabled(): boolean {
  if (Platform.OS !== "ios" || !FK || !FK.isMockEnabled) return false;
  try {
    return FK.isMockEnabled();
  } catch {
    return false;
  }
}
