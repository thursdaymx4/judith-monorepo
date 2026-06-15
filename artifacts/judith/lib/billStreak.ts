/**
 * Per-bill on-time streak calculation.
 *
 * Streak = consecutive months (for monthly bills) or years (for annual bills)
 * the bill was paid on or before its due date. A late or missed cycle resets it.
 *
 * One-time bills don't get streaks — they're non-recurring by definition.
 * Via-card bills don't get streaks either — they're auto-paid through their
 * parent card, so the streak belongs to the card, not the linked charge.
 */
import type { Bill, BillCycleRecord } from "@/constants/data";

export type MonthStatus = "onTime" | "late" | "missed" | "untracked";

export interface BillStreak {
  /** Consecutive on-time cycles, counting back from the latest closed cycle. */
  currentMonths: number;
  /** Best streak ever achieved on this bill. */
  bestMonths: number;
  /** Consecutive calendar years with zero late payments (annual rollup). */
  yearStreak: number;
  /** Lifetime on-time rate (0..1) across closed cycles. */
  onTimeRate: number;
  /** Last 12 months of monthly cycles, oldest first → newest last. */
  monthStatuses: MonthStatus[];
  /** Last 5 calendar years for annual bills, oldest first → newest last. */
  yearStatuses: MonthStatus[];
  /** Total closed cycles considered. */
  closedCycles: number;
}

const EMPTY: BillStreak = {
  currentMonths: 0,
  bestMonths: 0,
  yearStreak: 0,
  onTimeRate: 0,
  monthStatuses: [],
  yearStatuses: [],
  closedCycles: 0,
};

/**
 * Does this bill qualify for a streak? Monthly + annual yes, "once" no.
 * Via-card charges also opt out — their streak belongs to the parent card.
 */
export function isStreakEligible(b: Pick<Bill, "frequency" | "chargedToCard">): boolean {
  if (b.frequency === "once") return false;
  if (b.chargedToCard) return false;
  return true;
}

/**
 * Classify a closed cycle record. `null` paid = missed (closed without
 * full payment), `true` = on time, `false` = late.
 */
function classify(r: BillCycleRecord): MonthStatus {
  if (r.onTime === true) return "onTime";
  if (r.onTime === false) return "late";
  return "missed";
}

/** "YYYY-MM" → ms epoch of the 1st of that month. Used for chronological sort. */
function periodKey(period: string): number {
  const [y, m] = period.split("-").map(Number);
  if (!y) return 0;
  return new Date(y, (m ?? 1) - 1, 1).getTime();
}

/**
 * Compute streak for a single bill from its paymentHistory.
 *
 * Monthly bills: months back from most-recent cycle.
 * Annual bills: years back from most-recent cycle (each year is one cycle).
 *
 * Returns EMPTY when the bill isn't streak-eligible or has no history yet.
 */
export function computeBillStreak(b: Bill, today: Date = new Date()): BillStreak {
  if (!isStreakEligible(b)) return EMPTY;
  const history = (b.paymentHistory ?? []).slice().sort(
    (a, c) => periodKey(a.period) - periodKey(c.period),
  );
  if (history.length === 0) return EMPTY;

  const isAnnual = b.frequency === "annual";
  const statuses = history.map(classify);

  // Current streak: walk from newest backwards until we hit a non-onTime.
  let currentMonths = 0;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] === "onTime") currentMonths++;
    else break;
  }

  // Best streak: longest run of onTime in the timeline.
  let bestMonths = 0;
  let run = 0;
  for (const s of statuses) {
    if (s === "onTime") {
      run++;
      if (run > bestMonths) bestMonths = run;
    } else {
      run = 0;
    }
  }

  const onTimeCount = statuses.filter((s) => s === "onTime").length;
  const onTimeRate = onTimeCount / statuses.length;

  // Year streak: consecutive calendar years with zero late/missed cycles,
  // counting back from this year (or the latest year on record).
  const lateYearSet = new Set<number>();
  const presentYears = new Set<number>();
  for (let i = 0; i < history.length; i++) {
    const yr = Number(history[i]!.period.split("-")[0]);
    if (!yr) continue;
    presentYears.add(yr);
    if (statuses[i] !== "onTime") lateYearSet.add(yr);
  }
  let yearStreak = 0;
  for (let yr = today.getFullYear(); yr >= today.getFullYear() - 50; yr--) {
    if (!presentYears.has(yr)) break;
    if (lateYearSet.has(yr)) break;
    yearStreak++;
  }

  // Trailing 12 months (or 5 years) for the visual grid.
  const trailing12: MonthStatus[] = [];
  if (!isAnnual) {
    // Build the last 12 month-keys ending at today.
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const rec = history.find((r) => r.period === key);
      trailing12.push(rec ? classify(rec) : "untracked");
    }
  }
  const trailing5: MonthStatus[] = [];
  if (isAnnual) {
    for (let i = 4; i >= 0; i--) {
      const yr = today.getFullYear() - i;
      const rec = history.find((r) => r.period.startsWith(`${yr}`));
      trailing5.push(rec ? classify(rec) : "untracked");
    }
  }

  return {
    currentMonths,
    bestMonths,
    yearStreak,
    onTimeRate,
    monthStatuses: trailing12,
    yearStatuses: trailing5,
    closedCycles: history.length,
  };
}
