/**
 * Apple Watch bill-sync.
 *
 * Pushes the current bill summary to a paired Apple Watch app via
 * WatchConnectivity's transferUserInfo queue (persisted, delivered even when
 * the Watch app is not running).
 *
 * In Expo Go, react-native-watch-connectivity is replaced by a no-op stub
 * (see metro.config.js + lib/watch-stub.js), so this module is safe to import
 * anywhere. The actual sync only fires on a device with a compiled Watch app.
 *
 * Required for a full dev/prod build:
 *   1. Run `expo prebuild` to eject and generate ios/ directory.
 *   2. Add a WatchKit App target in Xcode using the Judith Watch extension.
 *   3. Implement the Watch UI (SwiftUI) that reads userInfo from WCSession.
 */
import { Platform } from "react-native";
import type { Bill } from "@/constants/data";
import type { PersonaId } from "@/constants/personas";

// Wrapped in try/catch: TurboModuleRegistry.getEnforcing("RNWatch") throws
// synchronously in Expo Go (native module absent). A try/catch around require()
// catches it safely; WatchConnectivity is null → all sync paths become no-ops.
// eslint-disable-next-line @typescript-eslint/no-require-imports
let WatchConnectivity: Record<string, unknown> | null = null;
try {
  WatchConnectivity = require("react-native-watch-connectivity");
} catch {
  // Expo Go or simulator without the native Watch module — silent no-op
}

export interface WatchPayload {
  /** ISO-8601 timestamp of when this payload was generated */
  generatedAt: string;
  /** Sum of all unpaid bill amounts */
  totalOwed: number;
  /** Number of unpaid bills */
  unpaidCount: number;
  /** Next due bill (or null if all paid) */
  nextProvider: string;
  nextAmount: number;
  nextDueDays: number;
  nextDueLabel: string;
  /** Active persona ID (drives Watch face avatar / copy) */
  persona: PersonaId;
  /** Bills due in ≤3 days — compact form for Watch list */
  urgentBills: Array<{ id: string; provider: string; amount: number; dueDays: number }>;
}

function buildPayload(bills: Bill[], persona: PersonaId): WatchPayload {
  const unpaid = bills.filter((b) => b.status !== "paid").sort((a, b) => a.dueDays - b.dueDays);
  const next = unpaid[0];
  return {
    generatedAt: new Date().toISOString(),
    totalOwed: unpaid.reduce((s, b) => s + b.amount, 0),
    unpaidCount: unpaid.length,
    nextProvider: next?.provider ?? "",
    nextAmount: next?.amount ?? 0,
    nextDueDays: next?.dueDays ?? 0,
    nextDueLabel: next?.dueLabel ?? "",
    persona,
    urgentBills: unpaid
      .filter((b) => b.dueDays <= 3)
      .map((b) => ({ id: b.id, provider: b.provider, amount: b.amount, dueDays: b.dueDays })),
  };
}

/**
 * Push bill summary to a paired Apple Watch.
 * Safe to call on Android (no-ops) and in Expo Go (stub).
 * Only actually sends on a physical iOS device with a compiled Watch app.
 */
export async function syncBillsToWatch(bills: Bill[], persona: PersonaId): Promise<void> {
  if (Platform.OS !== "ios") return;
  if (!WatchConnectivity) return;

  try {
    const installed = await (WatchConnectivity.getIsWatchAppInstalled as (() => Promise<boolean>) | undefined)?.() ?? false;
    if (!installed) return;

    const payload = buildPayload(bills, persona);
    // transferUserInfo is queued and delivered reliably even when the Watch
    // app is in the background. It does NOT require a live BLE connection.
    await (WatchConnectivity.transferUserInfo as (p: WatchPayload) => Promise<void>)(payload);
  } catch {
    // No paired watch, Expo Go stub, or native module absent — silent no-op
  }
}
