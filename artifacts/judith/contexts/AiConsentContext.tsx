/**
 * App-wide AI consent gate.
 *
 * Usage:
 *   const { ensure, status, aiEnabled, revoke } = useAiConsent();
 *
 *   // before any third-party AI call:
 *   if (!await ensure()) return;
 *
 *   // to hide a CTA when the user has opted out:
 *   {aiEnabled && <AskJudithButton />}
 *
 * Status semantics:
 *   "unknown"  → never asked; ensure() surfaces the modal
 *   "accepted" → AI on; ensure() resolves true immediately
 *   "declined" → AI off; ensure() resolves false immediately, NO modal
 *
 * Re-prompt rules:
 *   The previous build re-asked the user on every AI surface after a
 *   decline. That was rightly called out as annoying. Decline is now
 *   persistent: the user can flip it back on via Settings (and tap
 *   "Enable AI" from any disabled CTA — same path).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AiConsentModal } from "@/components/AiConsentModal";
import { useJudith } from "@/contexts/JudithStore";
import {
  getAiConsentStatus,
  setAiConsentStatus,
  type AiConsentStatus,
} from "@/lib/aiConsent";

interface AiConsentValue {
  /** Tri-state from storage. Defaults to "unknown" until hydrated. */
  status: AiConsentStatus;
  /** Convenience: true iff the user has explicitly opted in. */
  aiEnabled: boolean;
  /**
   * Resolves true if consent has already been granted; false on decline
   * OR if the user previously opted out. Surfaces the modal only when
   * status is "unknown".
   */
  ensure: () => Promise<boolean>;
  /** Flip from "declined" back to "unknown" so the next AI surface
   *  re-presents the modal. The Settings toggle calls this. */
  reaskNextTime: () => Promise<void>;
  /** Hard turn-off: persist "declined" and dismiss any pending modal. */
  revoke: () => Promise<void>;
}

const AiConsentCtx = createContext<AiConsentValue | null>(null);

export function AiConsentProvider({ children }: { children: React.ReactNode }) {
  const { persona } = useJudith();
  const [status, setStatus] = useState<AiConsentStatus>("unknown");
  const [visible, setVisible] = useState(false);

  /** Queue of pending ensure() callers — all resolve with the same answer. */
  const pendingRef = React.useRef<Array<(answer: boolean) => void>>([]);

  useEffect(() => {
    getAiConsentStatus().then(setStatus).catch(() => {});
  }, []);

  const handleAccept = useCallback(() => {
    setVisible(false);
    setStatus("accepted");
    setAiConsentStatus("accepted").catch(() => {});
    const callers = pendingRef.current;
    pendingRef.current = [];
    callers.forEach((resolve) => resolve(true));
  }, []);

  const handleDecline = useCallback(() => {
    setVisible(false);
    setStatus("declined");
    setAiConsentStatus("declined").catch(() => {});
    const callers = pendingRef.current;
    pendingRef.current = [];
    callers.forEach((resolve) => resolve(false));
  }, []);

  const ensure = useCallback(async (): Promise<boolean> => {
    // Storage read on every call so an out-of-band change (Settings
    // toggle → flip to unknown) is picked up immediately.
    const fresh = await getAiConsentStatus();
    setStatus(fresh);
    if (fresh === "accepted") return true;
    if (fresh === "declined") return false; // honor the persisted decline
    return new Promise<boolean>((resolve) => {
      pendingRef.current.push(resolve);
      setVisible(true);
    });
  }, []);

  const reaskNextTime = useCallback(async () => {
    setStatus("unknown");
    await setAiConsentStatus("unknown");
  }, []);

  const revoke = useCallback(async () => {
    setStatus("declined");
    setVisible(false);
    await setAiConsentStatus("declined");
    const callers = pendingRef.current;
    pendingRef.current = [];
    callers.forEach((resolve) => resolve(false));
  }, []);

  const value = useMemo(
    () => ({
      status,
      aiEnabled: status === "accepted",
      ensure,
      reaskNextTime,
      revoke,
    }),
    [status, ensure, reaskNextTime, revoke],
  );

  return (
    <AiConsentCtx.Provider value={value}>
      {children}
      <AiConsentModal
        visible={visible}
        persona={persona}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </AiConsentCtx.Provider>
  );
}

export function useAiConsent(): AiConsentValue {
  const ctx = useContext(AiConsentCtx);
  if (!ctx) {
    return {
      status: "unknown",
      aiEnabled: false,
      ensure: async () => false,
      reaskNextTime: async () => {},
      revoke: async () => {},
    };
  }
  return ctx;
}
