/**
 * Compact altitude badge for the Home screen. A single-row card showing
 * the user's current rank with a tier-color glow, tappable to open the
 * full League / Climb screens.
 *
 * Hidden when the user hasn't set an income yet — defaulting everyone to
 * "Lost at Sea" would feel like a punishment in the morning glance.
 */
import { useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Low, Txt } from "@/components/ui";
import { useJudith } from "@/contexts/JudithStore";
import { useAltitudeSnapshot } from "@/hooks/useAltitudeSnapshot";
import { useTheme } from "@/hooks/useTheme";
import { levelMeta, tierForLevel } from "@/lib/altitude";

export function AltitudeBadge() {
  const t = useTheme();
  const router = useRouter();
  const { level, streak, loading } = useAltitudeSnapshot();
  const { monthlyIncome, incomeByMonth } = useJudith();

  const hasIncome =
    (typeof monthlyIncome === "number" && monthlyIncome > 0) ||
    Object.values(incomeByMonth ?? {}).some((v) => typeof v === "number" && v > 0);

  if (loading || !hasIncome) return null;

  const tier = tierForLevel(level);
  const meta = levelMeta(level);

  return (
    <Pressable
      onPress={() => router.push("/altitude" as Href)}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          paddingLeft: 10,
          paddingRight: 14,
          backgroundColor: t.surface1,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: 14,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Tier-color hex chip with the level number — compact stand-in for
          the full DivisionShield so the home row stays light. */}
      <HexChip color={tier.color} light={tier.light} level={level} />

      <View style={{ flex: 1, gap: 1 }}>
        <Low size={10} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
          Altitude
        </Low>
        <Txt size={14} weight="semibold" color={t.txtHi}>
          {meta.rank}
          <Txt size={12} weight="regular" color={t.txtMid}>
            {"  ·  "}
            {tier.name}
          </Txt>
        </Txt>
        {streak >= 2 ? (
          <Low size={11} color={tier.color}>
            🔥 {streak}-month climb streak
          </Low>
        ) : null}
      </View>

      <Icon name="chev" size={16} color={t.txtMid} />
    </Pressable>
  );
}

function HexChip({ color, light, level }: { color: string; light: string; level: number }) {
  // Simple gradient circle with the level number stamped on it — visually
  // distinct from regular icons but still cheap to render.
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 9,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        // Faux gradient: a small lighter pill at the top fakes the
        // shield's signature top-stop.
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 14,
          backgroundColor: light,
          opacity: 0.5,
        }}
      />
      <Txt size={15} weight="bold" color="white">
        {level}
      </Txt>
    </View>
  );
}
