/**
 * Generic loading state used across the Judith app.
 *
 * Three variants, all share the same mint ring + (optional) Judith avatar
 * + (optional) "Loading…" label with animated trailing dots:
 *   - "screen"  → first load, blocking waits > ~1s. 140 ring + 118 avatar.
 *   - "inline"  → in-card / "load more" footers. 40 ring, no avatar, mid label.
 *   - "button"  → replaces the label inside a primary action button. 18 ring,
 *                 2.5px stroke, caller passes label.
 *
 * Reuses the app's theme tokens (never hardcoded). Honours
 * AccessibilityInfo.isReduceMotionEnabled — when on, renders the composed
 * static frame with no spin/bob/dot animation.
 *
 * The onboarding "personalizing" finale keeps its own richer animation
 * (HandledSplash, etc); this loader is for everywhere else.
 */
import React, { useEffect, useState } from "react";
import { AccessibilityInfo, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { JudithAvatar } from "@/components/JudithAvatar";
import { Txt } from "@/components/ui";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

export type JudithLoaderProps = {
  variant?: "screen" | "inline" | "button";
  /** Label shown next to / under the ring. Defaults to "Loading" for screen
   *  and inline; button callers should pass their own (e.g. "Saving"). */
  label?: string;
  /** Optional outer wrapper style override. */
  style?: ViewStyle;
};

export function JudithLoader({ variant = "screen", label, style }: JudithLoaderProps) {
  const t = useTheme();
  const { persona } = useJudith();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (mounted) setReducedMotion(on); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Ring spin + avatar bob.
  const spin = useSharedValue(0);
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    spin.value = withRepeat(
      withTiming(1, { duration: 1050, easing: Easing.linear }),
      -1,
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(bob);
    };
  }, [reducedMotion]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  // Animated dots — clears on unmount, gated on reduced motion.
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (variant === "button" || reducedMotion) return;
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 420);
    return () => clearInterval(id);
  }, [variant, reducedMotion]);

  if (variant === "button") {
    return (
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
        <Animated.View
          style={[
            {
              width: 18,
              height: 18,
              borderRadius: 9,
              borderWidth: 2.5,
              borderColor: "transparent",
              borderTopColor: t.accent,
              borderRightColor: t.accent + "59",
            },
            reducedMotion ? null : spinStyle,
          ]}
        />
        {label && <Txt size={15} weight="bold" color={t.onAccent}>{label}{reducedMotion ? "" : "…"}</Txt>}
      </View>
    );
  }

  // screen + inline share the ring + avatar layout, just at different sizes.
  const isScreen = variant === "screen";
  const ringSize = isScreen ? 140 : 40;
  const avatarSize = isScreen ? 118 : 0;
  const labelSize = isScreen ? 15 : 14;
  const labelText = label ?? "Loading";

  const Body = (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: ringSize,
          height: ringSize,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* glow — only on screen variant */}
        {isScreen && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: ringSize + 60,
              height: ringSize + 60,
              borderRadius: (ringSize + 60) / 2,
              backgroundColor: t.accent,
              opacity: 0.18,
            }}
          />
        )}
        {/* ring */}
        <Animated.View
          style={[
            {
              position: "absolute",
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: isScreen ? 3 : 2.5,
              borderColor: "transparent",
              borderTopColor: t.accent,
              borderRightColor: t.accent + "59",
            },
            reducedMotion ? null : spinStyle,
          ]}
        />
        {/* avatar (screen only) */}
        {isScreen && avatarSize > 0 && (
          <Animated.View style={reducedMotion ? null : bobStyle}>
            <JudithAvatar persona={persona} size={avatarSize} />
          </Animated.View>
        )}
      </View>
      {labelText !== "" && (
        <Txt
          size={labelSize}
          weight={isScreen ? "semibold" : "regular"}
          color={isScreen ? t.txtHi : t.txtMid}
          style={{ marginTop: isScreen ? 18 : 10 }}
        >
          {labelText}
          {dots || (reducedMotion ? "…" : "")}
        </Txt>
      )}
    </View>
  );

  if (isScreen) {
    return (
      <View
        style={[
          {
            flex: 1,
            backgroundColor: t.canvas,
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        {Body}
      </View>
    );
  }

  // inline
  return (
    <View style={[{ alignItems: "center", justifyContent: "center", paddingVertical: 14 }, style]}>
      {Body}
    </View>
  );
}
