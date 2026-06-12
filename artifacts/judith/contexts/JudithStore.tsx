import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadFromICloud, saveToICloud } from "@/lib/icloud-backup";
import { parseProtectedObject, serializeProtectedObject } from "@/lib/securePersist";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { formatMoney, isPaidViaCard, totalOwed, type Bill, type BillCycleRecord } from "@/constants/data";
import { DEMO_PRESET } from "@/constants/demoData";
import { DEMO_ACCOUNTS } from "@/constants/demoAccounts";
import {
  countryByCode,
  DEFAULT_COUNTRY,
  type Country,
} from "@/constants/countries";
import type { PersonaId } from "@/constants/personas";
import type { AccentId, ThemeName } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY_BASE = "judith_store_v1";
function storageKeyForUser(userId: string | null | undefined): string {
  return userId ? `${STORAGE_KEY_BASE}_${userId}` : STORAGE_KEY_BASE;
}
const FREE_ASKS = 8;

function _daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Compute a bill's "natural" billing period fresh from its stored dueDate
 * (day-of-month), never from the stale dueDays field.
 *
 * Rules:
 *   today.date < dueDay  → due later this month → this month's period
 *   today.date >= dueDay → due date has passed this month:
 *     – if this month is already paid → advance to next month
 *     – otherwise → this month (overdue or due today)
 */
function computeNaturalPeriod(
  b: Pick<Bill, "dueDate" | "paymentHistory">,
  today: Date,
): string {
  const todayDay = today.getDate();
  const dueDay = b.dueDate ?? 1;
  const yr = today.getFullYear();
  const mo = today.getMonth();
  const thisMonth = `${yr}-${String(mo + 1).padStart(2, "0")}`;
  if (todayDay < dueDay) return thisMonth;
  const thisMonthPaid = (b.paymentHistory ?? []).some(
    (r) => r.period === thisMonth && r.paid >= r.totalDue,
  );
  if (thisMonthPaid) {
    const next = new Date(yr, mo + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  }
  return thisMonth;
}

/** free = 8 trial asks; chat = unlimited text asks; voice = unlimited text + voice asks */
export type AskTier = "free" | "chat" | "voice";

/** A single message in the Ask Judith chat history. */
export interface AskMsg {
  role: "user" | "judith";
  text: string;
  flagged?: boolean;
}

export interface Toggles {
  dueReminders: boolean;
  widget: boolean;
  watch: boolean;
  nudges: boolean;
  /** Voice tier only: speak Judith's answers aloud. Off = text/chat reply only (e.g. in public). */
  voiceReplies: boolean;
}

interface PersistShape {
  bills: Bill[];
  asksLeft: number;
  tier: AskTier;
  /** What Judith calls the user (collected in onboarding). */
  name: string;
  persona: PersonaId;
  voiceId: string;
  /** BCP-47-ish language code for Judith's spoken language (en, fil, es, id, vi). */
  language: string;
  theme: ThemeName;
  accent: AccentId;
  countryCode: string;
  /** Currency symbol used for all amount display (independent of countryCode — no conversion applied). */
  currency: string;
  toggles: Toggles;
  /** Accessibility: disable non-essential animation (instant states). */
  reduceMotion: boolean;
  /** Security: require biometric/PIN unlock for the app. */
  faceIdLock: boolean;
  onboarded: boolean;
  /** Onboarding resume index (saved from step `intro` onward). */
  onbIdx: number;
  /** Dev/testing bypass: skip Supabase auth and enter the app as a guest. */
  guest: boolean;
  /** Estimated monthly take-home income (used by Judith to answer budget questions). */
  monthlyIncome?: number;
  /**
   * Per-month income overrides keyed by "YYYY-MM".
   * When set for a month, that value takes priority over `monthlyIncome`.
   * Useful for freelancers / commission-based earners whose income varies.
   */
  incomeByMonth: Record<string, number>;
  /** How often the user gets paid — monthly, semi-monthly (twice a month), or weekly. */
  payCycle: "monthly" | "semi-monthly" | "weekly";
  /** Day of month for monthly pay cycle: 1–30, or 31 meaning "last day of month". */
  paydayDay?: number;
  /** Two days of month for semi-monthly pay cycle, e.g. [15, 30]. */
  paydaySemi?: [number, number];
  /** Day of week for weekly pay cycle: 0 = Sunday … 6 = Saturday. */
  paydayWeekday?: number;
  /** Persisted Ask Judith chat history (last 100 messages). */
  askHistory: AskMsg[];
  /** User-created template questions shown first in the quick-ask chip strip. */
  customQuestions: string[];
}

const DEFAULTS: PersistShape = {
  bills: [],
  asksLeft: FREE_ASKS,
  tier: "free",
  name: "",
  persona: "pro",
  voiceId: "rachel",
  language: "en",
  theme: "system",
  accent: "mint",
  countryCode: DEFAULT_COUNTRY.code,
  currency: DEFAULT_COUNTRY.cur,
  toggles: { dueReminders: true, widget: true, watch: true, nudges: true, voiceReplies: true },
  reduceMotion: false,
  faceIdLock: false,
  onboarded: false,
  onbIdx: 0,
  guest: false,
  monthlyIncome: undefined,
  incomeByMonth: {},
  payCycle: "monthly",
  paydayDay: undefined,
  paydaySemi: undefined,
  paydayWeekday: undefined,
  askHistory: [],
  customQuestions: [],
};

// ────────────────────────────────────────────────────────────────────────
// External store — single source of truth for PersistShape
//
// Background: the previous implementation kept state in `useState<PersistShape>`
// inside `JudithProvider` and exposed a single context value memoized on
// `state`. Any state mutation rebuilt the value → every consumer of
// `useJudith()` (27 files) re-rendered, including hidden background tabs.
// Marking a bill paid on Home would re-render Settings, Insights, etc.
//
// Now: the canonical state lives in a module-level `_state` variable.
// Components subscribe via `useSyncExternalStore` and only re-render when
// the snapshot they selected actually changes. Consumers using
// `useJudith()` still get the full snapshot (backward compatible). New
// consumers can use `useJudithSelect(s => s.bills)` to subscribe to one
// slice and bypass the storm.
// ────────────────────────────────────────────────────────────────────────

let _state: PersistShape = DEFAULTS;
const _listeners = new Set<() => void>();

/** Subscribe to state updates. Returns an unsubscribe fn. Reference is
 *  stable across calls — required by useSyncExternalStore. */
function _subscribe(cb: () => void): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

/** Snapshot of the current state. Reference is stable across calls;
 *  React only re-renders when this returns a different value. */
function _getSnapshot(): PersistShape {
  return _state;
}

/**
 * Apply a state update — accepts either a new full state object or a
 * functional updater. Notifies all subscribers. Skips notification if
 * the next state is referentially equal to the current one (so a no-op
 * updater doesn't cascade re-renders).
 */
function _setState(updater: PersistShape | ((s: PersistShape) => PersistShape)): void {
  const next = typeof updater === "function" ? (updater as (s: PersistShape) => PersistShape)(_state) : updater;
  if (next === _state) return;
  _state = next;
  _listeners.forEach((cb) => cb());
}

/**
 * Subscribe to a SLICE of state. Component only re-renders when the
 * selector's return value changes (by reference equality). Use this to
 * bypass the full-context re-render storm for tabs that only care about
 * a few fields.
 *
 * Selectors MUST return referentially-stable values: pick existing fields
 * (`s => s.bills`) or compute primitives (`s => s.bills.length`). Returning
 * fresh objects/arrays (`s => ({ bills: s.bills })`) will re-render on
 * every state change and React will warn.
 */
export function useJudithSelect<T>(selector: (s: PersistShape) => T): T {
  // Wrap selector so React's getSnapshot stays a stable reference even
  // as the selector closes over local vars.
  const getSelected = () => selector(_state);
  return useSyncExternalStore(_subscribe, getSelected, getSelected);
}

interface JudithStoreValue extends PersistShape {
  hydrated: boolean;
  country: Country;
  money: (n: number) => string;
  toast: string;
  showToast: (msg: string) => void;
  /* bill ops */
  togglePaid: (id: string, period?: string) => void;
  markPaid: (id: string) => void;
  markUnpaid: (id: string) => void;
  snooze: (id: string, days: number) => void;
  saveBill: (bill: Bill) => void;
  deleteBill: (id: string) => void;
  /** Record a partial (or full) cumulative payment amount for a bill. */
  payPartial: (id: string, amountPaid: number, period?: string) => void;
  /** Roll any unpaid balance forward as carryOver and reset this cycle. */
  rolloverBill: (id: string) => void;
  /**
   * Update a credit card bill to a new statement amount.
   * Resets amountPaid and carryOver to 0 — the bank has already rolled
   * any unpaid balance into the new statement figure.
   */
  updateBillAmount: (id: string, newAmount: number) => void;
  /* ask metering */
  consumeAsk: () => boolean;
  /** Returns true if the user can use voice asks (voice tier, or free with asks remaining). */
  canUseVoice: () => boolean;
  subscribe: (tier: AskTier) => void;
  addAsks: (n: number) => void;
  /* settings */
  setName: (name: string) => void;
  setFaceIdLock: (v: boolean) => void;
  setPersona: (p: PersonaId) => void;
  setVoice: (id: string) => void;
  setLanguage: (code: string) => void;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
  setAccent: (a: AccentId) => void;
  setCountry: (code: string) => void;
  /** Update the display currency symbol. No conversion is applied — amounts are unchanged. */
  setCurrency: (sym: string) => void;
  setToggle: (key: keyof Toggles, value: boolean) => void;
  setReduceMotion: (v: boolean) => void;
  /* lifecycle */
  setOnboarded: (v: boolean) => void;
  setOnbIdx: (i: number) => void;
  setGuest: (v: boolean) => void;
  setMonthlyIncome: (n: number | undefined) => void;
  /** Set or clear the income for a specific month ("YYYY-MM"). Pass undefined to remove the override. */
  setMonthIncome: (month: string, amount: number | undefined) => void;
  setPayCycle: (c: "monthly" | "semi-monthly" | "weekly") => void;
  setPaydayDay: (d: number | undefined) => void;
  setPaydaySemi: (days: [number, number] | undefined) => void;
  setPaydayWeekday: (d: number | undefined) => void;
  /** Replace the full Ask Judith chat history (capped at 100 messages). */
  setAskHistory: (msgs: AskMsg[]) => void;
  /** Clear the full Ask Judith chat history. */
  clearAskHistory: () => void;
  /** Prepend a new user-created template question (max 50). */
  addCustomQuestion: (q: string) => void;
  /** Remove a user-created template question by index. */
  deleteCustomQuestion: (index: number) => void;
  restart: () => void;
  loadDemoData: () => void;
  loadDemoAccount: (code: string) => void;
  /**
   * Manually restore the persisted store from this user's iCloud backup,
   * overwriting current local state. Returns true if a backup was found
   * and applied. Settings "Restore from iCloud" calls this after confirm.
   */
  restoreFromCloud: () => Promise<boolean>;
}

const JudithContext = createContext<JudithStoreValue | undefined>(undefined);
const JudithActionsContext = createContext<JudithStoreValue | undefined>(undefined);

export function JudithProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const storageKey = storageKeyForUser(user?.id);

  // Read the full state via useSyncExternalStore. This component still
  // re-renders on every state change (it's the source for `useJudith()`'s
  // mega-object). The win is that ONLY THIS provider + components calling
  // `useJudith()` re-render — components using `useJudithSelect(...)` for
  // a slice subscribe directly to the external store and skip this whole
  // chain. `setState` is aliased to the external store mutator so the 20+
  // existing call sites below (setState(DEFAULTS), setState((s)=>...))
  // continue to work unchanged.
  const state = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
  const setState = _setState;
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which key we last hydrated from so we re-hydrate on account switch.
  const hydratedKeyRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  // Hydrate (or re-hydrate) whenever the storage key changes (login / logout / account switch).
  useEffect(() => {
    if (hydratedKeyRef.current === storageKey) return;
    hydratedKeyRef.current = storageKey;
    let active = true;
    setHydrated(false);
    setState(DEFAULTS);

    function applyParsed(parsed: Partial<PersistShape>) {
      if ((parsed.tier as string) === "plus") parsed.tier = "chat";
      if ((parsed.tier as string) === "unlimited") parsed.tier = "voice";
      // Migration: if currency is still the PH default but the stored country was
      // changed, the user never got a currency sync (old bug). Auto-correct it.
      if (
        parsed.countryCode &&
        parsed.countryCode !== DEFAULT_COUNTRY.code &&
        (!parsed.currency || parsed.currency === DEFAULT_COUNTRY.cur)
      ) {
        parsed.currency = countryByCode(parsed.countryCode).cur;
      }
      setState({ ...DEFAULTS, ...parsed, toggles: { ...DEFAULTS.toggles, ...(parsed.toggles ?? {}) } });
    }

    AsyncStorage.getItem(storageKey)
      .then(async (raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed = await parseProtectedObject<Partial<PersistShape>>(raw);
            if (parsed) applyParsed(parsed);
          } catch {
            /* ignore corrupt */
          }
          setHydrated(true);
          return;
        }
        // Local storage empty — try restoring from iCloud (fresh install / new build).
        if (user?.id) {
          try {
            const cloud = await loadFromICloud(user.id);
            if (active && cloud) {
              applyParsed(cloud as Partial<PersistShape>);
            }
          } catch { /* best-effort */ }
        }
        if (active) setHydrated(true);
      })
      .catch(() => { if (active) setHydrated(true); });
    return () => {
      active = false;
    };
  }, [storageKey, user?.id]);

  // persist (debounced) — always write to the current user's key
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      serializeProtectedObject(state)
        .then((json) => AsyncStorage.setItem(storageKey, json))
        .catch(() => {});
      // Mirror to iCloud so the backup survives reinstalls and device switches.
      if (user?.id) saveToICloud(state, user.id).catch(() => {});
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated, storageKey, user?.id]);

  const patch = useCallback((p: Partial<PersistShape>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const mapBills = useCallback(
    (fn: (b: Bill) => Bill) => {
      setState((s) => ({ ...s, bills: s.bills.map(fn) }));
    },
    [],
  );

  const value = useMemo<JudithStoreValue>(() => {
    const country = countryByCode(state.countryCode);
    const isPaid = state.tier === "chat" || state.tier === "voice";
    // paymentHistory is the single source of truth for per-month paid status.
    // bill.status is a convenience mirror updated by togglePaid — no auto-reset needed.
    return {
      ...state,
      bills: state.bills,
      hydrated,
      country,
      money: (n: number) => formatMoney(n, state.currency),
      toast,
      showToast,
      togglePaid: (id, period) => {
        const today = new Date();
        setState((s) => {
          const target = s.bills.find((b) => b.id === id);
          if (!target) return s;
          // Direction of THIS toggle (for the target's period), so we can mirror
          // it onto a linked card: a charge paid → that much paid back on the card.
          const tCp = computeNaturalPeriod(target, today);
          const tP = period ?? tCp;
          const targetJustPaid = !(target.paymentHistory ?? []).some(
            (r) => r.period === tP && r.paid >= r.totalDue,
          );
          // A non-card charge auto-billed to a credit card mirrors onto that card:
          // marking the charge paid records a partial payment of its amount against
          // the card's statement (un-paying reverses it). Cards never cascade.
          const linkedCardId =
            target.cat !== "Credit card" && isPaidViaCard(target)
              ? target.parentCardId
              : undefined;
          const chargeAmt = target.amount;

          const bills = s.bills.map((b) => {
            if (b.id === id) {
              // Natural period is always fresh from dueDay, never stale dueDays
              const cp = computeNaturalPeriod(b, today);
              const p = period ?? cp;
              const owed = b.amount + (b.carryOver ?? 0);
              const existing = b.paymentHistory ?? [];
              const hasRecord = existing.some((r) => r.period === p && r.paid >= r.totalDue);
              let paymentHistory: BillCycleRecord[];
              if (hasRecord) {
                paymentHistory = existing.filter((r) => r.period !== p);
              } else {
                // Compute onTime from the viewed period's actual due date vs today
                const [pYr, pMo] = p.split("-").map(Number) as [number, number];
                const dueDateForPeriod = new Date(pYr, pMo - 1, Math.min(b.dueDate ?? 1, _daysInMonth(pYr, pMo - 1)));
                const record: BillCycleRecord = {
                  period: p,
                  charged: b.amount,
                  carriedIn: b.carryOver ?? 0,
                  totalDue: owed,
                  paid: owed,
                  rolledOver: 0,
                  onTime: today <= dueDateForPeriod,
                };
                paymentHistory = [record, ...existing.filter((r) => r.period !== p)].slice(0, 24);
              }
              // bill.status mirrors whether the NATURAL period is paid (recomputed after toggle)
              const newNaturalPeriod = computeNaturalPeriod({ dueDate: b.dueDate, paymentHistory }, today);
              const isCurrentPaid = paymentHistory.some((r) => r.period === newNaturalPeriod && r.paid >= r.totalDue);
              // Credit cards are a revolving balance, not a recurring charge: a
              // settled statement must STAY at zero (amountPaid kept = owed) until the
              // user enters the next statement (updateBillAmount), instead of the
              // natural period advancing and re-billing the full amount next cycle.
              // So mirror the toggled period's outcome directly for cards.
              if (b.cat === "Credit card") {
                const justPaid = !hasRecord; // added a paid record (vs. removed one when un-paying)
                return {
                  ...b,
                  status: justPaid ? "paid" as const : "due" as const,
                  amountPaid: justPaid ? owed : 0,
                  paymentHistory,
                };
              }
              return {
                ...b,
                status: isCurrentPaid ? "paid" as const : "due" as const,
                amountPaid: isCurrentPaid ? owed : 0,
                paymentHistory,
              };
            }
            // Mirror a linked charge's paid/unpaid state onto its parent card.
            // The card's outstanding is a single (current-statement) balance, so
            // only mirror toggles for the card's CURRENT statement period —
            // toggling a charge in a past/future month must not move today's
            // card balance.
            if (
              linkedCardId &&
              b.id === linkedCardId &&
              tP === computeNaturalPeriod(b, today)
            ) {
              const owedCard = totalOwed(b);
              const existingCard = b.paymentHistory ?? [];
              const cur = b.amountPaid ?? 0;
              const next = targetJustPaid
                ? Math.min(owedCard, cur + chargeAmt)
                : Math.max(0, cur - chargeAmt);
              const fullyPaid = owedCard > 0 && next >= owedCard;
              // Keep paymentHistory in lockstep with the running balance so every
              // screen (home/calendar read history first) agrees on the card state.
              let cardHistory = existingCard;
              if (fullyPaid) {
                if (!existingCard.some((r) => r.period === tP && r.paid >= r.totalDue)) {
                  const [cy, cmo] = tP.split("-").map(Number) as [number, number];
                  const dueForP = new Date(cy, cmo - 1, Math.min(b.dueDate ?? 1, _daysInMonth(cy, cmo - 1)));
                  const rec: BillCycleRecord = {
                    period: tP,
                    charged: b.amount,
                    carriedIn: b.carryOver ?? 0,
                    totalDue: owedCard,
                    paid: owedCard,
                    rolledOver: 0,
                    onTime: today <= dueForP,
                  };
                  cardHistory = [rec, ...existingCard.filter((r) => r.period !== tP)].slice(0, 24);
                }
              } else {
                // Dropped below full — clear any stale "settled" record for tP.
                cardHistory = existingCard.filter((r) => r.period !== tP);
              }
              return {
                ...b,
                amountPaid: next,
                status: fullyPaid ? ("paid" as const) : ("due" as const),
                paymentHistory: cardHistory,
              };
            }
            return b;
          });
          return { ...s, bills };
        });
      },
      markPaid: (id) => {
        const today = new Date();
        setState((s) => {
          const target = s.bills.find((b) => b.id === id);
          if (!target) return s;

          const cp = computeNaturalPeriod(target, today);
          const targetExisting = target.paymentHistory ?? [];
          if (targetExisting.some((r) => r.period === cp && r.paid >= r.totalDue)) return s;

          const linkedCardId =
            target.cat !== "Credit card" && isPaidViaCard(target)
              ? target.parentCardId
              : undefined;
          const chargeAmt = target.amount;

          const bills = s.bills.map((b) => {
            if (b.id === id) {
              const owed = b.amount + (b.carryOver ?? 0);
              const existing = b.paymentHistory ?? [];
              const [pYr, pMo] = cp.split("-").map(Number) as [number, number];
              const dueDateForPeriod = new Date(
                pYr,
                pMo - 1,
                Math.min(b.dueDate ?? 1, _daysInMonth(pYr, pMo - 1)),
              );
              const record: BillCycleRecord = {
                period: cp,
                charged: b.amount,
                carriedIn: b.carryOver ?? 0,
                totalDue: owed,
                paid: owed,
                rolledOver: 0,
                onTime: today <= dueDateForPeriod,
              };
              const paymentHistory = [record, ...existing.filter((r) => r.period !== cp)].slice(0, 24);
              const newNaturalPeriod = computeNaturalPeriod({ dueDate: b.dueDate, paymentHistory }, today);
              const isCurrentPaid = paymentHistory.some(
                (r) => r.period === newNaturalPeriod && r.paid >= r.totalDue,
              );
              return {
                ...b,
                status: isCurrentPaid ? "paid" as const : "due" as const,
                amountPaid: isCurrentPaid ? owed : 0,
                paymentHistory,
              };
            }

            if (
              linkedCardId &&
              b.id === linkedCardId &&
              cp === computeNaturalPeriod(b, today)
            ) {
              const owedCard = totalOwed(b);
              const existingCard = b.paymentHistory ?? [];
              const cur = b.amountPaid ?? 0;
              const next = Math.min(owedCard, cur + chargeAmt);
              const fullyPaid = owedCard > 0 && next >= owedCard;

              let cardHistory = existingCard.filter((r) => r.period !== cp);
              if (fullyPaid) {
                const [cy, cmo] = cp.split("-").map(Number) as [number, number];
                const dueForP = new Date(
                  cy,
                  cmo - 1,
                  Math.min(b.dueDate ?? 1, _daysInMonth(cy, cmo - 1)),
                );
                const rec: BillCycleRecord = {
                  period: cp,
                  charged: b.amount,
                  carriedIn: b.carryOver ?? 0,
                  totalDue: owedCard,
                  paid: owedCard,
                  rolledOver: 0,
                  onTime: today <= dueForP,
                };
                cardHistory = [rec, ...cardHistory].slice(0, 24);
              }

              return {
                ...b,
                amountPaid: next,
                status: fullyPaid ? ("paid" as const) : ("due" as const),
                paymentHistory: cardHistory,
              };
            }

            return b;
          });

          return { ...s, bills };
        });
      },
      markUnpaid: (id) =>
        mapBills((b) => (b.id === id ? { ...b, status: "due" as const, amountPaid: 0 } : b)),
      snooze: (id, days) =>
        mapBills((b) =>
          b.id === id ? { ...b, dueDays: b.dueDays + days } : b,
        ),
      saveBill: (bill) =>
        setState((s) => {
          const old = s.bills.find((b) => b.id === bill.id);
          // Unlink detection: a charge that WAS auto-billed to a card is no
          // longer linked to that same card (turned off, or moved to another
          // card). Its amount lived inside the card's statement total, so the
          // link removal must deduct it from that card — the now-standalone bill
          // starts counting toward totals on its own, keeping the grand total
          // consistent instead of double-counting (card still incl. it + the
          // standalone bill).
          const unlinkedCardId =
            old &&
            isPaidViaCard(old) &&
            old.parentCardId &&
            !(isPaidViaCard(bill) && bill.parentCardId === old.parentCardId)
              ? old.parentCardId
              : undefined;
          const removedAmt = old?.amount ?? 0;

          let bills = old
            ? s.bills.map((b) => (b.id === bill.id ? bill : b))
            : [...s.bills, bill];

          if (unlinkedCardId) {
            bills = bills.map((b) => {
              if (b.id !== unlinkedCardId) return b;
              const newAmount = Math.max(0, b.amount - removedAmt);
              const newOwed = newAmount + (b.carryOver ?? 0);
              // Keep amountPaid within the new (smaller) balance.
              return {
                ...b,
                amount: newAmount,
                amountPaid: Math.min(b.amountPaid ?? 0, newOwed),
              };
            });
          }

          return { ...s, bills };
        }),
      deleteBill: (id) =>
        setState((s) => ({
          ...s,
          bills: s.bills
            .filter((b) => b.id !== id)
            // Drop any "via card" link pointing at the deleted card so the
            // orphaned charge starts counting toward totals again.
            .map((b) =>
              b.parentCardId === id
                ? { ...b, chargedToCard: undefined, parentCardId: undefined }
                : b,
            ),
        })),
      payPartial: (id, amountPaid, period) => {
        const today = new Date();
        setState((s) => ({
          ...s,
          bills: s.bills.map((b) => {
            if (b.id !== id) return b;
            const cp = period ?? computeNaturalPeriod(b, today);
            const isFuture = cp > computeNaturalPeriod(b, today);
            // Future months have no carry-in
            const owed = isFuture ? b.amount : b.amount + (b.carryOver ?? 0);
            if (amountPaid >= owed) {
              const [pYr, pMo] = cp.split("-").map(Number) as [number, number];
              const dueDateForPeriod = new Date(pYr, pMo - 1, Math.min(b.dueDate ?? 1, _daysInMonth(pYr, pMo - 1)));
              const record: BillCycleRecord = {
                period: cp,
                charged: b.amount,
                carriedIn: isFuture ? 0 : (b.carryOver ?? 0),
                totalDue: owed,
                paid: owed,
                rolledOver: 0,
                onTime: today <= dueDateForPeriod,
              };
              const paymentHistory = [record, ...(b.paymentHistory ?? []).filter((r) => r.period !== cp)].slice(0, 24);
              return { ...b, status: "paid" as const, amountPaid: owed, paymentHistory };
            }
            return { ...b, status: "due" as const, amountPaid: Math.max(0, amountPaid) };
          }),
        }));
      },
      rolloverBill: (id) => {
        const today = new Date();
        const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        setState((s) => ({
          ...s,
          bills: s.bills.map((b) => {
            if (b.id !== id) return b;
            const owed = b.amount + (b.carryOver ?? 0);
            const paidAmt = b.amountPaid ?? 0;
            const unpaid = owed - paidAmt;
            const record: BillCycleRecord = {
              period,
              charged: b.amount,
              carriedIn: b.carryOver ?? 0,
              totalDue: owed,
              paid: paidAmt,
              rolledOver: unpaid > 0 ? unpaid : 0,
              onTime: null,
            };
            const paymentHistory = [record, ...(b.paymentHistory ?? [])].slice(0, 24);
            return {
              ...b,
              status: "due" as const,
              amountPaid: 0,
              carryOver: unpaid > 0 ? unpaid : 0,
              paymentHistory,
            };
          }),
        }));
      },
      updateBillAmount: (id, newAmount) =>
        mapBills((b) =>
          b.id === id
            ? {
                ...b,
                amount: Math.max(0, newAmount),
                amountPaid: 0,
                carryOver: 0,
                status: "due" as const,
              }
            : b,
        ),
      consumeAsk: () => {
        if (isPaid) return true;
        if (state.asksLeft <= 0) return false;
        setState((s) => ({ ...s, asksLeft: Math.max(0, s.asksLeft - 1) }));
        return true;
      },
      canUseVoice: () => {
        if (state.tier === "voice") return true;
        if (state.tier === "chat") return false;
        return state.asksLeft > 0;
      },
      subscribe: (tier) => patch({ tier }),
      addAsks: (n) => setState((s) => ({ ...s, asksLeft: s.asksLeft + n })),
      setName: (name) => patch({ name: name.trim() }),
      setFaceIdLock: (v) => patch({ faceIdLock: v }),
      setPersona: (p) => patch({ persona: p }),
      setVoice: (id) => patch({ voiceId: id }),
      setLanguage: (code) => patch({ language: code }),
      setTheme: (t) => patch({ theme: t }),
      toggleTheme: () =>
        patch({ theme: state.theme === "dark" ? "light" : "dark" }),
      setAccent: (a) => patch({ accent: a }),
      setCountry: (code) => patch({ countryCode: code, currency: countryByCode(code).cur }),
      setCurrency: (sym) => patch({ currency: sym }),
      setToggle: (key, v) =>
        patch({ toggles: { ...state.toggles, [key]: v } }),
      setReduceMotion: (v) => patch({ reduceMotion: v }),
      setOnboarded: (v) => patch({ onboarded: v }),
      setOnbIdx: (i) => patch({ onbIdx: i }),
      setGuest: (v) => patch({ guest: v }),
      setMonthlyIncome: (n) => patch({ monthlyIncome: n }),
      setPayCycle: (c) => patch({ payCycle: c }),
      setPaydayDay: (d) => patch({ paydayDay: d }),
      setPaydaySemi: (days) => patch({ paydaySemi: days }),
      setPaydayWeekday: (d) => patch({ paydayWeekday: d }),
      setMonthIncome: (month, amount) => {
        setState((s) => {
          const next = { ...s.incomeByMonth };
          if (amount == null || !Number.isFinite(amount) || amount <= 0) {
            delete next[month];
          } else {
            next[month] = amount;
          }
          return { ...s, incomeByMonth: next };
        });
      },
      setAskHistory: (msgs) => patch({ askHistory: msgs.slice(-100) }),
      clearAskHistory: () => patch({ askHistory: [] }),
      addCustomQuestion: (q) => setState((s) => ({ ...s, customQuestions: [q, ...(s.customQuestions ?? [])].slice(0, 50) })),
      deleteCustomQuestion: (index) => setState((s) => ({ ...s, customQuestions: (s.customQuestions ?? []).filter((_, i) => i !== index) })),
      restart: () => {
        setState({ ...DEFAULTS });
        AsyncStorage.removeItem(storageKey).catch(() => {});
      },
      loadDemoData: () => {
        setState({ ...DEFAULTS, ...DEMO_PRESET });
      },
      loadDemoAccount: (code: string) => {
        const acct = DEMO_ACCOUNTS.find((a) => a.code === code);
        const preset = acct?.preset ?? DEMO_ACCOUNTS[DEMO_ACCOUNTS.length - 1]!.preset;
        setState({ ...DEFAULTS, ...preset } as PersistShape);
      },
      restoreFromCloud: async () => {
        if (!user?.id) return false;
        const cloud = await loadFromICloud(user.id);
        if (!cloud) return false;
        // Merge envelope over DEFAULTS so any field added since the
        // backup (new toggles, currency, etc.) still has a sane default.
        setState({ ...DEFAULTS, ...(cloud as Partial<PersistShape>) });
        return true;
      },
    };
  }, [state, hydrated, patch, mapBills, toast, showToast, storageKey, user?.id]);

  // Latest-value ref. Updated synchronously during render so action wrappers
  // (created once via the useMemo below) can always delegate to the freshest
  // implementation without holding stale closures.
  const valueRef = useRef<JudithStoreValue>(value);
  valueRef.current = value;

  // Stable actions bag — created EXACTLY ONCE (empty deps). Each method is a
  // wrapper that reads the latest implementation from valueRef.current at
  // call time. Result: `useJudithActions()` returns an object whose reference
  // never changes, and whose methods are also stable references. Components
  // using only this hook never re-render on state changes — they read state
  // via `useJudithSelect()` instead. See `app/(tabs)/settings.tsx` for the
  // canonical migration pattern.
  //
  // The cast to JudithStoreValue is intentional: callers receive an object
  // that supports the same callbacks as the full value, but reading state
  // fields off it returns null/stale (don't do that — use useJudithSelect).
  const stableActions = useMemo<JudithStoreValue>(() => {
    const make = <T extends (...args: any[]) => any>(key: keyof JudithStoreValue): T =>
      ((...args: unknown[]) => (valueRef.current as any)[key](...args)) as unknown as T;
    return {
      // Bill ops
      togglePaid: make("togglePaid"),
      markPaid: make("markPaid"),
      markUnpaid: make("markUnpaid"),
      snooze: make("snooze"),
      saveBill: make("saveBill"),
      deleteBill: make("deleteBill"),
      payPartial: make("payPartial"),
      rolloverBill: make("rolloverBill"),
      updateBillAmount: make("updateBillAmount"),
      // Ask metering
      consumeAsk: make("consumeAsk"),
      canUseVoice: make("canUseVoice"),
      subscribe: make("subscribe"),
      addAsks: make("addAsks"),
      // Setters
      setName: make("setName"),
      setFaceIdLock: make("setFaceIdLock"),
      setPersona: make("setPersona"),
      setVoice: make("setVoice"),
      setLanguage: make("setLanguage"),
      setTheme: make("setTheme"),
      toggleTheme: make("toggleTheme"),
      setAccent: make("setAccent"),
      setCountry: make("setCountry"),
      setCurrency: make("setCurrency"),
      setToggle: make("setToggle"),
      setReduceMotion: make("setReduceMotion"),
      setOnboarded: make("setOnboarded"),
      setOnbIdx: make("setOnbIdx"),
      setGuest: make("setGuest"),
      setMonthlyIncome: make("setMonthlyIncome"),
      setMonthIncome: make("setMonthIncome"),
      setPayCycle: make("setPayCycle"),
      setPaydayDay: make("setPaydayDay"),
      setPaydaySemi: make("setPaydaySemi"),
      setPaydayWeekday: make("setPaydayWeekday"),
      // Ask history + custom questions
      setAskHistory: make("setAskHistory"),
      clearAskHistory: make("clearAskHistory"),
      addCustomQuestion: make("addCustomQuestion"),
      deleteCustomQuestion: make("deleteCustomQuestion"),
      // Lifecycle
      restart: make("restart"),
      loadDemoData: make("loadDemoData"),
      loadDemoAccount: make("loadDemoAccount"),
      restoreFromCloud: make("restoreFromCloud"),
      // Toast
      showToast: make("showToast"),
      // State fields — only present so the type lines up. DON'T read these
      // off `useJudithActions()`; subscribe via `useJudithSelect` instead.
      // Provide null/empty placeholders so accidental reads fail loudly.
    } as unknown as JudithStoreValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <JudithActionsContext.Provider value={stableActions}>
      <JudithContext.Provider value={value}>{children}</JudithContext.Provider>
    </JudithActionsContext.Provider>
  );
}

export function useJudith(): JudithStoreValue {
  const ctx = useContext(JudithContext);
  if (!ctx) throw new Error("useJudith must be used within JudithProvider");
  return ctx;
}

/**
 * Stable callback bag. Reference never changes across state updates, so a
 * component reading ONLY from this hook (plus `useJudithSelect` for state
 * slices) never re-renders on unrelated state mutations.
 *
 * Use this anywhere you'd previously destructure setters/callbacks from
 * `useJudith()`. Example:
 *
 *     // before — re-renders on every state change anywhere in the app:
 *     const { setPersona, setLanguage, bills } = useJudith();
 *
 *     // after — only re-renders when YOUR slice changes:
 *     const { setPersona, setLanguage } = useJudithActions();
 *     const bills = useJudithSelect(s => s.bills);
 */
export function useJudithActions(): JudithStoreValue {
  const ctx = useContext(JudithActionsContext);
  if (!ctx) throw new Error("useJudithActions must be used within JudithProvider");
  return ctx;
}
