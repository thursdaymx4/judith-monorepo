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

  useEffect(() => {
    if (reduce) {
      av.setValue(target);
      prev.current = target;
      setVal(target);
      return;
    }
    av.setValue(prev.current);
    const id = av.addListener(({ value }) => setVal(value));
    Animated.timing(av, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      prev.current = target;
    });
    return () => av.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduce]);

  return val;
}
