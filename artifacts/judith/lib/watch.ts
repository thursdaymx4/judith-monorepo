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
import { isPaidThisMonth, remainingThisMonth } from "@/lib/currentCycle";
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
}

// ─── Payload builder ──────────────────────────────────────────────────────────

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function optimisticDeltasForBill(
  bill: Bill,
  allBills: Bill[],
  today: Date,
): Pick<UpcomingBill, "optimisticTotalOwedDelta" | "optimisticUnpaidCountDelta"> {
  if (bill.cat !== "Credit card" && isPaidViaCard(bill) && bill.parentCardId) {
    const parentCard = allBills.find((candidate) => candidate.id === bill.parentCardId);
    if (!parentCard) {
      return { optimisticTotalOwedDelta: 0, optimisticUnpaidCountDelta: 0 };
    }

    const parentRemaining = remainingThisMonth(parentCard, today);
    const deltaAmount = Math.min(parentRemaining, remainingThisMonth(bill, today));
    const deltaCount = parentRemaining > 0 && parentRemaining - deltaAmount <= 0 ? 1 : 0;

    return {
      optimisticTotalOwedDelta: deltaAmount,
      optimisticUnpaidCountDelta: deltaCount,
    };
  }

  const deltaAmount = remainingThisMonth(bill, today);
  return {
    optimisticTotalOwedDelta: deltaAmount,
    optimisticUnpaidCountDelta: deltaAmount > 0 && !isPaidViaCard(bill) ? 1 : 0,
  };
}

function buildPayload(bills: Bill[], persona: PersonaId, currency: string): WatchPayload {
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
  const next = upcoming[0];
  const paidCount = cycleBills.filter((b) => isPaidThisMonth(b, today)).length;
  const totalCount = cycleBills.length;

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
    upcomingBills: upcoming.map((b) => ({
      id: b.id,
      provider: b.provider,
      amount: remainingThisMonth(b, today),
      dueDays: b.dueDays,
      dueLabel: b.dueLabel,
      isOverdue: b.dueDays < 0,
      ...optimisticDeltasForBill(b, bills, today),
    })),
    paidCount,
    totalCount,
  };
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
): Promise<void> {
  if (Platform.OS !== "ios") return;

  const payload     = buildPayload(bills, persona, currency);
  const payloadJson = JSON.stringify(payload);

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
    )({ judith_payload_v2: payloadJson });
  } catch {
    // No paired watch, Expo Go stub, or native module absent — silent no-op
  }
}
