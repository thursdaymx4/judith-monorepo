/**
 * financeMatching.ts — Phase 3 orchestrator.
 *
 * Glues the FinanceKit match results from judith-widget-bridge to the
 * user-visible plumbing: notifications, bill state changes, and the
 * on-device Auto-pay activity log.
 *
 * Designed so Carlo can ship in two waves:
 *   1. Manual "Scan now" button → exercise the full flow on demand
 *   2. Background BGTaskScheduler hook (Sprint 2) calls scanAndApply()
 *      every ~4h with no UI present
 *
 * Privacy invariant: no FinanceKit transaction data is sent to our
 * api-server. Match results stay on-device. The activity log lives in
 * AsyncStorage so reinstalls reset it (matches Apple's "treat derived
 * financial data as on-device" stance).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  findRecentBillPaymentMatches,
  type FinanceBillPaymentMatch,
} from "judith-widget-bridge";

const ACTIVITY_KEY = "judith.autoPayActivity.v1";
const BLACKLIST_KEY = "judith.autoPayBlacklist.v1";
const MAX_ACTIVITY = 200;

/** Confidence floor below which a match is never surfaced to the user. */
const LOW_CONF_DROP = 0.6;
/** Boundary between "suggest" and "high-confidence auto-mark" buckets. */
const HIGH_CONF_THRESHOLD = 0.85;

export type ActivityKind =
  | "auto-marked"  // High-conf + autoPayMark ON: bill was just marked paid.
  | "suggested"    // Notification fired; awaiting user tap.
  | "confirmed"    // User tapped Mark Paid on a suggestion.
  | "undone"       // User tapped Undo within 24h.
  | "ignored";     // User dismissed the notification or didn't act.

export interface ActivityEntry {
  id: string;
  ts: number;
  kind: ActivityKind;
  billId: string;
  billProvider: string;
  amount: number;
  currency: string;
  txnId: string;
  confidence: number;
}

/** Loaded from AsyncStorage on demand — no caching to avoid stale UI. */
export async function loadActivity(): Promise<ActivityEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendActivity(entry: ActivityEntry): Promise<void> {
  const existing = await loadActivity();
  const next = [entry, ...existing].slice(0, MAX_ACTIVITY);
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
}

async function updateActivity(id: string, patch: Partial<ActivityEntry>): Promise<void> {
  const existing = await loadActivity();
  const next = existing.map((e) => (e.id === id ? { ...e, ...patch } : e));
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
}

export async function clearActivity(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVITY_KEY);
}

/** Blacklist: { billId__txnId: 1 } so we never re-suggest a rejected match. */
async function loadBlacklist(): Promise<Record<string, true>> {
  try {
    const raw = await AsyncStorage.getItem(BLACKLIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function addToBlacklist(billId: string, txnId: string): Promise<void> {
  const map = await loadBlacklist();
  map[`${billId}__${txnId}`] = true;
  await AsyncStorage.setItem(BLACKLIST_KEY, JSON.stringify(map));
}

/** Records a "this match was already processed" marker so background scans
 *  don't surface the same transaction twice. */
async function isAlreadyProcessed(billId: string, txnId: string): Promise<boolean> {
  const map = await loadBlacklist();
  if (map[`${billId}__${txnId}`]) return true;
  const log = await loadActivity();
  return log.some((e) => e.billId === billId && e.txnId === txnId);
}

/** Fired when the user taps Undo on an auto-mark notification. Reverts the
 *  bill to unpaid and blacklists the transaction so the next scan doesn't
 *  re-match it. The caller (notification handler) supplies the unmark fn. */
export async function undoAutoMark(
  entryId: string,
  unmark: (billId: string) => void,
): Promise<void> {
  const log = await loadActivity();
  const entry = log.find((e) => e.id === entryId);
  if (!entry) return;
  unmark(entry.billId);
  await addToBlacklist(entry.billId, entry.txnId);
  await updateActivity(entryId, { kind: "undone" });
}

/** Marks a SUGGESTION as confirmed and applies the mark-paid. */
export async function confirmSuggestion(
  entryId: string,
  markPaid: (billId: string) => void,
): Promise<void> {
  const log = await loadActivity();
  const entry = log.find((e) => e.id === entryId);
  if (!entry || entry.kind !== "suggested") return;
  markPaid(entry.billId);
  await updateActivity(entryId, { kind: "confirmed" });
}

export interface ScanOptions {
  /** Bill payload that we're trying to match against — pass {id, provider, amount}. */
  bills: Array<{ id: string; provider: string; amount: number }>;
  currency: string;
  /** How many days back to check. Default 45. */
  lookbackDays?: number;
  /** Toggle: send notifications for medium / high suggestions. */
  suggestEnabled: boolean;
  /** Toggle: auto-mark on high-confidence + send "Marked. Undo?" notif. */
  autoMarkEnabled: boolean;
  /** Mark-paid callback — wired to the JudithStore action. */
  markPaid: (billId: string) => void;
}

export interface ScanResult {
  totalCandidates: number;
  autoMarked: number;
  suggested: number;
  skippedAlreadyProcessed: number;
  skippedBelowFloor: number;
  /** Raw confidence breakdown — useful for the "Scan now" debug view. */
  matches: Array<{
    billId: string;
    provider: string;
    confidence: number;
    bucket: "high-auto" | "high-suggest" | "medium-suggest" | "drop";
  }>;
}

/**
 * Run a scan against the user's bills. This is the single entry point used by
 * both the manual "Scan now" button (Settings) and the future background
 * task. Returns a breakdown so the caller can render a summary.
 */
export async function scanAndApply(opts: ScanOptions): Promise<ScanResult> {
  const result: ScanResult = {
    totalCandidates: 0,
    autoMarked: 0,
    suggested: 0,
    skippedAlreadyProcessed: 0,
    skippedBelowFloor: 0,
    matches: [],
  };

  const apiResult = await findRecentBillPaymentMatches(
    opts.bills,
    opts.currency,
    opts.lookbackDays ?? 45,
  );

  let matchesToProcess = apiResult.matches;

  if (!apiResult.supported || apiResult.authorizationStatus !== "authorized") {
    // Dev-only fallback so PH iPhones (no Apple Card, no FK eligibility)
    // can exercise the suggest / auto-mark / notification flow end-to-end.
    // Stripped from production via __DEV__ — Release / App Store builds
    // never reach this branch because __DEV__ is false at build time and
    // dead-code-eliminated.
    if (__DEV__ && opts.bills.length > 0) {
      matchesToProcess = makeMockMatchesForDev(opts.bills);
    } else {
      return result;
    }
  }

  for (const m of matchesToProcess) {
    result.totalCandidates += 1;

    if (m.confidence < LOW_CONF_DROP) {
      result.skippedBelowFloor += 1;
      result.matches.push({ billId: m.billId, provider: m.provider, confidence: m.confidence, bucket: "drop" });
      continue;
    }

    if (await isAlreadyProcessed(m.billId, m.transactionId)) {
      result.skippedAlreadyProcessed += 1;
      continue;
    }

    const high = m.confidence >= HIGH_CONF_THRESHOLD;

    if (high && opts.autoMarkEnabled) {
      const entry = makeEntry("auto-marked", m, opts.currency);
      await appendActivity(entry);
      opts.markPaid(m.billId);
      await scheduleNotification({
        title: `Marked ${m.provider} as paid`,
        body: `${formatMoney(opts.currency, m.amount)} cleared on your Apple Card. Tap to undo.`,
        data: { entryId: entry.id, action: "auto-mark" },
        categoryIdentifier: "AUTO_MARK_UNDO",
      });
      result.autoMarked += 1;
      result.matches.push({ billId: m.billId, provider: m.provider, confidence: m.confidence, bucket: "high-auto" });
      continue;
    }

    if (opts.suggestEnabled) {
      const entry = makeEntry("suggested", m, opts.currency);
      await appendActivity(entry);
      const title = high
        ? `${m.provider} ${formatMoney(opts.currency, m.amount)} cleared`
        : `Did you pay ${m.provider}?`;
      const body = high
        ? "Looks like this bill cleared on your Apple Card. Tap to mark paid."
        : `A ${formatMoney(opts.currency, m.amount)} charge looks like this bill. Confirm to mark paid.`;
      await scheduleNotification({
        title,
        body,
        data: { entryId: entry.id, action: "suggest" },
        categoryIdentifier: "SUGGEST_PAID",
      });
      result.suggested += 1;
      result.matches.push({
        billId: m.billId,
        provider: m.provider,
        confidence: m.confidence,
        bucket: high ? "high-suggest" : "medium-suggest",
      });
    }
  }

  return result;
}

function makeEntry(kind: ActivityKind, m: FinanceBillPaymentMatch, currency: string): ActivityEntry {
  return {
    id: `${m.billId}__${m.transactionId}__${Date.now()}`,
    ts: Date.now(),
    kind,
    billId: m.billId,
    billProvider: m.provider,
    amount: m.amount,
    currency: currency || m.currency,
    txnId: m.transactionId,
    confidence: m.confidence,
  };
}

interface NotifSpec {
  title: string;
  body: string;
  data: Record<string, unknown>;
  categoryIdentifier: string;
}

async function scheduleNotification(spec: NotifSpec): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: spec.title,
        body: spec.body,
        data: spec.data,
        categoryIdentifier: spec.categoryIdentifier,
        sound: "default",
      },
      trigger: null,
    });
  } catch {
    // Swallow — notification permissions might not be granted yet. The
    // entry is still in the Activity log so the user can act from there.
  }
}

function formatMoney(currency: string, amount: number): string {
  const rounded = Math.round(amount).toLocaleString("en-US");
  return `${currency || "$"}${rounded}`;
}

/**
 * Dev-only: generate fake FK matches against the user's first 3 bills so
 * Phase 3 (suggest / auto-mark / notification action handlers) can be
 * exercised end-to-end on a PH iPhone with no Apple Card. Confidence
 * values span the bucket boundaries (0.92 high, 0.72 medium, 0.55 low)
 * so a single Scan exercises all three paths.
 *
 * Guarded by `__DEV__` at the only call site above — Release builds dead-
 * code-eliminate this and the helper is never reached.
 */
function makeMockMatchesForDev(
  bills: Array<{ id: string; provider: string; amount: number }>,
): FinanceBillPaymentMatch[] {
  const sample = bills.slice(0, 3);
  // Synthetic txn IDs include a timestamp so two consecutive "Scan now"
  // taps in dev produce distinct activity entries (one per scan) instead
  // of being deduped by the blacklist check.
  const baseTs = Date.now();
  const confidenceLadder = [0.92, 0.72, 0.55];
  return sample.map((b, i) => ({
    billId: b.id,
    provider: b.provider,
    transactionId: `mock-${baseTs}-${i}`,
    merchantName: b.provider,
    transactionDescription: `${b.provider} (mock dev match)`,
    amount: b.amount,
    currency: "USD",
    transactionDate: new Date(baseTs - i * 86_400_000).toISOString(),
    postedDate: new Date(baseTs - i * 86_400_000).toISOString(),
    confidence: confidenceLadder[i] ?? 0.7,
  }));
}
