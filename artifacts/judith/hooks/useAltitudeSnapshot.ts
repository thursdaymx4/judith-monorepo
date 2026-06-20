/**
 * Monthly altitude snapshot recorder.
 *
 * Fires on app foreground. Compares the current month key against the
 * most recent entry in the persisted history:
 *   - same month: upsert today's grade (fresh data → fresh number, same row)
 *   - new month:  append a new entry and stamp any milestone the user
 *                 newly crossed since the last snapshot
 *
 * Returns the live history + the latest level so screens can render
 * without re-loading themselves.
 */
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useJudith } from "@/contexts/JudithStore";
import {
  climbStreak,
  effectiveMonthlyIncome,
  gradeLevel,
  loadHistory,
  monthKey,
  type MonthGrade,
  newlyCrossedMilestone,
  saveHistory,
  upsertMonth,
} from "@/lib/altitude";

export interface AltitudeSnapshot {
  history: MonthGrade[];
  /** Latest stored level (1..10). Defaults to a fresh grade when there's no history yet. */
  level: number;
  /** Length of the consecutive-improving streak. */
  streak: number;
  /** True until the first hydration completes — screens can show a skeleton in the meantime. */
  loading: boolean;
}

export function useAltitudeSnapshot(): AltitudeSnapshot {
  const { bills, monthlyIncome, incomeByMonth } = useJudith();
  const [history, setHistory] = useState<MonthGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  /** Run a snapshot pass: re-grade the current month and persist. Idempotent
   *  within a calendar month. */
  const recordNow = async (existing: MonthGrade[]): Promise<MonthGrade[]> => {
    const today = new Date();
    const key = monthKey(today);
    const income = effectiveMonthlyIncome(monthlyIncome, incomeByMonth, today);
    const level = gradeLevel(bills, income, today);

    const previous = existing.length > 0 ? existing[existing.length - 1]! : undefined;
    // If this is a fresh month, check whether a milestone was newly crossed.
    const isNewMonth = !previous || previous.month !== key;
    const milestone = isNewMonth && previous
      ? newlyCrossedMilestone(previous.level, level)?.id
      : undefined;

    const snapshot: MonthGrade = {
      month: key,
      level,
      milestone,
      recordedAt: today.toISOString(),
    };
    const next = upsertMonth(existing, snapshot);
    await saveHistory(next);
    return next;
  };

  // Initial hydrate + first snapshot pass.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadHistory();
      if (cancelled) return;
      const next = await recordNow(loaded);
      if (cancelled) return;
      setHistory(next);
      setLoading(false);
      initializedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run on app foreground so a snapshot eventually lands the moment the
  // user opens Judith on the first day of a new month, even if they were
  // backgrounded across midnight.
  useEffect(() => {
    const handler = async (state: AppStateStatus) => {
      if (state !== "active" || !initializedRef.current) return;
      const next = await recordNow(history);
      setHistory(next);
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, monthlyIncome, incomeByMonth, history]);

  const latest = history.length > 0 ? history[history.length - 1]!.level : 1;
  return {
    history,
    level: latest,
    streak: climbStreak(history),
    loading,
  };
}
