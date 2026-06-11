import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/**
 * Forces OTA (over-the-air) updates to apply promptly instead of waiting for a
 * second cold start.
 *
 * Expo's default flow downloads a published update during one launch and only
 * swaps it in on the NEXT launch — which is why a freshly-published `eas update`
 * appears to "not take effect" until the app is killed and reopened a second
 * time. This hook adds a runtime check:
 *
 *   - On cold start (mount): ask the update server directly, download any new
 *     bundle, and reload into it within the same session. The user gets the new
 *     code on the FIRST reopen.
 *   - On returning to the foreground: silently pre-download a newer bundle so
 *     it is ready to apply on the next launch (no disruptive mid-session reload).
 *
 * No-ops in development / Expo Go, where `Updates.isEnabled` is false.
 */
export function useOtaUpdate() {
  useEffect(() => {
    if (!Updates.isEnabled) return;

    let cancelled = false;
    let inFlight = false;

    const sync = async (reloadIfNew: boolean) => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled || !reloadIfNew) return;
        await Updates.reloadAsync();
      } catch {
        /* offline / no update / transient network — ignore, retry next foreground */
      } finally {
        inFlight = false;
      }
    };

    // Cold start: apply immediately so the new bundle runs this session.
    void sync(true);

    // Foreground resume: pre-download only; apply on next launch to avoid
    // yanking the user out of whatever they're doing.
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") void sync(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
