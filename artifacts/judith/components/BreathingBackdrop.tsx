import React, { useEffect } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/**
 * Living background — five soft-edge radial-gradient blooms that breathe,
 * drift, and slowly spin out of sync. Used as the persistent backdrop on
 * the splash AND the login/auth screen so the brand "alive light field"
 * continues from boot into the first signed-out screen the user sees.
 *
 * All animation runs on the Reanimated UI worklet thread so it costs
 * essentially nothing on the JS thread, even with multiple instances or
 * heavy scroll under it.
 *
 * The component is purely a backdrop — it absolute-positions to fill its
 * parent and pointerEvents="none" so it never blocks taps.
 */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface BloomSpec {
  color: string;
  alpha: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  phase: number;
}

/** Default bloom palette + layout — matches what's on the splash. */
const DEFAULT_BLOOMS: BloomSpec[] = [
  { color: "#22d3a3", alpha: 0.62, size: 680, x: -0.28, y: -0.08, duration: 3600, phase: 0    },
  { color: "#3b82f6", alpha: 0.52, size: 620, x:  0.45, y: -0.18, duration: 4200, phase: 900  },
  { color: "#a855f7", alpha: 0.58, size: 660, x:  0.38, y:  0.50, duration: 3900, phase: 1700 },
  { color: "#06b6d4", alpha: 0.45, size: 580, x: -0.34, y:  0.48, duration: 4500, phase: 2500 },
  { color: "#ec4899", alpha: 0.50, size: 600, x:  0.52, y:  0.72, duration: 3300, phase: 1300 },
];

interface Props {
  /** Override the default palette + layout. Useful for the auth screen
   *  where you may want softer (lower-alpha) blooms so form fields read. */
  blooms?: BloomSpec[];
  /** Solid backdrop colour drawn underneath the blooms. Defaults to the
   *  app's dark canvas. Pass undefined to skip — useful when the parent
   *  already paints a canvas you want the blooms to layer on top of. */
  canvasColor?: string | null;
  /** Multiplier on every bloom's alpha. Lets one consumer dial the
   *  intensity globally without having to redefine the palette. */
  intensity?: number;
}

function BreathingBackdropImpl({
  blooms = DEFAULT_BLOOMS,
  canvasColor = "#0a0b0e",
  intensity = 1,
}: Props) {
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {canvasColor != null && (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: canvasColor }]} />
      )}
      {blooms.map((b, i) => (
        <DriftBloom key={i} {...b} alpha={Math.min(1, b.alpha * intensity)} />
      ))}
    </Animated.View>
  );
}

// React.memo so re-renders anywhere up the tree (theme toggle, route
// change, state mutation in JudithStore) don't tear down + rebuild the
// 5 DriftBloom SVG trees. The component takes plain primitive/array
// props; the default shallow compare is sufficient.
export const BreathingBackdrop = React.memo(BreathingBackdropImpl);

// ── DriftBloom ────────────────────────────────────────────────────────────

function DriftBloom({ color, alpha, size, x, y, duration, phase }: BloomSpec) {
  const breathe = useSharedValue(0);
  const drift   = useSharedValue(0);
  const spin    = useSharedValue(0);

  useEffect(() => {
    breathe.value = withDelay(
      phase,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    drift.value = withDelay(
      phase + 400,
      withRepeat(
        withTiming(1, { duration: duration * 1.4, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      ),
    );
    spin.value = withDelay(
      phase + 800,
      withRepeat(
        withTiming(1, { duration: duration * 2.2, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + breathe.value * 0.42 },
      { translateX: drift.value * 60 - 30 },
      { translateY: breathe.value * 48 - 24 },
      { rotate: `${spin.value * 360}deg` },
    ],
    opacity: 0.55 + breathe.value * 0.45,
  }));

  const id = `bb-${color.replace("#", "")}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: x * SCREEN_W,
          top:  y * SCREEN_H,
          width:  size,
          height: size,
        },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={color} stopOpacity={alpha} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export default BreathingBackdrop;
