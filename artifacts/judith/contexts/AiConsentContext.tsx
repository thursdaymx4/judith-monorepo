/**
 * App-wide AI consent gate.
 *
 * Usage:
 *   const { ensure, accepted } = useAiConsent();
 *   if (!await ensure()) return; // user declined
 *   // safe to call any third-party AI service
 *
 * `ensure()` resolves immediately when consent has already been granted on
 * this device. Otherwise it surfaces the AiConsentModal and resolves true
 * on accept / false on decline. The modal is mounted once at the root, so
 * every screen shares the same consent state.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { AiConsentModal } from "@/components/AiConsentModal";
import { useJudith } from "@/contexts/JudithStore";
import { hasAiConsented, setAiConsented } from "@/lib/aiConsent";

interface AiConsentValue {
  /**
   * Resolves true if the user has consented (now or previously); false if
   * they declined the prompt this turn. Never blocks longer than the user
   * takes to decide.
   */
  ensure: () => Promise<boolean>;
  /** Last-known consent state. False until storage has been read once. */
  accepted: boolean;
}

const AiConsentCtx = createContext<AiConsentValue | null>(null);

export function AiConsentProvider({ children }: { children: React.ReactNode }) {
  const { persona } = useJudith();
  const [accepted, setAccepted] = useState(false);
  const [visible, setVisible] = useState(false);

  /** Queue of pending ensure() callers waiting on this turn of the modal.
   *  All resolve with the same answer (accept or decline). */
  const pendingRef = useRef<Array<(answer: boolean) => void>>([]);

  // Hydrate consent state from storage on mount. Done once — subsequent
  // changes flow through setAccepted within this provider.
  useEffect(() => {
    hasAiConsented().then(setAccepted).catch(() => {});
  }, []);

  const handleAccept = useCallback(() => {
    setVisible(false);
    setAccepted(true);
    setAiConsented(true).catch(() => {});
    const callers = pendingRef.current;
    pendingRef.current = [];
    callers.forEach((resolve) => resolve(true));
  }, []);

  const handleDecline = useCallback(() => {
    setVisible(false);
    // Don't persist decline — let the user be re-prompted next time they
    // try to use an AI feature. Matches "Not now" semantics, not "Never".
    const callers = pendingRef.current;
    pendingRef.current = [];
    callers.forEach((resolve) => resolve(false));
  }, []);

  const ensure = useCallback(async (): Promise<boolean> => {
    // Always read storage fresh — covers the case where consent was set
    // (e.g. in onboarding) before the provider hydrated.
    if (await hasAiConsented()) {
      setAccepted(true);
      return true;
    }
    return new Promise<boolean>((resolve) => {
      pendingRef.current.push(resolve);
      setVisible(true);
    });
  }, []);

  return (
    <AiConsentCtx.Provider value={{ ensure, accepted }}>
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
    // Defensive: callers outside the provider get a no-op that fails
    // safely. Should never happen — _layout.tsx wraps the whole tree.
    return {
      ensure: async () => false,
      accepted: false,
    };
  }
  return ctx;
}
