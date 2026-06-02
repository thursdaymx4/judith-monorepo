import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { useJudith } from "@/contexts/JudithStore";

/**
 * True when non-essential animation should be disabled — either the user flipped
 * the in-app "Reduce motion" setting or the OS-level accessibility flag is on.
 */
export function useReducedMotion(): boolean {
  const { reduceMotion } = useJudith();
  const [osReduce, setOsReduce] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (active) setOsReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setOsReduce(v),
    );
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion || osReduce;
}
