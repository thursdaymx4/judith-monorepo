/**
 * Financial Altitude — Judith's 10-level gamified grade of a user's
 * bills-vs-income standing, recorded monthly and surfaced as a "climb"
 * timeline.
 *
 * The number itself is never shown to the user. UI consumes only:
 *   - the level (1..10)
 *   - the rank (e.g. "Cruising")
 *   - the tier / division (e.g. "On Solid Ground")
 *
 * Spec source: `Financial Altitude - SwiftUI Build Guide.md`. Colors, copy,
 * ratio bands, and milestone unlocks track the spec verbatim.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Bill } from "@/constants/data";

// ─── Levels ───────────────────────────────────────────────────────────────────

export interface AltitudeLevel {
  n: number;          // 1..10
  rank: string;       // "Cruising"
  short: string;      // one-line status
  line: string;       // encouraging paragraph
  color: string;      // signature hex
}

export const LEVELS: AltitudeLevel[] = [
  { n: 1,  rank: "Lost at Sea",       short: "Drowning in bills",       line: "Every peso is spoken for before it lands. You're in deep — but this is the bottom, and the only way from here is up.",                       color: "#7B83E0" },
  { n: 2,  rank: "Underwater",        short: "Bills outrun income",     line: "Bills are bigger than what comes in. We'll turn it around, one due date at a time.",                                                              color: "#6F86DF" },
  { n: 3,  rank: "Going Under",       short: "Sinking, but fighting",   line: "Still below the line — but the surface is in sight now. Keep kicking.",                                                                          color: "#4F9BD8" },
  { n: 4,  rank: "Almost Surfacing",  short: "Reaching for air",        line: "So close to air. One or two bills lighter and you break through.",                                                                                color: "#36ABCE" },
  { n: 5,  rank: "Treading Water",    short: "Paycheck to paycheck",    line: "You're staying afloat — money in, money out, nothing spare. The hard part's behind you. Now let's get ahead.",                                   color: "#1FC2CC" },
  { n: 6,  rank: "Finding Your Feet", short: "A little breathing room", line: "On solid ground. Bills no longer run the show — you've got room to move.",                                                                        color: "#22C98E" },
  { n: 7,  rank: "Cruising",          short: "Comfortable margin",      line: "Your money moves at your pace now. Bills are handled long before they're due.",                                                                   color: "#3CCD72" },
  { n: 8,  rank: "Open Road",         short: "Real headroom",           line: "Bills are a small part of your month. Most of what you earn is yours to steer.",                                                                  color: "#74CF45" },
  { n: 9,  rank: "Taking Off",        short: "Lifting off",             line: "You're climbing. Freedom from bills isn't a someday — it's right in view.",                                                                       color: "#D9BF3A" },
  { n: 10, rank: "Sky Clear",         short: "Bills don't make a dent", line: "Your bills barely register against what you make. The sky is yours.",                                                                             color: "#F3B62F" },
];

export function levelMeta(n: number): AltitudeLevel {
  const clamped = Math.max(1, Math.min(10, Math.round(n)));
  return LEVELS[clamped - 1]!;
}

// ─── Divisions / Tiers ────────────────────────────────────────────────────────

export type TierId = "depths" | "rising" | "afloat" | "ground" | "air" | "free";

export interface Tier {
  id: TierId;
  name: string;
  color: string;      // signature
  light: string;      // gradient stop (top of shield + glow)
  range: [number, number]; // inclusive
  repLevel: number;   // representative level for the neighbor preview
}

export const TIERS: Tier[] = [
  { id: "depths", name: "The Depths",       color: "#7B83E0", light: "#C2C7F7", range: [1, 2],  repLevel: 1  },
  { id: "rising", name: "Coming Up",        color: "#3F95D6", light: "#A8D4F4", range: [3, 4],  repLevel: 3  },
  { id: "afloat", name: "Afloat",           color: "#1FC2CC", light: "#8FF0F4", range: [5, 5],  repLevel: 5  },
  { id: "ground", name: "On Solid Ground",  color: "#22C98E", light: "#92EDC7", range: [6, 7],  repLevel: 7  },
  { id: "air",    name: "Open Air",         color: "#74CF45", light: "#CDF0A2", range: [8, 8],  repLevel: 8  },
  { id: "free",   name: "Free & Clear",     color: "#F3B62F", light: "#FFE9A6", range: [9, 10], repLevel: 10 },
];

export function tierForLevel(level: number): Tier {
  const n = Math.max(1, Math.min(10, Math.round(level)));
  return TIERS.find((t) => n >= t.range[0] && n <= t.range[1])!;
}

export interface PromotionTarget {
  tier: Tier;
  toGo: number;       // levels needed to reach the next division
  frac: number;       // 0..1 progress through current tier toward the next
}

export function nextTier(level: number): PromotionTarget | null {
  const cur = tierForLevel(level);
  const idx = TIERS.findIndex((t) => t.id === cur.id);
  if (idx === -1 || idx === TIERS.length - 1) return null;
  const next = TIERS[idx + 1]!;
  const toGo = next.range[0] - level;
  // Fraction through the current tier's range.
  const span = next.range[0] - cur.range[0];
  const frac = span > 0 ? (level - cur.range[0]) / span : 0;
  return { tier: next, toGo: Math.max(0, toGo), frac: Math.min(1, Math.max(0, frac)) };
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  at: number;         // unlocks when level >= at
  name: string;
  desc: string;
}

export const MILESTONES: Milestone[] = [
  { id: "air",     at: 4,  name: "Came up for air",         desc: "Reached Level 4" },
  { id: "surface", at: 5,  name: "Reached the surface",     desc: "Treading water" },
  { id: "line",    at: 6,  name: "Broke the paycheck line", desc: "Got ahead of bills" },
  { id: "road",    at: 8,  name: "Hit the open road",       desc: "Reached Level 8" },
  { id: "sky",     at: 10, name: "Sky clear",               desc: "Total freedom" },
];

export function unlockedMilestones(level: number): Milestone[] {
  return MILESTONES.filter((m) => level >= m.at);
}

/** First-time crossing detection — returns the milestone if `now` crossed it
 *  AND `prev` had not. Used to stamp `MonthGrade.milestone`. */
export function newlyCrossedMilestone(prev: number, now: number): Milestone | null {
  if (now <= prev) return null;
  for (const m of MILESTONES) {
    if (prev < m.at && now >= m.at) return m;
  }
  return null;
}

// ─── Nudges ───────────────────────────────────────────────────────────────────

export const NUDGES: Record<number, string> = {
  1: "Catch up one overdue bill to start rising off the floor.",
  2: "Clear your smallest bill first — momentum starts there.",
  3: "Trim one recurring cost and the surface gets closer.",
  4: "One fewer bill this month and you break through to air.",
  5: "Free up a little breathing room each month to get ahead.",
  6: "Hold this two more months to lock in Cruising.",
  7: "Trim a forgotten subscription and the open road appears.",
  8: "Widen the gap between earning and owing — you'll start to climb.",
  9: "A touch more headroom and the whole sky opens up.",
  10: "You're at the summit. Hold steady and enjoy the view.",
};

// ─── Grading math ─────────────────────────────────────────────────────────────

/**
 * Translate a bill into its monthly-equivalent contribution. Annual bills
 * spread across 12 months; "once" bills are amortized over the 12 months
 * around their due date. Child credit-card subscriptions (those with a
 * parentCardId) are excluded — they're already represented in the parent
 * card's statement amount, double-counting would unfairly suppress the
 * grade.
 */
function billMonthlyEquivalent(bill: Bill, today: Date): number {
  if (bill.parentCardId) return 0; // rolled up into parent card statement

  const baseAmount = Math.max(0, bill.amount + (bill.carryOver ?? 0));
  if (baseAmount <= 0) return 0;

  switch (bill.frequency) {
    case "annual":
      return baseAmount / 12;
    case "once": {
      // Smear a one-time payment across the 12 months ending on its due
      // date — keeps a big one-time bill from dominating one month's grade.
      // After the due date, it stops counting entirely.
      const due = parseDueDate(bill, today);
      if (!due) return baseAmount / 12;
      const monthsAway = monthsBetween(today, due);
      if (monthsAway < 0) return 0; // already past, no longer a drag
      if (monthsAway > 12) return baseAmount / 12; // far future, light load
      return baseAmount / 12;
    }
    case "monthly":
    default:
      return baseAmount;
  }
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Best-effort parse of the bill's calendar due date for the current cycle.
 *  Falls back to null when the bill's stored fields aren't enough. */
function parseDueDate(bill: Bill, today: Date): Date | null {
  if (typeof bill.dueDate !== "number") return null;
  const month = today.getMonth();
  const year = today.getFullYear();
  const candidate = new Date(year, month, Math.min(28, bill.dueDate));
  // If we're past the due day this month, the next occurrence is next month.
  if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

/**
 * Bills-to-income bands (lower bound, exclusive). Index = level - 1.
 *
 * Re-tuned 2026-06-20 because the original spec mapped "44% of income going
 * to bills" to Level 8 / Open Road, which doesn't survive a sanity check:
 * after ~20% taxes and ~15% essentials (food, transport), a household at
 * 44% bills has ~21% headroom — comfortable, not "real headroom".
 *
 * The new bands anchor against the standard 28/36 housing-DTI rule and
 * HUD's rent-burden thresholds, then extend them to cover all fixed bills:
 *
 *   <12%  Sky Clear     — bills barely register; massive savings room
 *   <18%  Taking Off    — generous headroom; investing comfortably
 *   <25%  Open Road     — well below the 28% housing-only benchmark
 *   <33%  Cruising      — at the 36% all-debt-DTI threshold
 *   <42%  Finding Feet  — around the middle-class median for fixed bills
 *   <55%  Treading H₂O  — paycheck-to-paycheck waterline
 *   <70%  Almost Up     — tight, but not negative cash flow yet
 *   <85%  Going Under   — only 15% buffer for everything else
 *  <100%  Underwater    — negative cash flow after taxes/food
 *   ≥100% Lost at Sea   — fixed bills alone exceed income
 *
 * The Level 5 waterline (55%) is the meaningful inflection — below it
 * there's room to save, above it the household is stretched.
 */
export const RATIO_BANDS: { level: number; upTo: number; label: string }[] = [
  { level: 10, upTo: 0.12, label: "under 12%" },
  { level: 9,  upTo: 0.18, label: "12–17%" },
  { level: 8,  upTo: 0.25, label: "18–24%" },
  { level: 7,  upTo: 0.33, label: "25–32%" },
  { level: 6,  upTo: 0.42, label: "33–41%" },
  { level: 5,  upTo: 0.55, label: "42–54%" }, // waterline
  { level: 4,  upTo: 0.70, label: "55–69%" },
  { level: 3,  upTo: 0.85, label: "70–84%" },
  { level: 2,  upTo: 1.00, label: "85–99%" },
  { level: 1,  upTo: Infinity, label: "100%+" },
];

/** Sum of bill monthly-equivalents — exposed so the explainer sheet can
 *  show the user the ratio that drove their grade. */
export function totalMonthlyBills(bills: Bill[], today: Date = new Date()): number {
  let total = 0;
  for (const b of bills) total += billMonthlyEquivalent(b, today);
  return total;
}

/** Ratio that drove the grade. Returns null when income isn't set so the
 *  UI can render "Set your income" instead of a misleading 100%+. */
export function billsToIncomeRatio(
  bills: Bill[],
  monthlyIncome: number | undefined,
  today: Date = new Date(),
): number | null {
  if (!monthlyIncome || monthlyIncome <= 0) return null;
  return totalMonthlyBills(bills, today) / monthlyIncome;
}

/**
 * Compute the level (1..10) from bills + income. Pure function — input
 * snapshot only, no I/O. Returns 1 when income is absent or zero (we don't
 * have enough information to judge — pessimistic default is safer than
 * inventing a flattering one).
 */
export function gradeLevel(
  bills: Bill[],
  monthlyIncome: number | undefined,
  today: Date = new Date(),
): number {
  if (!monthlyIncome || monthlyIncome <= 0) return 1;
  const r = totalMonthlyBills(bills, today) / monthlyIncome;
  for (const band of RATIO_BANDS) {
    if (r < band.upTo) return band.level;
  }
  return 1;
}

/**
 * Effective monthly income for grading: current-month override if set,
 * otherwise the default `monthlyIncome`. Mirrors how the rest of Judith
 * reads income.
 */
export function effectiveMonthlyIncome(
  monthlyIncome: number | undefined,
  incomeByMonth: Record<string, number> | undefined,
  today: Date = new Date(),
): number | undefined {
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const override = incomeByMonth?.[key];
  if (typeof override === "number" && override > 0) return override;
  return monthlyIncome;
}

// ─── History persistence ──────────────────────────────────────────────────────

export interface MonthGrade {
  /** "YYYY-MM" — the calendar month this grade represents. */
  month: string;
  level: number;
  /** Optional milestone id newly crossed when this snapshot was recorded. */
  milestone?: string;
  /** ISO timestamp the snapshot was written. */
  recordedAt: string;
}

const HISTORY_KEY = "judith.altitude.history";

export async function loadHistory(): Promise<MonthGrade[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is MonthGrade =>
        m != null &&
        typeof (m as MonthGrade).month === "string" &&
        typeof (m as MonthGrade).level === "number",
      )
      .sort((a, b) => a.month.localeCompare(b.month));
  } catch {
    return [];
  }
}

export async function saveHistory(history: MonthGrade[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Best-effort. If storage fails the next snapshot will rewrite.
  }
}

/**
 * Upsert a snapshot for `month` into the history. If a snapshot already
 * exists for that month, overwrite it (the user just opened the app and
 * we re-graded — same calendar month, fresh number).
 */
export function upsertMonth(history: MonthGrade[], snapshot: MonthGrade): MonthGrade[] {
  const filtered = history.filter((m) => m.month !== snapshot.month);
  return [...filtered, snapshot].sort((a, b) => a.month.localeCompare(b.month));
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * Consecutive months holding or improving, counting back from the newest
 * recorded month. Always ≥ 1 when history is non-empty.
 */
export function climbStreak(history: MonthGrade[]): number {
  if (history.length === 0) return 0;
  if (history.length === 1) return 1;
  let s = 1;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i]!.level >= history[i - 1]!.level) s += 1;
    else break;
  }
  return s;
}

/** Net level gain since the start of the recorded history. Can be negative. */
export function totalClimb(history: MonthGrade[]): number {
  if (history.length < 2) return 0;
  return history[history.length - 1]!.level - history[0]!.level;
}

// ─── Promotion tracking ──────────────────────────────────────────────────────

const PROMO_SEEN_KEY_PREFIX = "judith.altitude.promotionSeen.";

export async function hasSeenPromotion(month: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PROMO_SEEN_KEY_PREFIX + month);
    return v === "1";
  } catch {
    return false;
  }
}

export async function markPromotionSeen(month: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMO_SEEN_KEY_PREFIX + month, "1");
  } catch {
    // Best-effort. If it fails, the worst case is one extra celebration
    // on next launch — annoying, not broken.
  }
}
