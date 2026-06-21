/**
 * Apple Watch bill-sync.
 *
 * Pushes the current bill summary to a paired Apple Watch app via
 * WatchConnectivity's application context (latest-state delivery).
 *
 * The payload is JSON-stringified and sent under the `judith_payload_v2` key
 * so the Swift side can decode it cleanly with JSONDecoder.
 *
 * In Expo Go, react-native-watch-connectivity is replaced by a no-op stub
 * (see metro.config.js + lib/watch-stub.js), so this module is safe to import
 * anywhere.
 */
import { Platform } from "react-native";
import { currentCycleDue, isPaidViaCard, type Bill } from "@/constants/data";
import type { PersonaId } from "@/constants/personas";
import { amountPaidThisMonth, isPaidThisMonth, remainingThisMonth } from "@/lib/currentCycle";
import { buildAskBills } from "@/lib/buildAskBills";
import { supabase } from "@/lib/supabase";
import { writePayload as writeWidgetPayload } from "judith-widget-bridge";

let WatchConnectivity: Record<string, unknown> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WatchConnectivity = require("react-native-watch-connectivity");
} catch {
  // Expo Go or simulator without the native Watch module — silent no-op
}

export { WatchConnectivity };

// ─── Payload shape (mirrored in JudithWatch/Models/WatchPayload.swift) ────────

export interface UpcomingBill {
  id: string;
  provider: string;
  /** App category, e.g. "Credit card". */
  cat?: string;
  /** Remaining amount due this cycle for this bill row. */
  amount: number;
  dueDays: number;
  dueLabel: string;
  isOverdue: boolean;
  /** Optimistic watch-side delta to apply to the headline total after mark paid. */
  optimisticTotalOwedDelta: number;
  /** Optimistic watch-side delta to apply to the payable bill count after mark paid. */
  optimisticUnpaidCountDelta: number;
}

export interface WatchPayload {
  /** ISO-8601 timestamp */
  generatedAt: string;
  /** Currency symbol — "$", "₱", "£", "€", etc. */
  currency: string;
  /** Sum of current-cycle unpaid balances (via-card charges excluded). */
  totalOwed: number;
  /** Count of current-cycle unpaid payable bills (via-card charges excluded). */
  unpaidCount: number;
  /** Next due bill (empty string if all paid) */
  nextProvider: string;
  nextAmount: number;
  nextDueDays: number;
  nextDueLabel: string;
  /** Active persona ID */
  persona: PersonaId;
  /** Current-cycle unpaid bills sorted by dueDays (via-card charges included). */
  upcomingBills: UpcomingBill[];
  /** Bills already marked paid this month — drives the complication gauge. */
  paidCount: number;
  /** Bills due this month (paid + unpaid) — denominator for the gauge. */
  totalCount: number;
  /** Sum of amountPaidThisMonth across all non-via-card bills. Mirrors phone's amount-based progress %. */
  paidAmount: number;
  /** # of payable bills overdue right now (via-card excluded). */
  overdueCount: number;
  /** Sum of remaining balances on payable overdue bills. */
  overdueTotal: number;
  /** Sum of remaining balances on payable bills due in the next 7 days (overdue excluded — matches phone hero "next 7 days"). */
  next7Total: number;
  /** Whether the user has accepted the shared AI-data-sharing disclosure
   *  on the iPhone. Watch reads this on every payload sync; it blocks
   *  /watch-ask + /watch-stt until the user has consented on the paired
   *  phone. Apple Guideline 5.1.1(i) / 5.1.2(i). */
  aiConsented: boolean;
}

export interface WatchSnapshotContext {
  countryName?: string;
  countryCode?: string;
  monthlyIncome?: number;
  incomeByMonth?: Record<string, number>;
  payCycle?: "monthly" | "semi-monthly" | "weekly";
  paydayDay?: number;
  paydaySemi?: [number, number];
  paydayWeekday?: number;
}

// ─── Payload builder ──────────────────────────────────────────────────────────

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// All bills passed here come from payableUpcoming (non-via-card), so the
// optimistic delta is simply the bill's remaining balance and a count of 1.
function optimisticDeltasForBill(
  bill: Bill,
  today: Date,
): Pick<UpcomingBill, "optimisticTotalOwedDelta" | "optimisticUnpaidCountDelta"> {
  const deltaAmount = remainingThisMonth(bill, today);
  return {
    optimisticTotalOwedDelta: deltaAmount,
    optimisticUnpaidCountDelta: deltaAmount > 0 ? 1 : 0,
  };
}

function buildPayload(
  bills: Bill[],
  persona: PersonaId,
  currency: string,
  aiConsented: boolean,
): WatchPayload {
  const today = new Date();
  const daysLeftInMonth =
    daysInMonth(today.getFullYear(), today.getMonth()) - today.getDate();

  const cycleBills = bills
    .map((b) => ({ ...b, ...currentCycleDue(b, today) }))
    .filter((b) => b.dueDays <= daysLeftInMonth);

  const upcoming = cycleBills
    .filter((b) => !isPaidThisMonth(b, today))
    .sort((a, z) => a.dueDays - z.dueDays);
  const payableUpcoming = upcoming.filter((b) => !isPaidViaCard(b));
  // "Next bill" must come from payable bills only — a via-card sub-bill
  // (auto-charged to a CC the user also tracks) is not independently payable
  // and should not appear as the action item on the Watch face.
  const next = payableUpcoming[0];
  const paidCount = cycleBills.filter((b) => isPaidThisMonth(b, today)).length;
  const totalCount = cycleBills.length;

  // Amount-based paid % — mirrors app/(tabs)/index.tsx so the watch ring
  // matches the phone hero card instead of using count-based fraction.
  // paidAmount includes both fully-paid bills and in-progress partial payments
  // on still-unpaid bills, exactly like the phone screen.
  const paidAmount = bills
    .filter((b) => !isPaidViaCard(b))
    .reduce((sum, b) => sum + amountPaidThisMonth(b, today), 0);

  const overdueBills = payableUpcoming.filter((b) => b.dueDays < 0);
  const overdueCount = overdueBills.length;
  const overdueTotal = overdueBills.reduce(
    (sum, b) => sum + remainingThisMonth(b, today),
    0,
  );
  const next7Total = payableUpcoming
    .filter((b) => b.dueDays >= 0 && b.dueDays <= 7)
    .reduce((sum, b) => sum + remainingThisMonth(b, today), 0);

  return {
    generatedAt: new Date().toISOString(),
    currency,
    totalOwed: payableUpcoming.reduce((sum, b) => sum + remainingThisMonth(b, today), 0),
    unpaidCount: payableUpcoming.length,
    nextProvider: next?.provider ?? "",
    nextAmount: next ? remainingThisMonth(next, today) : 0,
    nextDueDays: next?.dueDays ?? 0,
    nextDueLabel: next?.dueLabel ?? "",
    persona,
    // Only payable bills appear in the Watch list — via-card sub-bills are
    // excluded so the list count matches unpaidCount and the total shown on the
    // Watch face. (Via-card bills remain visible on the phone timeline.)
    upcomingBills: payableUpcoming.map((b) => ({
      id: b.id,
      provider: b.provider,
      cat: b.cat,
      amount: remainingThisMonth(b, today),
      dueDays: b.dueDays,
      dueLabel: b.dueLabel,
      isOverdue: b.dueDays < 0,
      ...optimisticDeltasForBill(b, today),
    })),
    paidCount,
    totalCount,
    paidAmount,
    overdueCount,
    overdueTotal,
    next7Total,
    aiConsented,
  };
}

async function authHeaders(): Promise<Record<string, string> | null> {
  try {
    const session = (await supabase?.auth.getSession())?.data.session;
    if (!session?.access_token) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    return null;
  }
}

async function postWatchJson<T>(path: string, body: unknown): Promise<T | null> {
  const headers = await authHeaders();
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!headers || !domain) return null;
  try {
    const res = await fetch(`https://${domain}/api/judith${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

async function provisionWatchToken(): Promise<string | null> {
  const result = await postWatchJson<{ token?: string }>("/watch-token", {});
  return typeof result?.token === "string" ? result.token : null;
}

async function uploadWatchSnapshot(
  payload: WatchPayload,
  bills: Bill[],
  persona: PersonaId,
  currency: string,
  context?: WatchSnapshotContext,
): Promise<void> {
  await postWatchJson("/watch-snapshot", {
    payload,
    askBills: buildAskBills(bills),
    persona,
    currency,
    countryName: context?.countryName,
    countryCode: context?.countryCode,
    monthlyIncome: context?.monthlyIncome,
    incomeByMonth: context?.incomeByMonth,
    payCycle: context?.payCycle,
    paydayDay: context?.paydayDay,
    paydaySemi: context?.paydaySemi,
    paydayWeekday: context?.paydayWeekday,
  });
}

// ─── Push to Watch ─────────────────────────────────────────────────────────────

/**
 * Push bill summary to the widget and optionally to a paired Apple Watch.
 *
 * @param watchEnabled - When false, only the widget is updated (Watch sync
 *   is skipped). Always pass `toggles.watch` from the store.
 *
 * Safe to call on Android (no-ops) and in Expo Go (stub).
 */
export async function syncBillsToWatch(
  bills: Bill[],
  persona: PersonaId,
  currency: string,
  watchEnabled = true,
  context?: WatchSnapshotContext,
): Promise<void> {
  if (Platform.OS !== "ios") return;

  // Read the phone's consent flag synchronously from AsyncStorage and
  // propagate it on the payload — the watch needs it to gate /watch-ask
  // and /watch-stt before it makes any third-party AI call.
  const { hasAiConsented } = await import("@/lib/aiConsent");
  const aiConsented = await hasAiConsented();
  const payload     = buildPayload(bills, persona, currency, aiConsented);
  const payloadJson = JSON.stringify(payload);
  const [watchToken] = await Promise.all([
    provisionWatchToken(),
    uploadWatchSnapshot(payload, bills, persona, currency, context),
  ]);

  // ── iOS widget extension ─────────────────────────────────────────────────
  // Always write to the App Group so homescreen / lockscreen widgets refresh.
  // This is independent of whether a Watch is paired or the Watch toggle is on.
  writeWidgetPayload(payloadJson);

  // ── Apple Watch app ───────────────────────────────────────────────────────
  // updateApplicationContext replaces the previous value in-place; the Watch
  // receives it via didReceiveApplicationContext instantly when reachable, or
  // on next activation otherwise.
  if (!watchEnabled || !WatchConnectivity) return;
  try {
    (
      WatchConnectivity.updateApplicationContext as (
        p: Record<string, unknown>,
      ) => void
    )({
      judith_payload_v2: payloadJson,
      ...(watchToken ? { judith_watch_token: watchToken } : {}),
    });
  } catch {
    // No paired watch, Expo Go stub, or native module absent — silent no-op
  }
}
