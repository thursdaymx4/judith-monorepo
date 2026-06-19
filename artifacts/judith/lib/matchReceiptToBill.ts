/**
 * Match a scanned receipt against the user's bills.
 *
 * The matcher returns an `intent` so the UI knows what to offer:
 *   - mark_paid       — receipt amount ≈ bill outstanding → flip to paid
 *   - partial_payment — receipt amount < bill outstanding → log a partial
 *   - update_amount   — variable bill whose new statement differs from the
 *                      stored amount (e.g. electric, water) → confirm new amount
 *   - create_new      — no plausible bill matched → offer "add as new bill"
 *
 * Match weights (when a bill matched):
 *   provider fuzzy-match → required (≥ 1 shared normalized token)
 *   amount window        → ±15% of outstanding (or ±30% for variable bills)
 *   date window          → ±14 days from current cycle due
 *
 * No exact match → returns `intent: "create_new"` so the user can still log
 * the receipt, even if it doesn't tie back to any existing bill.
 */
import type { Bill } from "@/constants/data";
import { currentCycleDue } from "@/constants/data";

export type ReceiptIntent = "mark_paid" | "partial_payment" | "update_amount" | "create_new";

export interface MatchedReceipt {
  intent: ReceiptIntent;
  bill?: Bill;
  /**
   * Score the matcher gave the picked bill (0..1). Useful for the UI to
   * decide whether to default-select the match or keep the "Choose
   * manually" pill highlighted.
   */
  score: number;
}

export interface ScanInput {
  provider: string | null;
  amount: number | null;
  /** YYYY-MM-DD or null when the OCR couldn't pull a date. */
  date: string | null;
}

const AMOUNT_WINDOW_FIXED = 0.15;
const AMOUNT_WINDOW_VARIABLE = 0.3;
const DATE_WINDOW_DAYS = 14;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string): string[] {
  return normalizeText(value).split(" ").filter((t) => t.length > 1);
}

function getOutstandingAmount(bill: Bill): number {
  return Math.max(0, bill.amount + (bill.carryOver ?? 0) - (bill.amountPaid ?? 0));
}

function providerScore(receiptProvider: string, billProvider: string): number {
  const r = tokens(receiptProvider);
  const b = tokens(billProvider);
  if (r.length === 0 || b.length === 0) return 0;
  const overlap = r.filter((t) => b.some((bt) => bt === t || bt.includes(t) || t.includes(bt))).length;
  if (overlap === 0) return 0;
  // Normalize against the smaller list so a long receipt provider like "BPI
  // CREDIT CARD STATEMENT" still scores high against bill "BPI".
  return overlap / Math.min(r.length, b.length);
}

function amountScore(receiptAmount: number, bill: Bill): number {
  const outstanding = getOutstandingAmount(bill);
  // Use bill.amount as the comparison baseline when nothing's outstanding —
  // covers receipts logged AFTER the bill was already marked paid, plus the
  // initial "update variable amount" case.
  const baseline = outstanding > 0 ? outstanding : bill.amount;
  if (baseline <= 0) return 0;
  const ratio = receiptAmount / baseline;
  const window = bill.kind === "Variable" ? AMOUNT_WINDOW_VARIABLE : AMOUNT_WINDOW_FIXED;
  const drift = Math.abs(ratio - 1);
  if (drift > window) return 0;
  // Linear falloff: perfect match = 1, edge of window = 0.
  return 1 - drift / window;
}

function dateScore(receiptDate: string | null, bill: Bill, today: Date): number {
  if (!receiptDate) return 0.4; // No date — neutral signal, don't block the match
  const parsed = new Date(receiptDate);
  if (Number.isNaN(parsed.getTime())) return 0.4;
  const { dueDays } = currentCycleDue(bill, today);
  // Days between the receipt and today's due offset. dueDays=-3 means due was
  // 3 days ago; if the receipt is dated 3 days ago that's a perfect match.
  const receiptDaysFromToday = Math.round(
    (parsed.getTime() - today.getTime()) / 86_400_000,
  );
  const distance = Math.abs(receiptDaysFromToday - dueDays);
  if (distance > DATE_WINDOW_DAYS) return 0;
  return 1 - distance / DATE_WINDOW_DAYS;
}

/**
 * Pick the best bill for the receipt and infer what action the user
 * probably wants. Falls back to `create_new` when nothing scores high
 * enough — never invents a match.
 */
export function matchReceiptToBill(
  scan: ScanInput,
  bills: Bill[],
  today: Date = new Date(),
): MatchedReceipt {
  if (!scan.provider && !scan.amount) {
    return { intent: "create_new", score: 0 };
  }

  let best: { bill: Bill; score: number } | null = null;

  for (const bill of bills) {
    if (bill.status === "paid" && bill.frequency === "once") continue;

    const pScore = scan.provider ? providerScore(scan.provider, bill.provider) : 0;
    if (pScore <= 0) continue; // Provider must overlap — receipts without a
                               // recognizable merchant fall through to create_new

    const aScore = scan.amount ? amountScore(scan.amount, bill) : 0;
    const dScore = dateScore(scan.date, bill, today);
    // Provider is the strongest signal (matched merchant on a receipt is
    // ≈ 90% of "this is the right bill"), amount confirms, date adjudicates
    // ties between two same-named cards/bills.
    const combined = pScore * 0.6 + aScore * 0.3 + dScore * 0.1;

    if (!best || combined > best.score) {
      best = { bill, score: combined };
    }
  }

  if (!best || best.score < 0.4) {
    return { intent: "create_new", score: best?.score ?? 0 };
  }

  const bill = best.bill;
  const outstanding = getOutstandingAmount(bill);
  const receiptAmount = scan.amount ?? 0;

  // Variable bills (electricity, water, credit card statement) — if the
  // amount differs noticeably from the stored amount, the user is logging
  // their new statement, not a payment. Prompt to update the amount first.
  if (
    bill.kind === "Variable" &&
    receiptAmount > 0 &&
    bill.amount > 0 &&
    Math.abs(receiptAmount - bill.amount) / bill.amount > 0.05 &&
    outstanding <= 0
  ) {
    return { intent: "update_amount", bill, score: best.score };
  }

  if (receiptAmount > 0 && outstanding > 0 && receiptAmount < outstanding * 0.9) {
    return { intent: "partial_payment", bill, score: best.score };
  }

  return { intent: "mark_paid", bill, score: best.score };
}
