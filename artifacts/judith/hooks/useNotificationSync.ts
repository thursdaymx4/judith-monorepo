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
  const { bills, toggles, persona } = useJudith();
  const syncingRef = useRef(false);
  const { dueReminders, nudges } = toggles;

  useEffect(() => {
    if (!dueReminders && !nudges) {
      cancelAllNotifications().catch(() => {});
      return;
    }

    if (syncingRef.current) return;
    syncingRef.current = true;

    getPermissionStatus()
      .then((status) => {
        if (status !== "granted") return;
        return syncNotifications(bills, persona, {
          reminder: dueReminders,
          nudge: nudges,
        });
      })
      .catch(() => {})
      .finally(() => {
        syncingRef.current = false;
      });
  // Re-sync whenever any of these change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, dueReminders, nudges, persona]);
}
