/**
 * Full-screen celebratory cover shown after a bill is marked paid.
 *
 * Layout (top → bottom, centred):
 *   Confetti burst  →  Judith avatar (with mint glow) scaled-in via spring
 *                  →  Status pill ("✓ Paid on time" / "✓ Caught up")
 *                  →  Persona-aware headline ("Meralco, handled.")
 *                  →  Subtext that calls out the streak + amount
 *                  →  Done (primary) and "View streak" (ghost) CTAs
 *
 * Reduced-motion: confetti skipped, avatar uses fade-in instead of spring.
 * Success haptic fires on mount.
 *
 * Consumed by JudithStore — when togglePaid/markPaid flips a non-via-card
 * non-once bill to paid, the store sets a successContext which mounts this
 * via a Modal in app/_layout.tsx.
 */
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Confetti } from "@/components/Confetti";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn, Low, Mono, Txt } from "@/components/ui";
import type { Bill } from "@/constants/data";
import { totalOwed } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/lib/haptics";
import type { PersonaId } from "@/constants/personas";

/** Persona-aware on-time headline. Short, one short line. */
function onTimeHeadline(persona: PersonaId, provider: string): string {
  switch (persona) {
    case "funny":    return `${provider} — done and dusted.`;
    case "sib":      return `${provider}. Adulting.`;
    case "mama":     return `${provider}, anak. Done.`;
    case "marites":  return `Oh my gosh — ${provider} paid!`;
    case "britney":  return `${provider}. Sorted.`;
    case "pro":
    default:         return `${provider}, handled.`;
  }
}

/** Persona-aware caught-up (was overdue) headline. */
function caughtUpHeadline(persona: PersonaId): string {
  switch (persona) {
    case "funny":   return "Caught up, finally.";
    case "sib":     return "Caught up. There we go.";
    case "mama":    return "Caught up, anak.";
    case "marites": return "You did it — caught up!";
    case "britney": return "Caught up. Move on.";
    case "pro":
    default:        return "Caught up. Nice.";
  }
}

interface Props {
  open: boolean;
  bill: Bill | null;
  streakMonths: number;
  wasOverdue: boolean;
  onDone: () => void;
  onViewStreak?: () => void;
}

export function PaidSuccessView({ open, bill, streakMonths, wasOverdue, onDone, onViewStreak }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { persona, money } = useJudith();
  const reducedMotion = useReducedMotion();

  const scale = useSharedValue(0.6);
  const glowOpacity = useSharedValue(0);
  useEffect(() => {
    if (!open) {
      scale.value = 0.6;
      glowOpacity.value = 0;
      return;
    }
    haptics.success();
    if (reducedMotion) {
      scale.value = 1;
      glowOpacity.value = 0.6;
    } else {
      scale.value = withSpring(1, { damping: 11, stiffness: 180, mass: 0.7 });
      glowOpacity.value = withDelay(80, withTiming(0.6, { duration: 360 }));
    }
  }, [open, reducedMotion]);

  const avatarStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  // Render NOTHING when there's no bill to show. Using a Reanimated overlay
  // rather than RN's <Modal> so React owns the full lifecycle — no orphaned
  // native UIViewController hanging around to swallow touches after dismiss
  // (which was freezing Home after a few mark-paid cycles).
  if (!open || !bill) return null;
  const provider = bill.provider || "Bill";
  const amount = totalOwed(bill);
  const headline = wasOverdue ? caughtUpHeadline(persona) : onTimeHeadline(persona, provider);
  const pillLabel = wasOverdue ? "✓ Caught up" : "✓ Paid on time";

  // Subtext: streak + amount logged. Streak phrase omitted when streakMonths < 2
  // (one month doesn't feel like a streak yet — just say "logged").
  const streakPhrase =
    streakMonths >= 2
      ? `${streakMonths} month${streakMonths === 1 ? "" : "s"} in a row, never late. `
      : "";
  const subtext = `${streakPhrase}${money(amount)} logged.`;

  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(0) : FadeIn.duration(220)}
      exiting={reducedMotion ? FadeOut.duration(0) : FadeOut.duration(180)}
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: t.canvas,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 24,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          elevation: 9999,
        },
      ]}
    >
        <Confetti accent={t.accent} />

        {/* avatar with soft mint glow */}
        <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: 240,
                height: 240,
                borderRadius: 120,
                backgroundColor: t.accent,
              },
              glowStyle,
            ]}
          />
          <Animated.View style={avatarStyle}>
            <JudithAvatar persona={persona} size={160} />
          </Animated.View>
        </View>

        {/* status pill */}
        <Animated.View
          entering={reducedMotion ? FadeIn.duration(0) : FadeInDown.duration(360).delay(180)}
          style={{
            marginTop: 18,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: t.accent + "26",
            borderWidth: 1,
            borderColor: t.accent + "55",
          }}
        >
          <Txt size={13} weight="semibold" color={t.accent}>{pillLabel}</Txt>
        </Animated.View>

        {/* headline + subtext */}
        <Animated.View
          entering={reducedMotion ? FadeIn.duration(0) : FadeInDown.duration(360).delay(260)}
          style={{ marginTop: 16, alignItems: "center", paddingHorizontal: 8 }}
        >
          <Txt size={28} weight="bold" style={{ textAlign: "center" }}>{headline}</Txt>
        </Animated.View>
        <Animated.View
          entering={reducedMotion ? FadeIn.duration(0) : FadeInDown.duration(360).delay(340)}
          style={{ marginTop: 10, alignItems: "center", paddingHorizontal: 16 }}
        >
          <Low size={15} style={{ textAlign: "center", lineHeight: 22 }}>
            {streakPhrase}
            <Mono size={15} color={t.txtMid}>{money(amount)}</Mono>
            <Low size={15}>{" logged."}</Low>
          </Low>
        </Animated.View>

        {/* CTAs pinned near the bottom */}
        <Animated.View
          entering={reducedMotion ? FadeIn.duration(0) : FadeInDown.duration(360).delay(420)}
          style={{ position: "absolute", left: 24, right: 24, bottom: insets.bottom + 24, gap: 10 }}
        >
          <Btn label="Done" onPress={onDone} />
          {onViewStreak && streakMonths >= 1 && (
            <Btn label="View streak" variant="ghost" onPress={onViewStreak} />
          )}
        </Animated.View>

        {/* Tap outside CTA area dismisses */}
        <Pressable
          onPress={onDone}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 60 }}
        />
    </Animated.View>
  );
}
