/**
 * JudithWidgetBridge — writes the bill payload JSON to the iOS App Group
 * (group.com.app.judith / UserDefaults key "judith.payload_v2") and triggers
 * WidgetCenter.reloadAllTimelines() so the homescreen and lockscreen widgets
 * refresh immediately.
 *
 * Safe to call on Android and in Expo Go — no-ops silently.
 */
import { NativeModules, Platform } from "react-native";

type Bridge = {
  writePayload: (json: string) => void;
  writeAskAccess?: (tier: string, asksLeft: number) => void;
  readIntentCommands?: () => string;
  clearIntentCommands?: (idsJson: string) => void;
  foundationModelStatus?: () => Promise<string>;
  classifyBillCategory?: (provider: string, categoriesJson: string) => Promise<string>;
  classifyAskIntent?: (prompt: string, billsJson: string, currency: string) => Promise<string>;
  financeKitStatus?: () => Promise<string>;
  requestFinanceKitAuthorization?: () => Promise<string>;
  findRecentBillPaymentMatches?: (billsJson: string, currency: string, lookbackDays: number) => Promise<string>;
};

export type FoundationModelAvailability =
  | "available"
  | "deviceNotEligible"
  | "appleIntelligenceNotEnabled"
  | "modelNotReady"
  | "unsupportedOS"
  | "frameworkUnavailable"
  | "unknown";

export interface FoundationModelStatus {
  supported: boolean;
  availability: FoundationModelAvailability;
  reason?: string;
}

export interface FinanceKitStatus {
  supported: boolean;
  authorizationStatus: "authorized" | "denied" | "notDetermined" | "notRequired" | "unsupportedOS" | "frameworkUnavailable" | "unknown";
  reason?: string;
}

export interface FinanceBillPaymentMatch {
  billId: string;
  provider: string;
  transactionId: string;
  merchantName?: string;
  transactionDescription: string;
  amount: number;
  currency: string;
  transactionDate: string;
  postedDate?: string;
  confidence: number;
}

export interface FinanceBillPaymentMatchesResult extends FinanceKitStatus {
  matches: FinanceBillPaymentMatch[];
}

export interface BillCategoryResult {
  category: string;
  confidence: number;
  source: "foundationModels" | "heuristic" | "unavailable";
}

export interface AskIntentResult {
  intent: "queryDue" | "queryOverdue" | "queryTotal" | "queryBill" | "markPaid" | "addBill" | "updateBill" | "reminder" | "budgetAdvice" | "unknown";
  billName?: string;
  answer?: string;
  shouldUseCloud: boolean;
  confidence: number;
  source: "foundationModels" | "heuristic" | "unavailable";
}

let _bridge: Bridge | null = null;

function getBridge(): Bridge | null {
  if (_bridge !== null) return _bridge;
  // iOS-only surface (FinanceKit / FoundationModels / App-Intents / auto-pay).
  // Android implements only writePayload — see getAndroidBridge below — so the
  // rest stay JS no-ops on Android via this null.
  if (Platform.OS !== "ios") return null;
  try {
    // requireOptionalNativeModule returns null (not throws) when the native
    // module is absent — safe for Expo Go and non-iOS.
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => Bridge | null;
    };
    _bridge =
      requireOptionalNativeModule("JudithWidgetBridge") ??
      (NativeModules.JudithWidgetBridge as Bridge | undefined) ??
      null;
  } catch {
    _bridge = (NativeModules.JudithWidgetBridge as Bridge | undefined) ?? null;
  }
  return _bridge;
}

// Android home-screen widget bridge. The native module (registered under the
// same name "JudithWidgetBridge") only implements writePayload — it caches the
// payload to SharedPreferences and refreshes the AppWidgetProvider. Resolved
// separately from getBridge() so the iOS-only functions above remain no-ops.
let _androidBridge: Pick<Bridge, "writePayload"> | null = null;
function getAndroidBridge(): Pick<Bridge, "writePayload"> | null {
  if (_androidBridge !== null) return _androidBridge;
  if (Platform.OS !== "android") return null;
  try {
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => Pick<Bridge, "writePayload"> | null;
    };
    _androidBridge =
      requireOptionalNativeModule("JudithWidgetBridge") ??
      (NativeModules.JudithWidgetBridge as Pick<Bridge, "writePayload"> | undefined) ??
      null;
  } catch {
    _androidBridge = (NativeModules.JudithWidgetBridge as Pick<Bridge, "writePayload"> | undefined) ?? null;
  }
  return _androidBridge;
}

/**
 * Write the WatchPayload JSON string to the shared widget store and refresh the
 * home-screen widgets. Pass the same payload JSON used for the Watch sync.
 *
 * iOS  → App Group UserDefaults + WidgetCenter.reloadAllTimelines().
 * Android → SharedPreferences + AppWidgetManager update (see Android module).
 * Other (Expo Go) → no-op.
 */
export function writePayload(json: string): void {
  if (Platform.OS === "android") {
    getAndroidBridge()?.writePayload?.(json);
    return;
  }
  getBridge()?.writePayload(json);
}

export function writeAskAccess(tier: string, asksLeft: number): void {
  getBridge()?.writeAskAccess?.(tier, asksLeft);
}

export function readIntentCommands(): string {
  return getBridge()?.readIntentCommands?.() ?? "[]";
}

export function clearIntentCommands(ids: string[]): void {
  getBridge()?.clearIntentCommands?.(JSON.stringify(ids));
}

// ─── Phase 3 Sprint 3 — Auto-pay background scan ──────────────────────────
// All four are no-ops on Android / Expo Go. JS calls writeAutoPaySnapshot
// any time bills, toggles, currency, or the blacklist change so the BG
// task picks up fresh inputs. After the BG task runs, JS reads + clears
// pending entries on next app launch.

export function writeAutoPaySnapshot(json: string): void {
  const fn = getBridge() as { writeAutoPaySnapshot?: (j: string) => void } | undefined;
  fn?.writeAutoPaySnapshot?.(json);
}

export function readAutoPayPending(): string {
  const fn = getBridge() as { readAutoPayPending?: () => string } | undefined;
  return fn?.readAutoPayPending?.() ?? "[]";
}

export function clearAutoPayPending(): void {
  const fn = getBridge() as { clearAutoPayPending?: () => void } | undefined;
  fn?.clearAutoPayPending?.();
}

export function scheduleAutoPayBGTask(): boolean {
  const fn = getBridge() as { scheduleAutoPayBGTask?: () => boolean } | undefined;
  return fn?.scheduleAutoPayBGTask?.() ?? false;
}

export function cancelAutoPayBGTask(): void {
  const fn = getBridge() as { cancelAutoPayBGTask?: () => void } | undefined;
  fn?.cancelAutoPayBGTask?.();
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function foundationModelStatus(): Promise<FoundationModelStatus> {
  const fallback: FoundationModelStatus = {
    supported: false,
    availability: Platform.OS === "ios" ? "frameworkUnavailable" : "unsupportedOS",
  };
  const raw = await getBridge()?.foundationModelStatus?.();
  return parseJson(raw, fallback);
}

export async function financeKitStatus(): Promise<FinanceKitStatus> {
  const fallback: FinanceKitStatus = {
    supported: false,
    authorizationStatus: Platform.OS === "ios" ? "frameworkUnavailable" : "unsupportedOS",
  };
  const raw = await getBridge()?.financeKitStatus?.();
  return parseJson(raw, fallback);
}

export async function requestFinanceKitAuthorization(): Promise<FinanceKitStatus> {
  const fallback = await financeKitStatus();
  const raw = await getBridge()?.requestFinanceKitAuthorization?.();
  return parseJson(raw, fallback);
}

export async function findRecentBillPaymentMatches(
  bills: Array<{ id: string; provider: string; amount: number }>,
  currency: string,
  lookbackDays = 45,
): Promise<FinanceBillPaymentMatchesResult> {
  const fallback: FinanceBillPaymentMatchesResult = {
    supported: false,
    authorizationStatus: Platform.OS === "ios" ? "frameworkUnavailable" : "unsupportedOS",
    matches: [],
  };
  const raw = await getBridge()?.findRecentBillPaymentMatches?.(
    JSON.stringify(bills),
    currency,
    lookbackDays,
  );
  return parseJson(raw, fallback);
}

export async function classifyBillCategory(
  provider: string,
  categories: string[],
): Promise<BillCategoryResult> {
  const fallback = heuristicCategory(provider, categories);
  const raw = await getBridge()?.classifyBillCategory?.(provider, JSON.stringify(categories));
  return parseJson(raw, fallback);
}

export async function classifyAskIntent(
  prompt: string,
  bills: Array<{ provider: string; amount: number; dueDays: number; dueLabel: string; status: string; cat: string }>,
  currency: string,
): Promise<AskIntentResult> {
  const fallback = heuristicAskIntent(prompt);
  const raw = await getBridge()?.classifyAskIntent?.(prompt, JSON.stringify(bills), currency);
  return parseJson(raw, fallback);
}

function heuristicCategory(provider: string, categories: string[]): BillCategoryResult {
  const lower = provider.toLowerCase();
  const pick = (candidate: string) => categories.includes(candidate) ? candidate : "Custom";
  if (/meralco|electric|power|energy/.test(lower)) return { category: pick("Electricity"), confidence: 0.9, source: "heuristic" };
  if (/water|maynilad|manila water/.test(lower)) return { category: pick("Water"), confidence: 0.9, source: "heuristic" };
  if (/internet|wifi|pldt|converge|fiber/.test(lower)) return { category: pick("Internet"), confidence: 0.86, source: "heuristic" };
  if (/globe|smart|mobile|phone/.test(lower)) return { category: pick("Mobile"), confidence: 0.84, source: "heuristic" };
  if (/netflix|spotify|disney|prime|subscription/.test(lower)) return { category: pick("Subscription"), confidence: 0.84, source: "heuristic" };
  if (/visa|mastercard|amex|bpi|bdo|metrobank|card/.test(lower)) return { category: pick("Credit card"), confidence: 0.78, source: "heuristic" };
  if (/rent|mortgage|condo|hoa|assoc/.test(lower)) return { category: pick("Rent / Mortgage"), confidence: 0.8, source: "heuristic" };
  return { category: pick("Custom"), confidence: 0.35, source: "heuristic" };
}

function heuristicAskIntent(prompt: string): AskIntentResult {
  const lower = prompt.toLowerCase();
  if (/overdue|late|past due/.test(lower)) return { intent: "queryOverdue", shouldUseCloud: false, confidence: 0.85, source: "heuristic" };
  if (/total|how much|owe|monthly|month/.test(lower)) return { intent: "queryTotal", shouldUseCloud: false, confidence: 0.78, source: "heuristic" };
  if (/paid|mark.*paid/.test(lower)) return { intent: "markPaid", shouldUseCloud: false, confidence: 0.78, source: "heuristic" };
  if (/add|new bill/.test(lower)) return { intent: "addBill", shouldUseCloud: false, confidence: 0.72, source: "heuristic" };
  if (/remind|reminder|snooze/.test(lower)) return { intent: "reminder", shouldUseCloud: false, confidence: 0.72, source: "heuristic" };
  if (/afford|budget|income|vacation|save/.test(lower)) return { intent: "budgetAdvice", shouldUseCloud: true, confidence: 0.72, source: "heuristic" };
  if (/due|today|week|next/.test(lower)) return { intent: "queryDue", shouldUseCloud: false, confidence: 0.76, source: "heuristic" };
  return { intent: "unknown", shouldUseCloud: true, confidence: 0.2, source: "heuristic" };
}
