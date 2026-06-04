import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { formatMoney, type Bill, type BillCycleRecord } from "@/constants/data";
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

export interface Toggles {
  dueReminders: boolean;
  widget: boolean;
  watch: boolean;
  nudges: boolean;
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
}

const DEFAULTS: PersistShape = {
  bills: [],
  asksLeft: FREE_ASKS,
  tier: "free",
  name: "",
  persona: "pro",
  voiceId: "rachel",
  language: "en",
  theme: "dark",
  accent: "mint",
  countryCode: DEFAULT_COUNTRY.code,
  toggles: { dueReminders: true, widget: true, watch: false, nudges: true },
  reduceMotion: false,
  faceIdLock: false,
  onboarded: false,
  onbIdx: 0,
  guest: false,
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
  setToggle: (key: keyof Toggles, value: boolean) => void;
  setReduceMotion: (v: boolean) => void;
  /* lifecycle */
  setOnboarded: (v: boolean) => void;
  setOnbIdx: (i: number) => void;
  setGuest: (v: boolean) => void;
  restart: () => void;
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
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<PersistShape>;
            // Migrate legacy tier values to new model
            if ((parsed.tier as string) === "plus") parsed.tier = "chat";
            if ((parsed.tier as string) === "unlimited") parsed.tier = "voice";
            setState({ ...DEFAULTS, ...parsed });
          } catch {
            /* ignore corrupt */
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      active = false;
    };
  }, [storageKey]);

  // persist (debounced) — always write to the current user's key
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated, storageKey]);

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
      money: (n: number) => formatMoney(n, country.cur),
      toast,
      showToast,
      togglePaid: (id, period) => {
        const today = new Date();
        mapBills((b) => {
          if (b.id !== id) return b;
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
          return {
            ...b,
            status: isCurrentPaid ? "paid" as const : "due" as const,
            amountPaid: isCurrentPaid ? owed : 0,
            paymentHistory,
          };
        });
      },
      markPaid: (id) =>
        mapBills((b) => {
          if (b.id !== id) return b;
          const owed = b.amount + (b.carryOver ?? 0);
          return { ...b, status: "paid" as const, amountPaid: owed };
        }),
      markUnpaid: (id) =>
        mapBills((b) => (b.id === id ? { ...b, status: "due" as const, amountPaid: 0 } : b)),
      snooze: (id, days) =>
        mapBills((b) =>
          b.id === id ? { ...b, dueDays: b.dueDays + days } : b,
        ),
      saveBill: (bill) =>
        setState((s) => {
          const exists = s.bills.some((b) => b.id === bill.id);
          return {
            ...s,
            bills: exists
              ? s.bills.map((b) => (b.id === bill.id ? bill : b))
              : [...s.bills, bill],
          };
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
      addAsks: (n) => patch({ asksLeft: state.asksLeft + n }),
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
      setToggle: (key, v) =>
        patch({ toggles: { ...state.toggles, [key]: v } }),
      setReduceMotion: (v) => patch({ reduceMotion: v }),
      setOnboarded: (v) => patch({ onboarded: v }),
      setOnbIdx: (i) => patch({ onbIdx: i }),
      setGuest: (v) => patch({ guest: v }),
      restart: () => {
        setState({ ...DEFAULTS });
        AsyncStorage.removeItem(storageKey).catch(() => {});
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
