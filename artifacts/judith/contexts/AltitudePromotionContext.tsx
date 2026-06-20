/**
 * Cross-screen promotion event bus. The snapshot recorder pushes a
 * "promoted" event when the current month's level ends up higher than the
 * previous month's, and the League screen listens to render the
 * PromotionOverlay.
 *
 * Persists "seen" markers per calendar month so reopening the app inside
 * the same month doesn't re-fire the celebration.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { hasSeenPromotion, markPromotionSeen, tierForLevel } from "@/lib/altitude";

export interface PendingPromotion {
  /** Calendar month the promotion happened in ("YYYY-MM"). */
  month: string;
  from: number;
  to: number;
  /** True when the division (tier) also changed — drives bigger fanfare. */
  isTierChange: boolean;
}

interface AltitudePromotionValue {
  pending: PendingPromotion | null;
  /** Called by the snapshot recorder when a new higher level is written. */
  notifyPromotion: (p: PendingPromotion) => Promise<void>;
  dismiss: () => Promise<void>;
}

const PromotionCtx = createContext<AltitudePromotionValue | null>(null);

export function AltitudePromotionProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingPromotion | null>(null);

  const notifyPromotion = useCallback(async (p: PendingPromotion) => {
    // Don't replay a celebration the user already saw this calendar month.
    if (await hasSeenPromotion(p.month)) return;
    setPending(p);
  }, []);

  const dismiss = useCallback(async () => {
    const current = pending;
    setPending(null);
    if (current) await markPromotionSeen(current.month);
  }, [pending]);

  const value = useMemo(
    () => ({ pending, notifyPromotion, dismiss }),
    [pending, notifyPromotion, dismiss],
  );

  return <PromotionCtx.Provider value={value}>{children}</PromotionCtx.Provider>;
}

export function useAltitudePromotion(): AltitudePromotionValue {
  const ctx = useContext(PromotionCtx);
  if (!ctx) {
    // Defensive no-op so non-tree consumers don't crash.
    return {
      pending: null,
      notifyPromotion: async () => {},
      dismiss: async () => {},
    };
  }
  return ctx;
}

/** True iff levels from→to cross a tier boundary. */
export function isTierChange(from: number, to: number): boolean {
  return tierForLevel(from).id !== tierForLevel(to).id;
}
