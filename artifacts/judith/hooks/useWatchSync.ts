import { useEffect, useRef } from "react";
import { useJudith } from "@/contexts/JudithStore";
import { syncBillsToWatch } from "@/lib/watch";
import { useWatchMessages } from "@/hooks/useWatchMessages";

/**
 * Keeps the paired Apple Watch in sync with the current bill list.
 *
 * - Only syncs when the `watch` toggle is on.
 * - Debounces rapid bill changes (e.g. bulk import) by 500 ms.
 * - Also mounts the Watch→Phone message listener (ask, markPaid).
 * - Safe to mount unconditionally: no-ops in Expo Go and on Android.
 */
export function useWatchSync() {
  const { bills, toggles, persona, currency } = useJudith();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toggles.watch) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      syncBillsToWatch(bills, persona, currency).catch(() => {});
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, toggles.watch, persona, currency]);

  // Handle messages sent from the Watch to the phone (ask, markPaid).
  useWatchMessages();
}
