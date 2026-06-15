/**
 * Per-bill streak card for the Bill Detail screen.
 *
 * Top line: flame glyph + N-month/year on-time streak (or "Start your streak"
 *   when there's no history yet).
 * Bottom row: trailing 12 monthly dots OR trailing 5 yearly dots, depending on
 *   the bill's cadence.
 *
 * Renders nothing for streak-ineligible bills (one-time + via-card).
 */
import React from "react";
import { View } from "react-native";

import { Icon } from "@/components/Icon";
import { Card, Low, Mono, Txt } from "@/components/ui";
import type { Bill } from "@/constants/data";
import { useTheme } from "@/hooks/useTheme";
import { computeBillStreak, isStreakEligible, type MonthStatus } from "@/lib/billStreak";

interface Props {
  bill: Bill;
}

export function BillStreakCard({ bill }: Props) {
  const t = useTheme();
  if (!isStreakEligible(bill)) return null;
  const streak = computeBillStreak(bill);
  const isAnnual = bill.frequency === "annual";
  const dots = isAnnual ? streak.yearStatuses : streak.monthStatuses;

  const unit = isAnnual ? "year" : "month";
  const count = isAnnual ? streak.yearStreak : streak.currentMonths;
  const headline =
    streak.closedCycles === 0
      ? "Start your streak"
      : count === 0
        ? "Streak broken — restart this cycle"
        : `${count}-${unit} on-time streak`;

  return (
    <Card style={{ paddingVertical: 14, paddingHorizontal: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: count > 0 ? t.accent + "22" : t.surface2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="flame" size={18} color={count > 0 ? t.accent : t.txtMid} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="semibold">{headline}</Txt>
          {streak.closedCycles > 0 && (
            <Low size={11} style={{ marginTop: 2 }}>
              Best{" "}
              <Mono size={11} weight="semibold" color={t.txtMid}>
                {streak.bestMonths}
              </Mono>
              {" "}· On-time{" "}
              <Mono size={11} weight="semibold" color={t.txtMid}>
                {Math.round(streak.onTimeRate * 100)}%
              </Mono>
            </Low>
          )}
        </View>
      </View>

      {/* Trailing 12-month (or 5-year) status dots. Oldest left, newest right. */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 }}>
        {dots.map((s, i) => (
          <StatusDot key={i} status={s} accent={t.accent} hair={t.hair} txtLow={t.txtLow} />
        ))}
      </View>
    </Card>
  );
}

function StatusDot({
  status,
  accent,
  hair,
  txtLow,
}: {
  status: MonthStatus;
  accent: string;
  hair: string;
  txtLow: string;
}) {
  const base = { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 } as const;
  switch (status) {
    case "onTime":
      return <View style={[base, { backgroundColor: accent, borderColor: accent }]} />;
    case "late":
      return <View style={[base, { backgroundColor: "transparent", borderColor: accent }]} />;
    case "missed":
      return <View style={[base, { backgroundColor: "transparent", borderColor: "#E5484D" }]} />;
    case "untracked":
    default:
      return <View style={[base, { backgroundColor: "transparent", borderColor: hair, opacity: 0.55, borderStyle: "dashed" }]} />;
  }
}
