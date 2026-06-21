/**
 * Promotion ring — a circular trim arc that frames the hero DivisionShield
 * and visualizes progress through the current tier toward the next one.
 *
 * Rendered as an SVG circle:
 *   - Background track at low opacity for the empty portion
 *   - Foreground arc clipped to `fraction` via strokeDasharray
 *   - Tier-colored stroke with a soft drop shadow so the arc reads on
 *     the dark canvas
 *   - Started at -90° so the arc grows clockwise from the top, like a
 *     progress dial
 *
 * Empty (no promotion target left, top tier) renders a fully-filled ring
 * so the shield still has its halo.
 */
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useReduceMotion } from "@/hooks/useReduceMotion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface PromotionRingProps {
  /** Outer diameter of the ring in points. */
  size: number;
  /** Stroke color (typically the next tier's color). */
  color: string;
  /** 0..1 — fraction of the ring filled. 1 when on the top tier. */
  fraction: number;
  /** Children are rendered centered inside the ring — typically the shield. */
  children: React.ReactNode;
}

export function PromotionRing({ size, color, fraction, children }: PromotionRingProps) {
  const reduceMotion = useReduceMotion();
  // 6pt stroke gets a 3pt inset so the arc rides just outside the shield's
  // bob radius. The viewBox uses normalized coordinates so the circle math
  // stays simple.
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Animate the fill on mount + on value change. Skipped under reduce-motion.
  const t = useSharedValue(reduceMotion ? fraction : 0);
  useEffect(() => {
    if (reduceMotion) {
      t.value = fraction;
      return;
    }
    t.value = withTiming(fraction, { duration: 720, easing: Easing.out(Easing.cubic) });
  }, [t, fraction, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    // strokeDashoffset = circumference * (1 - filled). Rotated -90° below
    // so the fill starts from the 12 o'clock position.
    strokeDashoffset: circumference * (1 - t.value),
  }));

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{
          position: "absolute",
          transform: [{ rotate: "-90deg" }],
        }}
      >
        {/* Empty track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>

      {/* Centered children (shield) */}
      <View style={{ width: size * 0.75, alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}
