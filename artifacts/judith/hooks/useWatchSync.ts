import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useJudith } from "@/contexts/JudithStore";
import { syncBillsToWatch } from "@/lib/watch";
import { useWatchMessages } from "@/hooks/useWatchMessages";

/**
 * Keeps the paired Apple Watch and iOS home-screen widget in sync with the
 * current bill list.
 *
 * - Syncs on every bill / toggle / persona / currency change (debounced 500 ms).
 * - Also syncs on every app foreground transition so the widget always reflects
 *   the latest data even after a long background gap (fixes stale "All paid"
 *   state after a new billing cycle starts).
 * - Watch connectivity only fires when toggles.watch is true.
 * - Safe to mount unconditionally: no-ops in Expo Go and on Android.
 */
export function useWatchSync() {
  const { bills, toggles, persona, currency } = useJudith();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const billsRef    = useRef(bills);
  const togglesRef  = useRef(toggles);
  const personaRef  = useRef(persona);
  const currencyRef = useRef(currency);

  billsRef.current    = bills;
  togglesRef.current  = toggles;
  personaRef.current  = persona;
  currencyRef.current = currency;

  const scheduleSync = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      syncBillsToWatch(
        billsRef.current,
        personaRef.current,
        currencyRef.current,
        togglesRef.current.watch,
      ).catch(() => {});
    }, 500);
  };

  useEffect(() => {
    scheduleSync();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, toggles.watch, persona, currency]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") scheduleSync();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useWatchMessages();
}
