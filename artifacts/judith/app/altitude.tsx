/**
 * Financial Altitude — League screen.
 *
 * Vertical scroll. Shows the user's standing as a glowing division shield
 * surrounded by neighbor previews, the 6-division ladder, a next-level
 * nudge, milestones, and a CTA to the climb timeline.
 */
import { useRouter, type Href } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AltitudeChart } from "@/components/altitude/AltitudeChart";
import { DivisionShield } from "@/components/altitude/DivisionShield";
import { DriftBackdrop } from "@/components/altitude/DriftBackdrop";
import { MiniHex } from "@/components/altitude/MiniHex";
import { PromotionOverlay } from "@/components/altitude/PromotionOverlay";
import { PromotionRing } from "@/components/altitude/PromotionRing";
import { ShareButton } from "@/components/altitude/ShareButton";
import { Icon } from "@/components/Icon";
import { Low, RoundBtn, SectionLabel, Txt } from "@/components/ui";
import { safeBack } from "@/lib/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useAltitudeSnapshot } from "@/hooks/useAltitudeSnapshot";
import { isTierChange, useAltitudePromotion } from "@/contexts/AltitudePromotionContext";
import { useJudith } from "@/contexts/JudithStore";
import {
  MILESTONES,
  NUDGES,
  TIERS,
  levelMeta,
  nextTier,
  tierForLevel,
  totalClimb,
  unlockedMilestones,
  type Tier,
} from "@/lib/altitude";

export default function AltitudeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { history, level, streak, loading } = useAltitudeSnapshot();
  const { replay } = useAltitudePromotion();
  const { monthlyIncome, incomeByMonth } = useJudith();

  const tier = tierForLevel(level);
  const meta = levelMeta(level);
  const promo = nextTier(level);
  const hasIncome =
    (typeof monthlyIncome === "number" && monthlyIncome > 0) ||
    Object.values(incomeByMonth ?? {}).some((v) => typeof v === "number" && v > 0);

  /** Long-press on the shield → replay the most recent promotion the user
   *  could plausibly have seen. If they're on Level 1 we synthesize a
   *  "Level 1 → 2" preview so QA can still trigger the overlay. */
  const onShieldLongPress = () => {
    const to = Math.max(2, level);
    const from = Math.max(1, to - 1);
    Alert.alert("Replay celebration?", "Re-runs the promotion animation. Useful for QA + Instagram captures.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Replay",
        onPress: () =>
          replay({
            month: history[history.length - 1]?.month ?? "preview",
            from,
            to,
            isTierChange: isTierChange(from, to),
          }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      <DriftBackdrop tier={tier} />
      <PromotionOverlay />

      {/* Modal header — close on the left, share on the right. */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 4,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <RoundBtn icon="x" onPress={() => safeBack(router)} />
        <Low size={11} style={{ letterSpacing: 1.6, textTransform: "uppercase" }}>
          Your League
        </Low>
        <View style={{ width: 32 }} />
      </View>
      <ShareButton level={level} streak={streak} top={insets.top + 6} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >

        {/* Income gate — without an income figure the grade is locked to
            Level 1 by design. Surface that explicitly with a path to fix
            it, instead of letting the user wonder why they're "Lost at
            Sea" after just adding bills. */}
        {!hasIncome ? (
          <Pressable
            onPress={() => router.push("/account" as Href)}
            style={({ pressed }) => [
              {
                padding: 14,
                backgroundColor: t.surface1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tier.color,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Icon name="spark" size={20} color={tier.color} />
            <View style={{ flex: 1 }}>
              <Txt size={13} weight="semibold" color={t.txtHi}>
                Set your income to unlock your real altitude
              </Txt>
              <Low size={11} style={{ marginTop: 2 }}>
                Until then, your grade defaults to Lost at Sea — your actual
                bills can't be ranked without it.
              </Low>
            </View>
            <Icon name="chev" size={16} color={t.txtMid} />
          </Pressable>
        ) : null}

        {/* Hero: shield + neighbor previews */}
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <NeighborShield tier={prevTier(tier)} />
            <Pressable
              onLongPress={onShieldLongPress}
              delayLongPress={650}
              style={{ alignItems: "center" }}
            >
              {/* Promotion ring frames the hero. Stroke color is the NEXT
                  tier so the visual cue is "this is where you're climbing
                  to". On the top tier we draw a full ring in the current
                  tier color as a "completed" halo. */}
              <PromotionRing
                size={196}
                color={promo ? promo.tier.color : tier.color}
                fraction={promo ? promo.frac : 1}
              >
                <DivisionShield level={level} size={150} />
              </PromotionRing>
            </Pressable>
            <NeighborShield tier={nextTierObj(tier)} />
          </View>

          <Txt size={24} weight="bold" color={tier.color} style={{ marginTop: 14 }}>
            {tier.name}
          </Txt>
          <Low size={13} style={{ marginTop: 2 }}>
            {meta.rank} · LV {level}
          </Low>

          {promo ? (
            <Txt
              size={13}
              weight="semibold"
              color={t.txtMid}
              style={{ marginTop: 8 }}
            >
              ↑ {promo.toGo === 1 ? "1 level" : `${promo.toGo} levels`} to {promo.tier.name}
            </Txt>
          ) : (
            <Txt
              size={13}
              weight="semibold"
              color={tier.color}
              style={{ marginTop: 8 }}
            >
              Top division — you're flying free ✦
            </Txt>
          )}
        </View>

        {/* Climb-to nudge. The promotion progress arc lives around the
            hero shield itself now, so this card just needs the next-level
            label + the next-step nudge copy. */}
        {promo ? (
          <View
            style={{
              padding: 14,
              backgroundColor: t.surface1,
              borderWidth: 1,
              borderColor: t.hair,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: promo.tier.color + "22",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="arrow" size={18} color={promo.tier.color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={13} weight="semibold" color={t.txtHi}>
                Climb to Level {Math.min(10, level + 1)} · {levelMeta(level + 1).rank}
              </Txt>
              <Low size={12}>{NUDGES[level] ?? NUDGES[10]}</Low>
            </View>
          </View>
        ) : null}

        {/* All divisions ladder */}
        <View style={{ gap: 10 }}>
          <SectionLabel>All Divisions</SectionLabel>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingHorizontal: 4,
            }}
          >
            {TIERS.map((d) => {
              const isCurrent = d.id === tier.id;
              const isPast = TIERS.findIndex((x) => x.id === d.id) <
                TIERS.findIndex((x) => x.id === tier.id);
              const isLocked = !isCurrent && !isPast;
              return (
                <View key={d.id} style={{ alignItems: "center", gap: 5, flex: 1 }}>
                  <View style={{ position: "relative" }}>
                    <MiniHex
                      level={d.repLevel}
                      size={isCurrent ? 40 : 30}
                      state={isLocked ? "locked" : "current"}
                    />
                    {isPast ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name="check" size={isCurrent ? 16 : 12} color="white" />
                      </View>
                    ) : null}
                    {isLocked ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name="lock" size={11} color={t.txtLow} />
                      </View>
                    ) : null}
                  </View>
                  <Low
                    size={9}
                    style={{
                      textAlign: "center",
                      color: isCurrent ? d.color : t.txtLow,
                      fontWeight: isCurrent ? "700" : "500",
                    }}
                  >
                    {d.name}
                  </Low>
                </View>
              );
            })}
          </View>
        </View>

        {/* Milestones */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Milestones</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}
          >
            {MILESTONES.map((m) => {
              const unlocked = unlockedMilestones(level).some((u) => u.id === m.id);
              return (
                <View
                  key={m.id}
                  style={{
                    width: 150,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: t.surface1,
                    borderWidth: 1,
                    borderColor: unlocked ? tier.color : t.hair,
                    opacity: unlocked ? 1 : 0.55,
                  }}
                >
                  <Icon
                    name={unlocked ? "star" : "lock"}
                    size={18}
                    color={unlocked ? tier.color : t.txtLow}
                  />
                  <Txt
                    size={13}
                    weight="semibold"
                    color={t.txtHi}
                    style={{ marginTop: 6 }}
                  >
                    {m.name}
                  </Txt>
                  <Low size={11} style={{ marginTop: 2 }}>
                    {m.desc}
                  </Low>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* CTA */}
        <Pressable
          onPress={() => router.push("/climb" as Href)}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              backgroundColor: t.surface1,
              borderWidth: 1,
              borderColor: t.hair,
              borderRadius: 16,
              marginTop: 4,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View>
            <Txt size={14} weight="semibold" color={t.txtHi}>
              View your climb
            </Txt>
            <Low size={11} style={{ marginTop: 2 }}>
              {streak > 0 ? `${streak}-month climb streak` : "First snapshot — keep going"}
            </Low>
          </View>
          <Icon name="chev" size={18} color={t.txtMid} />
        </Pressable>

        {/* Tiny inline climb preview so the screen feels alive even before
            opening the full Climb view. */}
        {!loading && history.length >= 1 ? (
          <View
            style={{
              padding: 14,
              backgroundColor: t.surface1,
              borderWidth: 1,
              borderColor: t.hair,
              borderRadius: 16,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>
                Altitude profile
              </SectionLabel>
              <Low size={11} color={tier.color}>
                climbing ▲
              </Low>
            </View>
            <AltitudeChart history={history} width={300} height={140} />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 2,
              }}
            >
              <Stat label="LEVELS GAINED" value={`${signed(totalClimb(history))}`} color={tier.color} />
              <Stat label="STREAK" value={`${streak} mo`} color={t.txtHi} />
              <Stat label="LOGGED" value={`${history.length}`} color={t.txtHi} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prevTier(cur: Tier): Tier | null {
  const i = TIERS.findIndex((t) => t.id === cur.id);
  return i > 0 ? TIERS[i - 1]! : null;
}

function nextTierObj(cur: Tier): Tier | null {
  const i = TIERS.findIndex((t) => t.id === cur.id);
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1]! : null;
}

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n === 0) return "0";
  return `${n}`;
}

function NeighborShield({ tier }: { tier: Tier | null }) {
  if (!tier) return <View style={{ width: 60 }} />;
  return (
    <View style={{ opacity: 0.42, transform: [{ scale: 0.55 }] }}>
      <DivisionShield level={tier.repLevel} size={90} />
    </View>
  );
}

function RingPreview({ tier, fraction }: { tier: Tier; fraction: number }) {
  // Simple inline progress disc — phase 1 stand-in for the spec's animated
  // promotion ring. Renders as a colored arc filling the proportion of the
  // current tier the user has covered toward the next one.
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.06)",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 44 * fraction,
          backgroundColor: tier.color,
          opacity: 0.85,
        }}
      />
      <Icon name="arrow" size={18} color="white" />
    </View>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Low size={9} style={{ letterSpacing: 0.6 }}>
        {label}
      </Low>
      <Txt size={15} weight="bold" color={color}>
        {value}
      </Txt>
    </View>
  );
}
