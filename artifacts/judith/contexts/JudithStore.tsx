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

const STORAGE_KEY = "judith_store_v1";
const FREE_ASKS = 8;

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
  togglePaid: (id: string) => void;
  markPaid: (id: string) => void;
  markUnpaid: (id: string) => void;
  snooze: (id: string, days: number) => void;
  saveBill: (bill: Bill) => void;
  deleteBill: (id: string) => void;
  /** Record a partial (or full) cumulative payment amount for a bill. */
  payPartial: (id: string, amountPaid: number) => void;
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
  const [state, setState] = useState<PersistShape>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  // hydrate
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
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
  }, []);

  // persist (debounced)
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

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
    return {
      ...state,
      hydrated,
      country,
      money: (n: number) => formatMoney(n, country.cur),
      toast,
      showToast,
      togglePaid: (id) => {
        const today = new Date();
        const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        mapBills((b) => {
          if (b.id !== id) return b;
          const owed = b.amount + (b.carryOver ?? 0);
          if (b.status === "paid") {
            return { ...b, status: "due" as const, amountPaid: 0 };
          }
          const record: BillCycleRecord = {
            period,
            charged: b.amount,
            carriedIn: b.carryOver ?? 0,
            totalDue: owed,
            paid: owed,
            rolledOver: 0,
            onTime: b.dueDays >= 0,
          };
          // Upsert by period: replace any existing entry for this month instead of prepending
          const existing = (b.paymentHistory ?? []).filter((r) => r.period !== period);
          const paymentHistory = [record, ...existing].slice(0, 24);
          return { ...b, status: "paid" as const, amountPaid: owed, paymentHistory };
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
        setState((s) => ({ ...s, bills: s.bills.filter((b) => b.id !== id) })),
      payPartial: (id, amountPaid) =>
        setState((s) => ({
          ...s,
          bills: s.bills.map((b) => {
            if (b.id !== id) return b;
            const owed = b.amount + (b.carryOver ?? 0);
            if (amountPaid >= owed) return { ...b, status: "paid" as const, amountPaid: owed };
            return { ...b, status: "due" as const, amountPaid: Math.max(0, amountPaid) };
          }),
        })),
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
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      },
    };
  }, [state, hydrated, patch, mapBills, toast, showToast]);

  return (
    <JudithContext.Provider value={value}>{children}</JudithContext.Provider>
  );
}

export function useJudith(): JudithStoreValue {
  const ctx = useContext(JudithContext);
  if (!ctx) throw new Error("useJudith must be used within JudithProvider");
  return ctx;
}
