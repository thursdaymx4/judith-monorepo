import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadFromICloud, saveToICloud } from "@/lib/icloud-backup";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { formatMoney, isPaidViaCard, totalOwed, type Bill, type BillCycleRecord } from "@/constants/data";
import { DEMO_PRESET } from "@/constants/demoData";
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
  /** Persisted Ask Judith chat history (last 100 messages). */
  askHistory: AskMsg[];
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
  askHistory: [],
};

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
  /** Replace the full Ask Judith chat history (capped at 100 messages). */
  setAskHistory: (msgs: AskMsg[]) => void;
  /** Clear the full Ask Judith chat history. */
  clearAskHistory: () => void;
  restart: () => void;
  loadDemoData: () => void;
}

const JudithContext = createContext<JudithStoreValue | undefined>(undefined);

export function JudithProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const storageKey = storageKeyForUser(user?.id);

  const [state, setState] = useState<PersistShape>(DEFAULTS);
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
      setState({ ...DEFAULTS, ...parsed, toggles: { ...DEFAULTS.toggles, ...(parsed.toggles ?? {}) } });
    }

    AsyncStorage.getItem(storageKey)
      .then(async (raw) => {
        if (!active) return;
        if (raw) {
          try { applyParsed(JSON.parse(raw) as Partial<PersistShape>); } catch { /* ignore corrupt */ }
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
      const json = JSON.stringify(state);
      AsyncStorage.setItem(storageKey, json).catch(() => {});
      // Mirror to iCloud so the backup survives reinstalls and device switches.
      if (user?.id) saveToICloud(state, user.id).catch(() => {});
    }, 250);
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
        setState((s) => ({
          ...s,
          bills: s.bills.map((b) => {
            if (b.id !== id) return b;
            const owed = b.amount + (b.carryOver ?? 0);
            const cp = computeNaturalPeriod(b, today);
            const existing = b.paymentHistory ?? [];
            if (existing.some((r) => r.period === cp && r.paid >= r.totalDue)) return b;
            const [pYr, pMo] = cp.split("-").map(Number) as [number, number];
            const dueDateForPeriod = new Date(pYr, pMo - 1, Math.min(b.dueDate ?? 1, _daysInMonth(pYr, pMo - 1)));
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
            const isCurrentPaid = paymentHistory.some((r) => r.period === newNaturalPeriod && r.paid >= r.totalDue);
            return {
              ...b,
              status: isCurrentPaid ? "paid" as const : "due" as const,
              amountPaid: isCurrentPaid ? owed : 0,
              paymentHistory,
            };
          }),
        }));
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
      setCountry: (code) => patch({ countryCode: code }),
      setCurrency: (sym) => patch({ currency: sym }),
      setToggle: (key, v) =>
        patch({ toggles: { ...state.toggles, [key]: v } }),
      setReduceMotion: (v) => patch({ reduceMotion: v }),
      setOnboarded: (v) => patch({ onboarded: v }),
      setOnbIdx: (i) => patch({ onbIdx: i }),
      setGuest: (v) => patch({ guest: v }),
      setMonthlyIncome: (n) => patch({ monthlyIncome: n }),
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
      restart: () => {
        setState({ ...DEFAULTS });
        AsyncStorage.removeItem(storageKey).catch(() => {});
      },
      loadDemoData: () => {
        setState({ ...DEFAULTS, ...DEMO_PRESET });
      },
    };
  }, [state, hydrated, patch, mapBills, toast, showToast, storageKey]);

  return (
    <JudithContext.Provider value={value}>{children}</JudithContext.Provider>
  );
}

export function useJudith(): JudithStoreValue {
  const ctx = useContext(JudithContext);
  if (!ctx) throw new Error("useJudith must be used within JudithProvider");
  return ctx;
}
