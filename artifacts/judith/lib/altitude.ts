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

  let monthlyBills = 0;
  for (const b of bills) {
    monthlyBills += billMonthlyEquivalent(b, today);
  }

  const r = monthlyBills / monthlyIncome;
  if (r < 0.20) return 10;
  if (r < 0.32) return 9;
  if (r < 0.45) return 8;
  if (r < 0.58) return 7;
  if (r < 0.72) return 6;
  if (r < 0.88) return 5; // waterline
  if (r < 0.98) return 4;
  if (r < 1.08) return 3;
  if (r < 1.25) return 2;
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
