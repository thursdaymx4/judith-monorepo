import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import {
  Card,
  Dot,
  Low,
  mix,
  Mono,
  Pill,
  ProviderLogo,
  Screen,
  SectionLabel,
  Txt,
  type Urgency,
} from "@/components/ui";
import { dueClass, dueShort, type Bill } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_INDEX = 5; // June
const YEAR = 2026;
const FIRST_DOW = 1; // Jun 1 2026 falls on column 1 (Sun-start grid)
const DAYS_IN_MONTH = 30;
const TODAY = 1;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const fmtK = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : String(n);

type ByDay = Record<number, Bill[]>;

/* ---- shared improved legend ---- */
function CalLegend() {
  const t = useTheme();
  const items: { kind: Urgency; label: string; sub: string }[] = [
    { kind: "urgent", label: "Urgent", sub: "≤3 days" },
    { kind: "near", label: "This week", sub: "≤7 days" },
    { kind: "ok", label: "Upcoming", sub: "later" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
      {items.map((it) => (
        <View
          key={it.kind}
          style={{
            flex: 1,
            alignItems: "flex-start",
            gap: 1,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hair2,
          }}
        >
          <View style={{ marginBottom: 3 }}>
            <Dot kind={it.kind} size={8} />
          </View>
          <Txt size={11.5} weight="semibold">
            {it.label}
          </Txt>
          <Low size={9.5}>{it.sub}</Low>
        </View>
      ))}
    </View>
  );
}

/* ---- variant: heatmap dots ---- */
function CalHeat({
  byDay,
  sel,
  setSel,
}: {
  byDay: ByDay;
  sel: number | null;
  setSel: (d: number | null) => void;
}) {
  const t = useTheme();
  const cells: (number | null)[] = [];
  for (let i = 0; i < FIRST_DOW; i++) cells.push(null);
  for (let d = 1; d <= DAYS_IN_MONTH; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  let maxDay = 1;
  Object.keys(byDay).forEach((k) => {
    const total = (byDay[Number(k)] || [])
      .filter((b) => b.status !== "paid")
      .reduce((s, b) => s + b.amount, 0);
    if (total > maxDay) maxDay = total;
  });

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <Card style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
      {/* day-of-week header */}
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 8 }}>
        {DOW.map((d, i) => (
          <Txt
            key={i}
            size={10}
            weight="semibold"
            color={t.txtLow}
            style={{ flex: 1, textAlign: "center" }}
          >
            {d}
          </Txt>
        ))}
      </View>
      {/* grid */}
      <View style={{ gap: 4 }}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: 4 }}>
            {row.map((d, ci) => {
              if (d == null) return <View key={"e" + ci} style={{ flex: 1 }} />;
              const items = byDay[d] || [];
              const due = items.filter((b) => b.status !== "paid");
              const top = due.slice().sort((a, b) => a.dueDays - b.dueDays)[0];
              const cls = top ? (dueClass(top.dueDays) as Urgency) : null;
              const isToday = d === TODAY;
              const isSel = d === sel;
              const dayTotal = due.reduce((s, b) => s + b.amount, 0);
              const sz = due.length
                ? Math.round(13 + (dayTotal / maxDay) * 20)
                : 0;
              const dotColor = cls ? t.semantic[cls] : t.txtLow;
              return (
                <Pressable
                  key={d}
                  onPress={() => setSel(isSel ? null : items.length ? d : null)}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: isToday ? t.accent : "transparent",
                    backgroundColor: isSel
                      ? mix(t.accent, t.surface2, 0.22)
                      : "transparent",
                  }}
                >
                  {due.length > 0 && (
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
                      <View
                        style={{
                          width: sz,
                          height: sz,
                          borderRadius: sz / 2,
                          backgroundColor: dotColor,
                          opacity: 0.9,
                          shadowColor: dotColor,
                          shadowOpacity: 0.7,
                          shadowRadius: Math.round(sz / 2),
                          shadowOffset: { width: 0, height: 0 },
                        }}
                      />
                    </View>
                  )}
                  <Txt
                    size={10}
                    weight={due.length ? "bold" : "regular"}
                    color={due.length ? t.onAccent : t.txtLow}
                  >
                    {d}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {/* scale legend */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginTop: 14,
        }}
      >
        <Low size={10}>smaller bill</Low>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          {[7, 11, 16, 22].map((s) => (
            <View
              key={s}
              style={{
                width: s,
                height: s,
                borderRadius: s / 2,
                backgroundColor: mix(t.accent, t.surface3, 0.6),
              }}
            />
          ))}
        </View>
        <Low size={10}>bigger</Low>
      </View>
    </Card>
  );
}

export default function CalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const { bills, persona, money } = useJudith();
  const [sel, setSel] = useState<number | null>(null);

  const openBill = (b: Bill) => router.push(`/bill/${b.id}`);

  const dueBills = bills.filter((b) => b.status !== "paid");
  const byDay: ByDay = {};
  bills.forEach((b) => {
    (byDay[b.dueDate] = byDay[b.dueDate] || []).push(b);
  });

  const monthTotal = dueBills.reduce((s, b) => s + b.amount, 0);
  const agenda =
    sel != null
      ? byDay[sel] || []
      : dueBills.slice().sort((a, b) => a.dueDate - b.dueDate);
  const agendaPaid = sel == null ? bills.filter((b) => b.status === "paid") : [];

  /* weekly cash-flow ranges */
  const dim = new Date(YEAR, MONTH_INDEX + 1, 0).getDate();
  const ranges: [number, number][] = [];
  for (let s = 1; s <= dim; s += 7) ranges.push([s, Math.min(s + 6, dim)]);
  const weeks = ranges.map(() => 0);
  dueBills.forEach((b) => {
    const w = Math.min(ranges.length - 1, Math.floor((b.dueDate - 1) / 7));
    weeks[w]! += b.amount;
  });
  const maxW = Math.max(1, ...weeks);

  return (
    <Screen>
      {/* header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <View>
          <Txt size={28} weight="semibold" style={{ letterSpacing: -0.56 }}>
            Calendar
          </Txt>
          <Low size={12} style={{ marginTop: 2 }}>
            {MONTHS[MONTH_INDEX]} {YEAR}
          </Low>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: t.hair,
              backgroundColor: t.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <Icon name="chev" size={15} color={t.txtMid} />
            </View>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: t.hair,
              backgroundColor: t.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="chev" size={15} color={t.txtMid} />
          </View>
        </View>
      </View>

      {/* month summary */}
      <Card
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <View>
          <Low size={12}>Due in {MONTHS[MONTH_INDEX]}</Low>
          <Mono size={24} weight="semibold">
            {money(monthTotal)}
          </Mono>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Low size={12} style={{ textAlign: "right" }}>
            <Txt size={12} weight="semibold" color={t.txtHi}>
              {dueBills.length}
            </Txt>{" "}
            bills
          </Low>
          <Low size={12} style={{ textAlign: "right" }}>
            <Txt size={12} weight="semibold" color={t.semantic.near}>
              {dueBills.filter((b) => b.dueDays <= 7).length}
            </Txt>{" "}
            this week
          </Low>
        </View>
      </Card>

      <CalLegend />

      <CalHeat byDay={byDay} sel={sel} setSel={setSel} />

      {/* weekly cash flow */}
      <View style={{ marginTop: 14 }}>
        <SectionLabel style={{ marginTop: 0 }}>Weekly cash flow</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {weeks.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
              <Mono
                size={10}
                weight="semibold"
                color={w > 0 ? t.txtHi : t.txtLow}
              >
                {w > 0 ? "₱" + fmtK(w) : "—"}
              </Mono>
              <View
                style={{
                  width: "100%",
                  height: 54,
                  borderRadius: 9,
                  backgroundColor: t.surface2,
                  borderWidth: 1,
                  borderColor: t.hair2,
                  justifyContent: "flex-end",
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={[mix(t.accent, t.surface3, 0.35), t.accent]}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={{
                    width: "100%",
                    height: `${Math.round((w / maxW) * 100)}%`,
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                  }}
                />
              </View>
              <Low size={9}>
                {ranges[i]![0] === ranges[i]![1]
                  ? ranges[i]![0]
                  : ranges[i]![0] + "–" + ranges[i]![1]}
              </Low>
            </View>
          ))}
        </View>
      </View>

      {/* agenda */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 18,
          marginBottom: 10,
        }}
      >
        <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>
          {sel != null ? `${MONTHS[MONTH_INDEX]} ${sel}` : "Upcoming"}
        </SectionLabel>
        {sel != null && (
          <Pill
            onPress={() => setSel(null)}
            style={{ paddingVertical: 4, paddingHorizontal: 11 }}
          >
            <Txt size={12} color={t.txtMid}>
              Show all
            </Txt>
          </Pill>
        )}
      </View>

      {agenda.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 26, paddingHorizontal: 16 }}>
          <JudithAvatar persona={persona} size={56} state="idle" />
          <Txt size={14} weight="semibold" style={{ marginTop: 12 }}>
            Nothing due that day
          </Txt>
          <Low size={13} style={{ marginTop: 3 }}>
            Enjoy the quiet — I’ll flag the next one.
          </Low>
        </Card>
      ) : (
        <View style={{ gap: 9 }}>
          {agenda.map((b) => {
            const cls = dueClass(b.dueDays) as Urgency;
            return (
              <CalBillRow
                key={b.id}
                bill={b}
                onPress={() => openBill(b)}
                amtColor={t.semantic[cls]}
                money={money}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Dot kind={cls} />
                  <Low size={12}>
                    {b.cat} · {dueShort(b.dueDays)}
                  </Low>
                </View>
              </CalBillRow>
            );
          })}
        </View>
      )}

      {agendaPaid.length > 0 && (
        <View>
          <SectionLabel>Paid this month</SectionLabel>
          <View style={{ gap: 9 }}>
            {agendaPaid.map((b) => (
              <CalBillRow
                key={b.id}
                bill={b}
                onPress={() => openBill(b)}
                amtColor={t.txtLow}
                money={money}
                paid
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Icon name="check" size={12} color={t.txtLow} />
                  <Low size={12}>Paid · {b.cat}</Low>
                </View>
              </CalBillRow>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

/* ---- agenda bill row with date chip (cal-daychip) ---- */
function CalBillRow({
  bill,
  onPress,
  amtColor,
  money,
  paid,
  children,
}: {
  bill: Bill;
  onPress: () => void;
  amtColor: string;
  money: (n: number) => string;
  paid?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: t.radius.md,
          backgroundColor: t.surface2,
          paddingVertical: 13,
          paddingHorizontal: 14,
          opacity: paid ? 0.55 : 1,
        },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View
        style={{
          width: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          backgroundColor: t.surface3,
          paddingVertical: 5,
        }}
      >
        <Mono size={16} weight="semibold" style={{ lineHeight: 16 }}>
          {bill.dueDate}
        </Mono>
        <Low size={9} style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
          {MONTHS[MONTH_INDEX]!.slice(0, 3)}
        </Low>
      </View>
      <ProviderLogo provider={bill.provider} cat={bill.cat} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={14} weight="medium">
          {bill.provider}
        </Txt>
        {children}
      </View>
      <Mono size={14} color={amtColor}>
        {money(bill.amount)}
      </Mono>
    </Pressable>
  );
}
