/**
 * Hexagonal division-shield crest. Rendered with react-native-svg so the
 * gradient + clipping + path overlays work the same on iOS and Android.
 *
 * Composed of:
 *   - radial aura behind the hex (soft glow in the tier color)
 *   - hex body with a vertical gradient (tier.light → tier.color)
 *   - white rim stroke
 *   - rank glyph in the center
 *   - "LV n" tab anchored to the bottom edge
 *   - 10 pip dots around the rim, filled up to `level`
 *   - 3 twinkling sparkles around the crest (Phase 2)
 *   - rotating light-sweep highlight inside the hex (Phase 2)
 *
 * Honors AccessibilityInfo.isReduceMotionEnabled — when on, animations
 * hold their end-states and loops are skipped entirely.
 */
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { tierForLevel } from "@/lib/altitude";

interface DivisionShieldProps {
  level: number;
  /** Outer width in points. Height auto-scales to keep the hex proportional. */
  size?: number;
  /** Glyph drawn inside the hex. Defaults to a simple altitude line; pass a
   *  string to render an emoji or a single-character mark. */
  glyph?: string;
}

/** Hex outline path in the 120×132 viewBox. The 6 vertices match the spec's
 *  reference shape (top-down: top, top-right, bottom-right, bottom,
 *  bottom-left, top-left). */
const HEX_PATH = "M60,5 L110,33 L110,99 L60,127 L10,99 L10,33 Z";

/** Default glyphs per level — simple emoji that work without a custom font.
 *  iOS render quality is solid; on Android they fall back to the system
 *  emoji font which still reads well at the sizes we use. */
const DEFAULT_GLYPHS: Record<number, string> = {
  1: "💧", 2: "🫧", 3: "🏊", 4: "↑", 5: "〰",
  6: "🚲", 7: "🚗", 8: "🛣", 9: "🛫", 10: "✈",
};

export function DivisionShield({ level, size = 150, glyph }: DivisionShieldProps) {
  const reduceMotion = useReduceMotion();
  const tier = tierForLevel(level);
  const w = size;
  const h = size * 1.18;

  const bob = useSharedValue(0);
  const aura = useSharedValue(0);
  // Sweep angle (0..360) for the rotating highlight inside the hex. We map
  // it to a Y translate via the animated wrapper instead of an SVG rotate
  // so reanimated stays on the UI thread.
  const sweep = useSharedValue(0);
  // Sparkle shared values — staggered so the three sparkles don't all
  // peak at the same instant.
  const sparkA = useSharedValue(0);
  const sparkB = useSharedValue(0);
  const sparkC = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      // Hold at mid-state so the visual hierarchy is preserved without
      // motion. Aura at full opacity, bob at rest, no sweep, no sparkles.
      bob.value = 0;
      aura.value = 0.5;
      sweep.value = 0;
      sparkA.value = 0.6;
      sparkB.value = 0.6;
      sparkC.value = 0.6;
      return;
    }
    bob.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    aura.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 7000, easing: Easing.linear }),
      -1,
      false,
    );
    sparkA.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sparkB.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sparkC.value = withRepeat(
      withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob, aura, sweep, sparkA, sparkB, sparkC, reduceMotion]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * bob.value }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.12 * aura.value }],
    opacity: 0.45 + 0.2 * aura.value,
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value * 360}deg` }],
  }));

  const sparkleAStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * sparkA.value,
    transform: [{ scale: 0.8 + 0.45 * sparkA.value }],
  }));
  const sparkleBStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * sparkB.value,
    transform: [{ scale: 0.8 + 0.45 * sparkB.value }],
  }));
  const sparkleCStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * sparkC.value,
    transform: [{ scale: 0.8 + 0.45 * sparkC.value }],
  }));

  const character = glyph ?? DEFAULT_GLYPHS[level] ?? "★";

  return (
    <View style={{ width: w, height: h, alignItems: "center", justifyContent: "center" }}>
      {/* Aura — a soft radial glow behind the crest. */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: w * 1.2,
            height: w * 1.2,
            borderRadius: w * 0.6,
            backgroundColor: tier.color,
            opacity: 0.45,
          },
          auraStyle,
        ]}
      />

      <Animated.View style={[{ width: w, height: h }, bobStyle]}>
        {/* Rotating light-sweep, clipped to the hex. Drawn behind the main
            shield SVG so it appears as a moving highlight on the crest. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              width: w,
              height: w * 1.1,
              alignItems: "center",
              justifyContent: "center",
            },
            sweepStyle,
          ]}
        >
          <Svg width={w} height={w * 1.1} viewBox="0 0 120 132">
            <Defs>
              <LinearGradient id={`sweep-${level}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="white" stopOpacity="0" />
                <Stop offset="0.5" stopColor="white" stopOpacity="0.32" />
                <Stop offset="1" stopColor="white" stopOpacity="0" />
              </LinearGradient>
              <ClipPath id={`hexclip-${level}`}>
                <Path d={HEX_PATH} />
              </ClipPath>
            </Defs>
            <G clipPath={`url(#hexclip-${level})`}>
              <Path d="M0,0 L120,0 L120,40 L0,40 Z" fill={`url(#sweep-${level})`} />
            </G>
          </Svg>
        </Animated.View>

        <Svg width={w} height={h} viewBox="0 0 120 140">
          <Defs>
            <LinearGradient id={`shield-${level}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tier.light} />
              <Stop offset="1" stopColor={tier.color} />
            </LinearGradient>
          </Defs>

          <G>
            <Path
              d={HEX_PATH}
              fill={`url(#shield-${level})`}
              stroke="rgba(255,255,255,0.75)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />

            {/* Center glyph */}
            <SvgText
              x="60"
              y="76"
              textAnchor="middle"
              fontSize={42}
              fontWeight="700"
              fill="white"
            >
              {character}
            </SvgText>

            {/* Rim pips — 10 small dots around the hex, filled up to `level`. */}
            {PIP_POSITIONS.map((pos, i) => (
              <Circle
                key={i}
                cx={pos.x}
                cy={pos.y}
                r={2.4}
                fill={i < level ? "white" : "rgba(255,255,255,0.28)"}
              />
            ))}
          </G>
        </Svg>

        {/* Three twinkling sparkles around the crest — pure decoration. */}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 4, left: w * 0.18, width: 14, height: 14 },
            sparkleAStyle,
          ]}
        >
          <SparkleGlyph size={14} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: w * 0.45, left: w - 18, width: 10, height: 10 },
            sparkleBStyle,
          ]}
        >
          <SparkleGlyph size={10} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: w * 0.85, left: 6, width: 12, height: 12 },
            sparkleCStyle,
          ]}
        >
          <SparkleGlyph size={12} />
        </Animated.View>

        {/* "LV n" tab — absolutely positioned over the bottom edge of the hex. */}
        <View
          style={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              backgroundColor: tier.color,
              borderColor: "#0A0C11",
              borderWidth: 2.5,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 2,
              gap: 3,
            }}
          >
            <SmallLabel>LV</SmallLabel>
            <LargeLabel>{level}</LargeLabel>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Pip positions ────────────────────────────────────────────────────────────

/** 10 pip positions distributed along the hex rim. Hand-laid for visual
 *  balance — purely decorative, no exact maths required. */
const PIP_POSITIONS: { x: number; y: number }[] = [
  { x: 30, y: 21 },
  { x: 60, y: 12 },
  { x: 90, y: 21 },
  { x: 108, y: 47 },
  { x: 108, y: 85 },
  { x: 90, y: 111 },
  { x: 60, y: 121 },
  { x: 30, y: 111 },
  { x: 12, y: 85 },
  { x: 12, y: 47 },
];

// ─── Tiny labels (avoid pulling Themed text into a child of SVG) ──────────────

function SparkleGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* 4-point star — a thin cross with rounded tapers. White with a
          slight glow so it reads on both light and dark tier colors. */}
      <Path
        d="M12 1 L13.3 10.7 L23 12 L13.3 13.3 L12 23 L10.7 13.3 L1 12 L10.7 10.7 Z"
        fill="white"
        opacity={0.92}
      />
    </Svg>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 9, fontWeight: "700", color: "#07120E", letterSpacing: 0.3 }}>
      {children}
    </Text>
  );
}

function LargeLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 15, fontWeight: "700", color: "#07120E" }}>{children}</Text>
  );
}
