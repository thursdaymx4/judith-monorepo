/**
 * System reduce-motion preference. Components that loop animations should
 * gate them on this so iOS Accessibility > Motion > Reduce Motion silences
 * them.
 *
 * Re-reads on focus changes so the user can toggle the setting in iOS
 * Settings and see the app update without a relaunch.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo, type EmitterSubscription } from "react-native";

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduce(v);
    }).catch(() => {});

    const sub: EmitterSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => setReduce(v),
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduce;
}
