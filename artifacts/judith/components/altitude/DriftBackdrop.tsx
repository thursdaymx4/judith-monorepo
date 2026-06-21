/**
 * Drifting backdrop for the Altitude screens.
 *
 * A smooth multi-stop radial sky gradient tinted to the current tier sits
 * underneath. On top of it, a small accent blob breathes slowly and 16
 * white particles rise and fade.
 *
 * Replaces the earlier 4-blob version which read as "decorative" but
 * never quite landed as a coherent sky. The radial-gradient approach
 * matches the Claude Design prototype, where the screen's hero glow
 * concentrates near the shield and softly fades into the canvas.
 *
 * Honors reduce-motion: gradient holds, accent blob stops drifting,
 * particles vanish.
 */
import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import type { Tier } from "@/lib/altitude";

interface DriftBackdropProps {
  tier: Tier;
}

export function DriftBackdrop({ tier }: DriftBackdropProps) {
  const reduceMotion = useReduceMotion();
  const screen = Dimensions.get("window");

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      <SkyGradient tier={tier} width={screen.width} height={screen.height} />
      <AccentBlob
        color={tier.color}
        x={screen.width * 0.72}
        y={screen.height * 0.62}
        reduceMotion={reduceMotion}
      />
      {!reduceMotion ? <ParticleField screenWidth={screen.width} screenHeight={screen.height} /> : null}
    </View>
  );
}

// ─── Sky gradient ─────────────────────────────────────────────────────────────

function SkyGradient({
  tier,
  width,
  height,
}: {
  tier: Tier;
  width: number;
  height: number;
}) {
  // Two-layer wash: a bright tier-color glow concentrated near the hero
  // position (~32% from top), and a deeper accent that bleeds from the
  // bottom-right. Together they give the screen a sense of depth instead
  // of a flat tint. Anchors chosen empirically to land the brightest spot
  // behind the shield + ladder strip.
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id={`sky-top-${tier.id}`}
          cx="50%"
          cy="28%"
          rx="80%"
          ry="60%"
        >
          <Stop offset="0" stopColor={tier.light} stopOpacity="0.55" />
          <Stop offset="0.45" stopColor={tier.color} stopOpacity="0.18" />
          <Stop offset="1" stopColor="#0A0C11" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient
          id={`sky-bottom-${tier.id}`}
          cx="78%"
          cy="92%"
          rx="80%"
          ry="60%"
        >
          <Stop offset="0" stopColor={tier.color} stopOpacity="0.22" />
          <Stop offset="0.55" stopColor={tier.color} stopOpacity="0.06" />
          <Stop offset="1" stopColor="#0A0C11" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* Canvas underlay so the gradients composite on a stable dark base
          rather than the screen's own backgroundColor (which can flash
          during the cross-tier transition). */}
      <Rect x={0} y={0} width={width} height={height} fill="#0A0C11" />
      <Rect x={0} y={0} width={width} height={height} fill={`url(#sky-bottom-${tier.id})`} />
      <Rect x={0} y={0} width={width} height={height} fill={`url(#sky-top-${tier.id})`} />
    </Svg>
  );
}

// ─── Accent blob ──────────────────────────────────────────────────────────────

function AccentBlob({
  color,
  x,
  y,
  reduceMotion,
}: {
  color: string;
  x: number;
  y: number;
  reduceMotion: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -40 + 20 * t.value },
      { translateY: -20 * t.value },
      { scale: 1 + 0.06 * t.value },
    ],
    opacity: 0.32 + 0.06 * t.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          top: y,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: color,
          opacity: 0.32,
        },
        style,
      ]}
    />
  );
}

// ─── Particles ────────────────────────────────────────────────────────────────

interface ParticleConfig {
  x: number;
  startY: number;
  delay: number;
  duration: number;
  size: number;
}

function ParticleField({
  screenWidth,
  screenHeight,
}: {
  screenWidth: number;
  screenHeight: number;
}) {
  const particles = useMemo<ParticleConfig[]>(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      x: (screenWidth * (i + 0.5)) / 16 + ((i * 137) % 40) - 20,
      startY: screenHeight + 20 + ((i * 73) % 80),
      delay: (i * 380) % 5000,
      duration: 9000 + ((i * 211) % 6000),
      size: 2 + ((i * 17) % 3),
    }));
  }, [screenWidth, screenHeight]);

  return (
    <>
      {particles.map((p, i) => (
        <Particle key={i} config={p} screenHeight={screenHeight} />
      ))}
    </>
  );
}

function Particle({
  config,
  screenHeight,
}: {
  config: ParticleConfig;
  screenHeight: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [t, config.delay, config.duration]);

  const style = useAnimatedStyle(() => {
    const distance = screenHeight + 80;
    const ty = -t.value * distance;
    const phase = t.value;
    const fadeIn = Math.min(1, phase / 0.12);
    const fadeOut = phase > 0.8 ? Math.max(0, 1 - (phase - 0.8) / 0.2) : 1;
    return {
      transform: [{ translateY: ty }],
      opacity: 0.55 * fadeIn * fadeOut,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: config.x,
          top: config.startY,
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: "white",
        },
        style,
      ]}
    />
  );
}
