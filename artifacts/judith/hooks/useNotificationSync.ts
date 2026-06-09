import { useEffect, useRef } from "react";
import { useJudith } from "@/contexts/JudithStore";
import { syncNotifications, cancelAllNotifications, getPermissionStatus } from "@/lib/notifications";

/**
 * Keeps local notifications in sync with the current bill list and toggle settings.
 * Mount once in the root layout (after auth + hydration).
 *
 * - Runs on mount and whenever bills, toggles, or persona change.
 * - Skips sync if notification permission is not granted.
 * - Cancels all Judith notifications when both toggles are off.
 */
export function useNotificationSync() {
  const { bills, toggles, persona, language } = useJudith();
  const syncingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  const { dueReminders, nudges } = toggles;

  useEffect(() => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!dueReminders && !nudges) {
      pendingRef.current = false;
      cancelAllNotifications().catch(() => {});
      return;
    }

    const runSync = () => {
      if (runIdRef.current !== runId) return;
      if (syncingRef.current) {
        pendingRef.current = true;
        return;
      }

      syncingRef.current = true;
      getPermissionStatus()
        .then((status) => {
          if (status !== "granted") return;
          return syncNotifications(bills, persona, language, {
            reminder: dueReminders,
            nudge: nudges,
          });
        })
        .catch(() => {})
        .finally(() => {
          if (runIdRef.current !== runId) return;
          syncingRef.current = false;
          if (pendingRef.current) {
            pendingRef.current = false;
            timerRef.current = setTimeout(runSync, 400);
          }
        });
    };

    timerRef.current = setTimeout(runSync, 700);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bills, dueReminders, nudges, persona, language]);
}
