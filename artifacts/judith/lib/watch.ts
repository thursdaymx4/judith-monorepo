/**
 * Apple Watch bill-sync.
 *
 * Pushes the current bill summary to a paired Apple Watch app via
 * WatchConnectivity's transferUserInfo queue (persisted, delivered even when
 * the Watch app is not running).
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
  amount: number;
  dueDays: number;
  dueLabel: string;
  isOverdue: boolean;
}

export interface WatchPayload {
  /** ISO-8601 timestamp */
  generatedAt: string;
  /** Currency symbol — "$", "₱", "£", "€", etc. */
  currency: string;
  /** Sum of all unpaid bill amounts (via-card charges excluded) */
  totalOwed: number;
  /** Count of unpaid bills (via-card charges excluded) */
  unpaidCount: number;
  /** Next due bill (empty string if all paid) */
  nextProvider: string;
  nextAmount: number;
  nextDueDays: number;
  nextDueLabel: string;
  /** Active persona ID */
  persona: PersonaId;
  /** All unpaid bills sorted by dueDays (via-card charges included for display) */
  upcomingBills: UpcomingBill[];
}

// ─── Payload builder ──────────────────────────────────────────────────────────

function buildPayload(bills: Bill[], persona: PersonaId, currency: string): WatchPayload {
  const enriched = bills
    .filter((b) => b.status !== "paid")
    .map((b) => ({ b, occ: currentCycleDue(b) }))
    .sort((a, z) => a.occ.dueDays - z.occ.dueDays);

  const payable = enriched.filter(({ b }) => !isPaidViaCard(b, bills));

  const next = enriched[0];

  return {
    generatedAt: new Date().toISOString(),
    currency,
    totalOwed: payable.reduce((s, x) => s + x.b.amount, 0),
    unpaidCount: payable.length,
    nextProvider: next?.b.provider ?? "",
    nextAmount: next?.b.amount ?? 0,
    nextDueDays: next?.occ.dueDays ?? 0,
    nextDueLabel: next?.occ.dueLabel ?? "",
    persona,
    upcomingBills: enriched.map(({ b, occ }) => ({
      id: b.id,
      provider: b.provider,
      amount: b.amount,
      dueDays: occ.dueDays,
      dueLabel: occ.dueLabel,
      isOverdue: occ.dueDays < 0,
    })),
  };
}

// ─── Push to Watch ─────────────────────────────────────────────────────────────

/**
 * Push bill summary to a paired Apple Watch.
 * Safe to call on Android (no-ops) and in Expo Go (stub).
 */
export async function syncBillsToWatch(
  bills: Bill[],
  persona: PersonaId,
  currency: string,
): Promise<void> {
  if (Platform.OS !== "ios") return;
  if (!WatchConnectivity) return;

  try {
    const installed =
      (await (WatchConnectivity.getIsWatchAppInstalled as
        | (() => Promise<boolean>)
        | undefined)?.()) ?? false;
    if (!installed) return;

    const payload = buildPayload(bills, persona, currency);
    // JSON-stringify the payload so Swift's JSONDecoder can decode it cleanly.
    // transferUserInfo is queued and delivered even when the Watch app is in
    // the background or temporarily disconnected.
    await (
      WatchConnectivity.transferUserInfo as (
        p: Record<string, unknown>,
      ) => Promise<void>
    )({ judith_payload_v2: JSON.stringify(payload) });
  } catch {
    // No paired watch, Expo Go stub, or native module absent — silent no-op
  }
}
