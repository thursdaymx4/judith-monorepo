import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Animate a number from its previous value up to `target` with an ease-out curve.
 * Returns the live (rounded) value to render. Honors reduced motion by snapping
 * straight to the target.
 */
export function useCountUp(target: number, duration = 800): number {
  const reduce = useReducedMotion();
  const av = useRef(new Animated.Value(target)).current;
  const prev = useRef(target);
  const [val, setVal] = useState(target);
  // Track the last value we pushed to React so the per-frame Animated listener
  // only triggers a re-render when the *rounded* (i.e. displayed) value actually
  // changes. Callers render `money(Math.round(v))`, so emitting every raw frame
  // forced ~48 wasted re-renders per animation; this collapses them to one per
  // visible integer step.
  const lastEmitted = useRef(Math.round(target));

  useEffect(() => {
    if (reduce) {
      av.setValue(target);
      prev.current = target;
      lastEmitted.current = Math.round(target);
      setVal(target);
      return;
    }
    av.setValue(prev.current);
    const id = av.addListener(({ value }) => {
      const rounded = Math.round(value);
      if (rounded !== lastEmitted.current) {
        lastEmitted.current = rounded;
        setVal(rounded);
      }
    });
    Animated.timing(av, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      prev.current = target;
      // Guarantee we land exactly on the target even if the final frame's
      // rounded value matched the previous emit and was skipped above.
      if (finished && lastEmitted.current !== Math.round(target)) {
        lastEmitted.current = Math.round(target);
        setVal(target);
      }
    });
    return () => av.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduce]);

  return val;
}
