import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import {
  BellBtn,
  Card,
  Chip,
  Dot,
  Low,
  Mono,
  Pill,
  ProviderLogo,
  Screen,
  SectionLabel,
  SpeechBubble,
  Txt,
} from "@/components/ui";
import { CAT_ICONS, currentCycleDue, dueClass, dueShort, isPaidViaCard, isPartialBill, partialPct, totalOwed, type Bill } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useCountUp } from "@/hooks/useCountUp";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTheme } from "@/hooks/useTheme";

/** Timeline rail dot — pulses an expanding halo when the bill is urgent/overdue. */
function PulseDot({ color, active, reduce }: { color: string; active: boolean; reduce: boolean }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduce) return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduce, pulse]);
  return (
    <View style={{ marginTop: 18, width: 11, height: 11, alignItems: "center", justifyContent: "center" }}>
      {active && !reduce && (
        <Animated.View
          style={{
            position: "absolute",
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
          }}
        />
      )}
      <View
        style={{
          width: 11,
          height: 11,
          borderRadius: 6,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: t.canvas,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}

/** Wraps a timeline row in a one-shot rise+fade reveal, staggered by index. */
function StaggerRow({
  index,
  reduce,
  children,
  style,
}: {
  index: number;
  reduce: boolean;
  children: React.ReactNode;
  style?: any;
}) {
  const op = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const ty = useRef(new Animated.Value(reduce ? 0 : 10)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 360, delay: index * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 360, delay: index * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={[style, { opacity: op, transform: [{ translateY: ty }] }]}>{children}</Animated.View>;
}

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { bills, persona, money } = useJudith();
  const reduce = useReducedMotion();
  const [sortBy, setSortBy] = useState<"dueDate" | "amount">("dueDate");
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const todayDay = new Date().getDate();
  const _today = new Date();
  const currentPeriodKey = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, "0")}`;
  // Use paymentHistory as source of truth — b.status advances to next month after paying,
  // so it cannot tell us whether THIS month's bill was paid.
  const isPaidThisMonth = (b: Bill): boolean =>
    (b.paymentHistory ?? []).some((r) => r.period === currentPeriodKey && r.paid >= r.totalDue);
  const amtPaidThisMonth = (b: Bill): number => {
    const rec = (b.paymentHistory ?? []).find((r) => r.period === currentPeriodKey);
    if (rec) return rec.paid;
    return b.amountPaid ?? 0; // in-progress partial (no history record yet)
  };
  const ccStatementToday = bills.filter(
    (b) => b.cat === "Credit card" && b.statementDay === todayDay,
  );

  // dueDays/dueLabel on the stored bill are stale snapshots the store never
  // refreshes; recompute them live (signed, so passed-but-unpaid bills stay
  // negative/overdue) so the timeline matches the calendar.
  const liveBills = bills.map((b) => ({ ...b, ...currentCycleDue(b, _today) }));
  const due = liveBills
    .filter((b) => !isPaidThisMonth(b))
    .slice()
    .sort((a, b) => a.dueDays - b.dueDays);

  // Only show bills that are overdue or due within the next 60 days in the timeline
  const timelineBills = due.filter((b) => b.dueDays <= 60);

  // Build unique category list ordered by count (most-billed first)
  const catCounts: Record<string, number> = {};
  timelineBills.forEach((b) => { catCounts[b.cat] = (catCounts[b.cat] ?? 0) + 1; });
  const cats = Object.keys(catCounts).sort((a, b) => catCounts[b]! - catCounts[a]!);
  const showFilters = cats.length > 1;

  // Apply active filter then chosen sort order
  const visible = timelineBills
    .filter((b) => filterCat === null || b.cat === filterCat)
    .slice()
    .sort((a, b) => sortBy === "amount" ? totalOwed(b) - totalOwed(a) : a.dueDays - b.dueDays);
  // Remaining balance per bill (full amount minus any payment already made this period)
  const remaining = (b: Bill) => Math.max(0, totalOwed(b) - amtPaidThisMonth(b));
  // Money totals exclude bills auto-charged to a linked card — their cost is
  // already in the card's statement, so counting both would double-count. They
  // still appear in the timeline below, tagged "via card".
  const payable = due.filter((b) => !isPaidViaCard(b));
  const total = payable.reduce((s, b) => s + remaining(b), 0);
  const week = payable.filter((b) => b.dueDays >= 0 && b.dueDays <= 7);
  const weekSum = week.reduce((s, b) => s + remaining(b), 0);
  const soon = payable.filter((b) => b.dueDays <= 3).length;

  const overdue = payable.filter((b) => b.dueDays < 0);
  const overdueTotal = overdue.reduce((s, b) => s + remaining(b), 0);
  const openOverdue = () =>
    overdue.length === 1
      ? router.push(`/bill/${overdue[0]!.id}`)
      : router.push("/bills");

  // Paid-progress also tracks only bills you fund directly (excludes via-card).
  const payableAll = bills.filter((b) => !isPaidViaCard(b));
  const paid = payableAll.filter((b) => isPaidThisMonth(b));
  const unpaid = payableAll.filter((b) => !isPaidThisMonth(b));
  // paidAmt = fully paid bills + in-progress partial payments on unpaid bills
  const paidAmt =
    paid.reduce((s, b) => s + amtPaidThisMonth(b), 0) +
    unpaid.reduce((s, b) => s + amtPaidThisMonth(b), 0);
  // unpaidAmt is only the remaining balance, not the full original amount
  const unpaidAmt = unpaid.reduce((s, b) => s + remaining(b), 0);
  const grand = paidAmt + unpaidAmt;
  const pct = grand > 0 ? Math.round((paidAmt / grand) * 100) : 0;

  const pctAnim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    if (reduce) {
      pctAnim.setValue(pct);
      return;
    }
    Animated.timing(pctAnim, {
      toValue: pct,
      duration: 700,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, reduce]);

  const totalA = useCountUp(total);
  const weekA = useCountUp(weekSum);

  const openBill = (b: Bill) => router.push(`/bill/${b.id}`);

  return (
    <Screen>
      {/* header */}
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <JudithAvatar persona={persona} size={52} state="idle" />
        <SpeechBubble>
          <Txt size={14} weight="semibold" style={{ lineHeight: 17 }}>
            {due.length > 0
              ? `${due.length} ${due.length === 1 ? "bill" : "bills"} this month`
              : "You’re all caught up"}
          </Txt>
          <Low size={12} style={{ marginTop: 2 }}>
            {due.length > 0
              ? week.length > 0
                ? `${week.length} due this week — I’ve got it`
                : "nothing due this week"
              : "no bills due right now"}
          </Low>
        </SpeechBubble>
        <BellBtn count={soon} onPress={() => router.push("/reminders")} />
      </View>

      {/* overdue strip — only when something is past due */}
      {overdue.length > 0 && (
        <Pressable
          onPress={openOverdue}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
              paddingVertical: 10,
              paddingHorizontal: 13,
              marginBottom: 14,
              borderRadius: t.radius.md,
              borderWidth: 1,
              borderColor: t.semantic.overdue + "66",
              backgroundColor: t.semantic.overdue + "12",
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.semantic.overdue }} />
          <Txt size={13} weight="medium" style={{ flex: 1 }}>
            {overdue.length === 1
              ? `${overdue[0]!.provider} · ${dueShort(overdue[0]!.dueDays)}`
              : `${overdue.length} bills overdue`}
          </Txt>
          <Mono size={13} weight="bold" color={t.semantic.overdue}>
            {money(overdueTotal)}
          </Mono>
          <Icon name="chev" size={16} color={t.semantic.overdue} />
        </Pressable>
      )}

      {/* CC statement nudge — shows on the day a statement is released */}
      {ccStatementToday.length > 0 && (
        <View style={{ marginBottom: 14, gap: 8 }}>
          {ccStatementToday.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/bill/${b.id}`)}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: t.radius.md,
                  borderWidth: 1,
                  borderColor: t.semantic.near + "66",
                  backgroundColor: t.semantic.near + "12",
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Icon name="card" size={18} color={t.semantic.near} />
              <View style={{ flex: 1 }}>
                <Txt size={13} weight="semibold">
                  Did your {b.provider} statement come in?
                </Txt>
                <Low size={12} style={{ marginTop: 1 }}>
                  Tap to update the amount if it did
                </Low>
              </View>
              <Icon name="chev" size={16} color={t.semantic.near} />
            </Pressable>
          ))}
        </View>
      )}

      {/* stat duo */}
      <Card style={{ flexDirection: "row", padding: 0, overflow: "hidden", marginBottom: 14 }}>
        <View style={{ flex: 1.3, paddingVertical: 14, paddingHorizontal: 15 }}>
          <Mono size={24} weight="bold">
            {money(Math.round(totalA))}
          </Mono>
          <Low size={12} style={{ marginTop: 2 }}>
            due this month
          </Low>
        </View>
        <View style={{ width: 1, backgroundColor: t.hair }} />
        <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 15 }}>
          <Mono size={24} weight="bold" color={t.semantic.near}>
            {money(Math.round(weekA))}
          </Mono>
          <Low size={12} style={{ marginTop: 2 }}>
            next 7 days
          </Low>
        </View>
      </Card>

      {/* paid this month */}
      <Card style={{ marginBottom: 14, paddingVertical: 14, paddingHorizontal: 15 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
          <Txt size={14} weight="semibold">
            Paid this month
          </Txt>
          <Mono size={13} weight="bold" color={t.semantic.ok}>
            {pct}%
          </Mono>
        </View>
        <View style={{ height: 12, borderRadius: 7, backgroundColor: t.surface3, overflow: "hidden" }}>
          <Animated.View
            style={{
              height: "100%",
              borderRadius: 7,
              backgroundColor: t.semantic.ok,
              width: pctAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
            }}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 9 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Dot kind="ok" />
            <Txt size={12}>
              {paid.length} paid · <Mono size={12}>{money(paidAmt)}</Mono>
            </Txt>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.surface3 }} />
            <Txt size={12}>
              {unpaid.length} unpaid · <Mono size={12}>{money(unpaidAmt)}</Mono>
            </Txt>
          </View>
        </View>
      </Card>

      {/* timeline */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: showFilters ? 8 : 12 }}>
        <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>
          {filterCat ?? "Next 60 days"}
        </SectionLabel>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Pressable
            onPress={() => { haptics.selection(); setSortBy((s) => s === "dueDate" ? "amount" : "dueDate"); }}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20, borderWidth: 1,
              borderColor: sortBy !== "dueDate" ? t.accent : t.hair,
              backgroundColor: sortBy !== "dueDate" ? t.accent + "22" : "transparent",
            }}
          >
            <Icon name="sliders" size={11} color={sortBy !== "dueDate" ? t.accent : t.txtMid} />
            <Txt size={11} color={sortBy !== "dueDate" ? t.accent : t.txtMid}>
              {sortBy === "amount" ? "Amount" : "Due date"}
            </Txt>
          </Pressable>
          <Pill onPress={() => router.push("/bills")} style={{ paddingVertical: 4, paddingHorizontal: 11 }}>
            <Txt size={12} color={t.txtMid}>See all · {due.length}</Txt>
          </Pill>
        </View>
      </View>

      {showFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12, marginHorizontal: -4 }}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 6, flexDirection: "row" }}
        >
          <Chip
            label="All"
            selected={filterCat === null}
            onPress={() => { haptics.selection(); setFilterCat(null); }}
          />
          {cats.map((c) => (
            <Chip
              key={c}
              label={c}
              icon={(CAT_ICONS[c] ?? "spark") as IconName}
              selected={filterCat === c}
              onPress={() => { haptics.selection(); setFilterCat(filterCat === c ? null : c); }}
            />
          ))}
        </ScrollView>
      )}

      <View>
        {visible.map((b, i) => {
          const cls = dueClass(b.dueDays);
          const last = i === visible.length - 1;
          return (
            <StaggerRow key={b.id} index={i} reduce={reduce} style={{ marginBottom: last ? 0 : 12 }}>
            <Pressable
              onPress={() => openBill(b)}
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "stretch", gap: 10 },
                pressed && { opacity: 0.85 },
              ]}
            >
              {/* rail */}
              <View style={{ width: 14, alignItems: "center" }}>
                <View style={{ position: "absolute", top: 0, bottom: -12, width: 2, backgroundColor: t.hair }} />
                <PulseDot
                  color={t.semantic[cls]}
                  active={cls === "overdue" || cls === "urgent"}
                  reduce={reduce}
                />
              </View>
              {/* date */}
              <View style={{ width: 34, alignItems: "center", justifyContent: "center" }}>
                <Mono size={15} weight="bold">
                  {b.dueDate}
                </Mono>
                <Low size={9} style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {b.dueLabel.split(" ")[0]}
                </Low>
              </View>
              {/* card */}
              {(() => {
                const partial = isPartialBill(b);
                const pct = partialPct(b);
                const owed = totalOwed(b);
                return (
                  <View
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: t.hair,
                      borderRadius: t.radius.md,
                      backgroundColor: t.surface2,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 11,
                        paddingVertical: 11,
                        paddingHorizontal: 12,
                      }}
                    >
                      <ProviderLogo provider={b.provider} cat={b.cat} size={34} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Txt size={14} weight="medium">
                            {b.provider}
                          </Txt>
                          {isPaidViaCard(b) && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 1, paddingHorizontal: 6, borderRadius: 8, backgroundColor: t.surface3 }}>
                              <Icon name="card" size={9} color={t.txtLow} />
                              <Low size={10}>via {bills.find((c) => c.id === b.parentCardId)?.provider ?? "card"}</Low>
                            </View>
                          )}
                        </View>
                        <Low size={12} style={{ marginTop: 2 }} color={isPaidViaCard(b) ? undefined : cls === "overdue" ? t.semantic.overdue : undefined}>
                          {b.cat} · {dueShort(b.dueDays)}
                        </Low>
                      </View>
                      <Mono size={14} color={isPaidViaCard(b) ? t.txtLow : t.semantic[cls]}>
                        {money(owed)}
                      </Mono>
                    </View>
                    {partial && (
                      <View style={{ height: 3, backgroundColor: t.surface3, overflow: "hidden" }}>
                        <View
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            backgroundColor: t.semantic.near,
                          }}
                        />
                      </View>
                    )}
                  </View>
                );
              })()}
            </Pressable>
            </StaggerRow>
          );
        })}
      </View>

    </Screen>
  );
}
