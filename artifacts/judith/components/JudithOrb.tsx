import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface JudithOrbProps {
  state?: OrbState;
  size?: number;
}

/**
 * Placeholder voice orb. Swappable visual anchor — a teal→violet gradient
 * sphere that breathes when idle and pulses faster while active.
 */
export function JudithOrb({ state = "idle", size = 160 }: JudithOrbProps) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration =
      state === "listening" ? 700 : state === "thinking" ? 450 : state === "speaking" ? 350 : 2200;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, state]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size,
            backgroundColor: colors.orbMid,
            opacity: glowOpacity,
            transform: [{ scale: 1.25 }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={[colors.orbStart, colors.orbMid, colors.orbEnd]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            width: size * 0.8,
            height: size * 0.8,
            borderRadius: size,
          }}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.45)", "rgba(255,255,255,0)"]}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 0.7, y: 0.7 }}
            style={{ flex: 1, borderRadius: size }}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

export default JudithOrb;
