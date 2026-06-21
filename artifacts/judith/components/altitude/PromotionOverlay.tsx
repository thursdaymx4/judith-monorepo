/**
 * Full-screen celebration when the user gains a level. Extra fanfare when
 * the level rise crosses a tier boundary ("Welcome to {newTier.name}").
 *
 * Mounted once at the League screen. Subscribes to the
 * AltitudePromotionContext — when a pending promotion appears it animates
 * in (radial sky + rays + spring-pop shield + confetti) and dismisses on
 * the user's "Keep climbing" tap.
 *
 * Honors reduce-motion: skips confetti + spring scale, holds end states.
 */
import React, { useEffect, useMemo } from "react";
import {
  Dimensions,
  Modal,
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { DivisionShield } from "@/components/altitude/DivisionShield";
import { Txt } from "@/components/ui";
import { useAltitudePromotion, type PendingPromotion } from "@/contexts/AltitudePromotionContext";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { levelMeta, tierForLevel } from "@/lib/altitude";

export function PromotionOverlay() {
  const { pending, dismiss } = useAltitudePromotion();
  if (!pending) return null;
  return <Inner promo={pending} onDismiss={dismiss} />;
}

function Inner({
  promo,
  onDismiss,
}: {
  promo: PendingPromotion;
  onDismiss: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const newTier = tierForLevel(promo.to);
  const newMeta = levelMeta(promo.to);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      {/* Radial sky tinted to the new tier color */}
      <View style={styles.fill} pointerEvents="box-none">
        <SkyGradient tint={newTier.color} />
        <Rays tint={newTier.color} reduceMotion={reduceMotion} />
        {!reduceMotion ? <Confetti tint={newTier.color} /> : null}

        <View style={styles.content}>
          <Kicker tierChange={promo.isTierChange} />
          <SpringShield level={promo.to} reduceMotion={reduceMotion} />
          {promo.isTierChange ? (
            <Txt size={22} weight="bold" color="white" style={{ textAlign: "center", marginTop: 18 }}>
              Welcome to {newTier.name}
            </Txt>
          ) : null}
          <Txt
            size={13}
            color="rgba(255,255,255,0.8)"
            style={{ marginTop: 8, fontFamily: undefined, letterSpacing: 1 }}
          >
            LV {promo.from} ➜ LV {promo.to}
          </Txt>
          <Txt size={17} weight="semibold" color="white" style={{ marginTop: 18 }}>
            {newMeta.rank}
          </Txt>
          <Txt
            size={14}
            color="rgba(255,255,255,0.78)"
            style={{ marginTop: 12, textAlign: "center", paddingHorizontal: 32 }}
          >
            {newMeta.line}
          </Txt>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: newTier.color, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Txt size={16} weight="bold" color="#07120E">
              Keep climbing
            </Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Background bits ──────────────────────────────────────────────────────────

function SkyGradient({ tint }: { tint: string }) {
  const screen = Dimensions.get("window");
  return (
    <Svg
      width={screen.width}
      height={screen.height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id="promo-sky"
          cx="50%"
          cy="45%"
          rx="80%"
          ry="80%"
        >
          <Stop offset="0" stopColor={tint} stopOpacity="0.95" />
          <Stop offset="0.55" stopColor="#0A0C11" stopOpacity="1" />
          <Stop offset="1" stopColor="#03050A" stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={screen.width} height={screen.height} fill="url(#promo-sky)" />
    </Svg>
  );
}

function Rays({ tint, reduceMotion }: { tint: string; reduceMotion: boolean }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      spin.value = 0;
      return;
    }
    spin.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  // 12 long triangular rays from the center outward — pure decoration.
  const screen = Dimensions.get("window");
  const half = Math.max(screen.width, screen.height);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: screen.height / 2 - half,
          left: screen.width / 2 - half,
          width: half * 2,
          height: half * 2,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Svg width={half * 2} height={half * 2} viewBox="0 0 200 200">
        {Array.from({ length: 12 }).map((_, i) => {
          const rotate = (i * 360) / 12;
          return (
            <Path
              key={i}
              d="M100,100 L98,0 L102,0 Z"
              fill={tint}
              opacity={0.16}
              transform={`rotate(${rotate} 100 100)`}
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

// ─── Spring shield ────────────────────────────────────────────────────────────

function SpringShield({ level, reduceMotion }: { level: number; reduceMotion: boolean }) {
  const scale = useSharedValue(reduceMotion ? 1 : 0.3);
  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withDelay(180, withSpring(1, { damping: 7, stiffness: 110 }));
  }, [scale, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <DivisionShield level={level} size={170} />
    </Animated.View>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#F3B62F", "#74CF45", "#1FC2CC", "#7B83E0", "#FF7A7A", "#FFFFFF"];

function Confetti({ tint }: { tint: string }) {
  const screen = Dimensions.get("window");
  // Adaptive density. PixelRatio gives us a rough device-tier signal —
  // SE-class devices report ≤ 2x, current Pros report 3x. Throttle to 24
  // pieces on lower-tier devices to keep the spring-pop frame budget
  // happy; the high-end devices get the full 36 the spec calls for.
  const count = PixelRatio.get() >= 3 ? 36 : 24;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: (screen.width * (i + 0.5)) / count + ((i * 137) % 30) - 15,
        delay: (i * 80) % 1200,
        duration: 1800 + ((i * 211) % 1400),
        rotate: ((i * 53) % 360) - 180,
        size: 5 + ((i * 11) % 5),
        color: i % 5 === 0 ? tint : CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      })),
    [screen.width, tint, count],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece
          key={i}
          x={p.x}
          delay={p.delay}
          duration={p.duration}
          rotate={p.rotate}
          size={p.size}
          color={p.color}
          travel={screen.height + 80}
        />
      ))}
    </View>
  );
}

function ConfettiPiece({
  x,
  delay,
  duration,
  rotate,
  size,
  color,
  travel,
}: {
  x: number;
  delay: number;
  duration: number;
  rotate: number;
  size: number;
  color: string;
  travel: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [t, delay, duration]);

  const style = useAnimatedStyle(() => {
    const ty = -40 + t.value * travel;
    const opacity = t.value > 0.92 ? Math.max(0, 1 - (t.value - 0.92) / 0.08) : 1;
    return {
      transform: [{ translateY: ty }, { rotate: `${rotate + t.value * 540}deg` }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          top: -size,
          width: size * 2,
          height: size,
          backgroundColor: color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

// ─── Kicker ──────────────────────────────────────────────────────────────────

function Kicker({ tierChange }: { tierChange: boolean }) {
  return (
    <Txt
      size={11}
      weight="bold"
      color="rgba(255,255,255,0.78)"
      style={{
        letterSpacing: 2,
        textTransform: "uppercase",
        marginBottom: 18,
      }}
    >
      {tierChange ? "✦ Promotion!" : "Level up"}
    </Txt>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: "#03050A",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  cta: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
