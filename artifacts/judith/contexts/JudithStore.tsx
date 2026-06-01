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

import { APP_BILLS, formatMoney, type Bill } from "@/constants/data";
import {
  countryByCode,
  DEFAULT_COUNTRY,
  type Country,
} from "@/constants/countries";
import type { PersonaId } from "@/constants/personas";
import type { AccentId, ThemeName } from "@/constants/theme";

const STORAGE_KEY = "judith_store_v1";
const FREE_ASKS = 8;

export type AskTier = "free" | "plus" | "unlimited";

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
  persona: PersonaId;
  voiceId: string;
  theme: ThemeName;
  accent: AccentId;
  countryCode: string;
  toggles: Toggles;
  onboarded: boolean;
  /** Onboarding resume index (saved from step `intro` onward). */
  onbIdx: number;
  /** Dev/testing bypass: skip Supabase auth and enter the app as a guest. */
  guest: boolean;
}

const DEFAULTS: PersistShape = {
  bills: APP_BILLS,
  asksLeft: FREE_ASKS,
  tier: "free",
  persona: "pro",
  voiceId: "rachel",
  theme: "dark",
  accent: "mint",
  countryCode: DEFAULT_COUNTRY.code,
  toggles: { dueReminders: true, widget: true, watch: false, nudges: true },
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
  /* ask metering */
  consumeAsk: () => boolean;
  subscribe: (tier: AskTier) => void;
  addAsks: (n: number) => void;
  /* settings */
  setPersona: (p: PersonaId) => void;
  setVoice: (id: string) => void;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
  setAccent: (a: AccentId) => void;
  setCountry: (code: string) => void;
  setToggle: (key: keyof Toggles, value: boolean) => void;
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
    return {
      ...state,
      hydrated,
      country,
      money: (n: number) => formatMoney(n, country.cur),
      toast,
      showToast,
      togglePaid: (id) =>
        mapBills((b) =>
          b.id === id
            ? { ...b, status: b.status === "paid" ? "due" : "paid" }
            : b,
        ),
      markPaid: (id) =>
        mapBills((b) => (b.id === id ? { ...b, status: "paid" } : b)),
      markUnpaid: (id) =>
        mapBills((b) => (b.id === id ? { ...b, status: "due" } : b)),
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
      consumeAsk: () => {
        if (state.tier === "unlimited") return true;
        if (state.asksLeft <= 0) return false;
        setState((s) => ({ ...s, asksLeft: Math.max(0, s.asksLeft - 1) }));
        return true;
      },
      subscribe: (tier) =>
        patch({ tier, asksLeft: tier === "plus" ? 50 : state.asksLeft }),
      addAsks: (n) => patch({ asksLeft: state.asksLeft + n }),
      setPersona: (p) => patch({ persona: p }),
      setVoice: (id) => patch({ voiceId: id }),
      setTheme: (t) => patch({ theme: t }),
      toggleTheme: () =>
        patch({ theme: state.theme === "dark" ? "light" : "dark" }),
      setAccent: (a) => patch({ accent: a }),
      setCountry: (code) => patch({ countryCode: code }),
      setToggle: (key, v) =>
        patch({ toggles: { ...state.toggles, [key]: v } }),
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
