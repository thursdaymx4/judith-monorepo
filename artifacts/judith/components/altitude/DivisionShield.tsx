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
 *
 * Phase 1 keeps animation to a single Reanimated bob + aura pulse. The
 * sweep, sparkles, and twinkle effects from the spec are Phase 2.
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
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

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
  const tier = tierForLevel(level);
  const w = size;
  const h = size * 1.18;

  const bob = useSharedValue(0);
  const aura = useSharedValue(0);

  useEffect(() => {
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
  }, [bob, aura]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * bob.value }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.12 * aura.value }],
    opacity: 0.45 + 0.2 * aura.value,
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
