import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Manages the Face ID / biometric app-lock gate.
 *
 * When `enabled` is true:
 * - The app prompts for biometrics on first mount (cold open).
 * - It re-prompts whenever the app returns to the foreground after being
 *   backgrounded for a real user action (not just the OS auth dialog itself).
 * - `locked` stays true until authentication succeeds.
 *
 * Returns:
 *   locked   — whether the lock screen should be shown
 *   unlock   — call this to trigger a manual prompt (e.g. "Try Again" button)
 *   canUseBiometrics — whether the device has enrolled biometrics at all
 */
export function useBiometricLock(enabled: boolean) {
  const [locked, setLocked] = useState(enabled);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const authenticating = useRef(false);
  /**
   * Set to true when the app goes to background/inactive WHILE an auth
   * prompt is already in flight. This happens when Face ID falls back to
   * the system passcode screen — the OS yanks the app to the background.
   * We use this flag to skip the re-lock when the app returns to active,
   * because the background was caused by our own auth dialog, not the user.
   */
  const authCausedBackground = useRef(false);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then((has) => {
      if (!has) return;
      LocalAuthentication.isEnrolledAsync().then(setCanUseBiometrics);
    });
  }, []);

  const prompt = useCallback(async (): Promise<boolean> => {
    if (authenticating.current) return false;
    authenticating.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Judith",
        fallbackLabel: "Use PIN",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) setLocked(false);
      return result.success;
    } catch {
      return false;
    } finally {
      authenticating.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      return;
    }
    setLocked(true);
    prompt();
  }, [enabled, prompt]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;

      // If the app goes to background/inactive while auth is already running,
      // this is the OS passcode fallback dialog taking focus — not the user
      // actually switching away. Mark it so we don't re-lock on return.
      if ((next === "background" || next === "inactive") && authenticating.current) {
        authCausedBackground.current = true;
      }

      if (next === "active" && (prev === "background" || prev === "inactive")) {
        if (authCausedBackground.current) {
          // App came back from the auth dialog itself — don't re-lock.
          authCausedBackground.current = false;
        } else {
          // Genuine foreground resume (user switched apps, etc.) — re-lock.
          setLocked(true);
          prompt();
        }
      }
    });
    return () => sub.remove();
  }, [enabled, prompt]);

  return { locked, unlock: prompt, canUseBiometrics };
}

/**
 * One-shot biometric check — used when enabling the lock toggle to confirm
 * the user actually has biometrics enrolled and can authenticate right now.
 * Returns true if authentication succeeded.
 */
export async function verifyBiometricsNow(): Promise<boolean> {
  const has = await LocalAuthentication.hasHardwareAsync();
  if (!has) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Confirm Face ID to enable app lock",
    fallbackLabel: "Use PIN",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}
