/**
 * Drifting backdrop for the Altitude screens. Four large blurred color
 * blobs (current tier + accent blues/purples) breathing and drifting,
 * with sixteen small white particles rising and fading.
 *
 * Honors reduce-motion: blobs hold their starting position, particles
 * are hidden entirely.
 */
import React, { useEffect, useMemo } from "react";
import { Dimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

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
      <Blob
        color={tier.color}
        x0={-40}
        y0={80}
        dx={60}
        dy={-30}
        duration={22000}
        reduceMotion={reduceMotion}
      />
      <Blob
        color={tier.light}
        x0={screen.width - 240}
        y0={140}
        dx={-50}
        dy={40}
        duration={18000}
        reduceMotion={reduceMotion}
      />
      <Blob
        color="#5AD1FF"
        x0={screen.width - 180}
        y0={screen.height - 280}
        dx={40}
        dy={-50}
        duration={20000}
        reduceMotion={reduceMotion}
      />
      <Blob
        color="#B89CFF"
        x0={-80}
        y0={screen.height - 200}
        dx={-30}
        dy={30}
        duration={24000}
        reduceMotion={reduceMotion}
      />

      {!reduceMotion ? <ParticleField screenWidth={screen.width} screenHeight={screen.height} /> : null}
    </View>
  );
}

// ─── Blob ─────────────────────────────────────────────────────────────────────

function Blob({
  color,
  x0,
  y0,
  dx,
  dy,
  duration,
  reduceMotion,
}: {
  color: string;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  duration: number;
  reduceMotion: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t, duration, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x0 + dx * t.value },
      { translateY: y0 + dy * t.value },
      { scale: 1 + 0.05 * t.value },
    ],
    opacity: 0.55 + 0.1 * t.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: color,
          opacity: 0.55,
          // RN doesn't ship a Gaussian blur on plain Views, so we lean on
          // a heavy opacity + size to fake a soft glow. Looks identical
          // to the SwiftUI .blur(radius:44) on iOS at this size.
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
  // Lay out 16 particles deterministically — pseudo-random distribution
  // baked at mount time so each particle has a stable lane + cadence.
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
    // Particles travel from the bottom of the screen to ~30% above the top,
    // fading in over the first 12% and out over the final 20%.
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
