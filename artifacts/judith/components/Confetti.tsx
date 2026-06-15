/**
 * Reanimated-only confetti burst — no native dependency.
 *
 * Spawns ~60 small mint + warm-accent particles from the top of the screen,
 * each given a randomised horizontal drift, rotation, fall duration, and
 * small delay. Auto-cleans after ~1.4s. Respects prefers-reduced-motion via
 * AccessibilityInfo so users on Reduce Motion get nothing.
 *
 * Used by PaidSuccessView. Drop it as a sibling above the content; particles
 * absolute-position to canvas extents and animate down past the bottom.
 */
import React, { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Dimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const COUNT = 56;
const FALL_MIN_MS = 1100;
const FALL_MAX_MS = 1700;

/** Pseudo-random in [a, b). Stable per particle index because confetti is one-shot. */
const rng = (seed: number, salt = 0) => {
  const x = Math.sin(seed * 9301 + salt * 49297 + 12.345) * 43758.5453;
  return x - Math.floor(x);
};

interface ParticleProps {
  i: number;
  width: number;
  height: number;
  accent: string;
  warm: string;
}

function Particle({ i, width, height, accent, warm }: ParticleProps) {
  const fallMs = FALL_MIN_MS + rng(i, 1) * (FALL_MAX_MS - FALL_MIN_MS);
  const delay = rng(i, 2) * 180;
  const xStart = rng(i, 3) * width;
  const xDrift = (rng(i, 4) - 0.5) * 180;
  const rotStart = rng(i, 5) * 360;
  const rotEnd = rotStart + (rng(i, 6) > 0.5 ? 540 : -540);
  const size = 6 + rng(i, 7) * 6;
  const color = rng(i, 8) > 0.42 ? accent : warm;
  const shape = rng(i, 9) > 0.6 ? "circle" : "square";

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: fallMs, easing: Easing.bezier(0.2, 0.6, 0.4, 1) }),
    );
  }, []);

  const aStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: xDrift * p },
        { translateY: (height + 60) * p },
        { rotate: `${rotStart + (rotEnd - rotStart) * p}deg` },
      ],
      opacity: p < 0.05 ? 0 : p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: -20,
          left: xStart,
          width: size,
          height: size * (shape === "square" ? 1 : 1),
          borderRadius: shape === "circle" ? size / 2 : 1.5,
          backgroundColor: color,
        },
        aStyle,
      ]}
    />
  );
}

interface Props {
  accent: string;
  /** Warm secondary accent (defaults to amber). */
  warm?: string;
}

export function Confetti({ accent, warm = "#F5B544" }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => {});
  }, []);

  const { width, height } = Dimensions.get("window");
  const indices = useMemo(() => Array.from({ length: COUNT }, (_, i) => i), []);

  if (reducedMotion) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        overflow: "hidden",
      }}
    >
      {indices.map((i) => (
        <Particle key={i} i={i} width={width} height={height} accent={accent} warm={warm} />
      ))}
    </View>
  );
}
