/**
 * Financial Altitude — Climb screen.
 *
 * Vertical scroll. Summary row → altitude-profile chart → month-by-month
 * card list. Per-spec, the altitude number itself is never surfaced; only
 * level, rank, and the relative delta from the prior month.
 */
import React, { useMemo, useState } from "react";
import { Dimensions, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AltitudeChart } from "@/components/altitude/AltitudeChart";
import { DriftBackdrop } from "@/components/altitude/DriftBackdrop";
import { MiniHex } from "@/components/altitude/MiniHex";
import { ShareButton } from "@/components/altitude/ShareButton";
import { Icon } from "@/components/Icon";
import { Low, RoundBtn, SectionLabel, Txt } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "expo-router";
import { safeBack } from "@/lib/navigation";
import { useAltitudeSnapshot } from "@/hooks/useAltitudeSnapshot";
import {
  climbStreak,
  levelMeta,
  MILESTONES,
  tierForLevel,
  totalClimb,
  type MonthGrade,
} from "@/lib/altitude";

export default function ClimbScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { history } = useAltitudeSnapshot();
  const [chartWidth, setChartWidth] = useState(Dimensions.get("window").width - 70);

  const reversed = useMemo(() => [...history].reverse(), [history]);
  const streak = climbStreak(history);
  const climbed = totalClimb(history);
  const newest = history.length > 0 ? history[history.length - 1]! : null;
  const tier = newest ? tierForLevel(newest.level) : tierForLevel(1);

  const newestLevel = newest ? newest.level : 1;

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      <DriftBackdrop tier={tier} />
      <ShareButton level={newestLevel} streak={streak} top={insets.top + 6} />
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <RoundBtn icon="chev" onPress={() => safeBack(router)} />
        <Txt size={16} weight="semibold" color={t.txtHi}>
          Your climb
        </Txt>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: 20,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
            padding: 14,
            backgroundColor: t.surface1,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 16,
          }}
        >
          <SummaryCell
            label="LEVELS GAINED"
            value={signed(climbed)}
            tone={climbed > 0 ? tier.color : climbed < 0 ? t.txtMid : t.txtHi}
          />
          <Divider />
          <SummaryCell label="STREAK" value={`${streak} mo`} tone="#F2C94C" />
          <Divider />
          <SummaryCell label="LOGGED" value={`${history.length}`} tone={t.txtHi} />
        </View>

        {/* Altitude profile chart */}
        <View
          style={{
            padding: 14,
            backgroundColor: t.surface1,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 16,
            gap: 8,
          }}
          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - 24)}
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
              {climbed > 0 ? "climbing ▲" : climbed < 0 ? "drifting ▼" : "holding —"}
            </Low>
          </View>
          <AltitudeChart history={history} width={chartWidth} height={180} />
        </View>

        {/* Month-by-month cards */}
        <View style={{ gap: 8 }}>
          <SectionLabel>Month by month</SectionLabel>
          {reversed.length === 0 ? (
            <View
              style={{
                padding: 18,
                backgroundColor: t.surface1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: t.hair,
                alignItems: "center",
              }}
            >
              <Low size={13}>Your first month is being recorded — come back next month.</Low>
            </View>
          ) : (
            reversed.map((m, i) => {
              const next = reversed[i + 1]; // older month
              const delta = next ? m.level - next.level : 0;
              const isNewest = i === 0;
              return (
                <MonthRow
                  key={m.month}
                  grade={m}
                  delta={delta}
                  isNewest={isNewest}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MonthRow({
  grade,
  delta,
  isNewest,
}: {
  grade: MonthGrade;
  delta: number;
  isNewest: boolean;
}) {
  const t = useTheme();
  const tier = tierForLevel(grade.level);
  const meta = levelMeta(grade.level);
  const milestone = grade.milestone
    ? MILESTONES.find((m) => m.id === grade.milestone)
    : undefined;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        backgroundColor: t.surface1,
        borderWidth: 1,
        borderColor: isNewest ? tier.color : t.hair,
        borderRadius: 14,
      }}
    >
      <MiniHex level={grade.level} size={44} label={String(grade.level)} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt size={13} color={t.txtMid}>
            {formatMonth(grade.month)}
          </Txt>
          {isNewest ? (
            <View
              style={{
                backgroundColor: tier.color,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
              }}
            >
              <Txt size={9} weight="bold" color="white">
                NOW
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt size={15} weight="semibold" color={t.txtHi}>
          {meta.rank}
        </Txt>
        {milestone ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Icon name="star" size={11} color="#F2C94C" />
            <Low size={11} style={{ color: "#F2C94C" }}>
              {milestone.name}
            </Low>
          </View>
        ) : null}
      </View>
      <DeltaPill delta={delta} />
    </View>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  const t = useTheme();
  const isUp = delta > 0;
  const isDown = delta < 0;
  const color = isUp ? "#22C98E" : isDown ? "#E5605E" : t.txtMid;
  const label = isUp ? `▲ ${delta}` : isDown ? `▼ ${Math.abs(delta)}` : "— hold";
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: `${color}22`,
      }}
    >
      <Txt size={11} weight="semibold" color={color}>
        {label}
      </Txt>
    </View>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
      <Low size={9} style={{ letterSpacing: 0.8 }}>
        {label}
      </Low>
      <Txt size={16} weight="bold" color={tone}>
        {value}
      </Txt>
    </View>
  );
}

function Divider() {
  const t = useTheme();
  return <View style={{ width: 1, backgroundColor: t.hair, marginVertical: 4 }} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n === 0) return "0";
  return `${n}`;
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return `${MONTH_LABELS[month - 1]} ${year}`;
}
