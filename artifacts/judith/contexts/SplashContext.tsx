/**
 * Minimal context that exposes whether the HandledSplash has fully
 * dismissed. Used by `useOnbVoice` to defer the AI-consent modal until
 * after the splash fade — otherwise the modal can render underneath the
 * fading splash and feels blocking the moment the screen clears.
 *
 * Default `false` so consumers don't accidentally fire before the
 * provider mounts.
 */
import React, { createContext, useContext, useState } from "react";

type SplashContextValue = {
  splashDone: boolean;
  setSplashDone: (v: boolean) => void;
};

const SplashContext = createContext<SplashContextValue>({
  splashDone: false,
  setSplashDone: () => {},
});

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const [splashDone, setSplashDone] = useState(false);
  return (
    <SplashContext.Provider value={{ splashDone, setSplashDone }}>
      {children}
    </SplashContext.Provider>
  );
}

export function useSplash(): SplashContextValue {
  return useContext(SplashContext);
}
