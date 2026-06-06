import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";
import { Defs, LinearGradient as SvgGradient, Path, Stop, Svg } from "react-native-svg";

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

const AnimPath = Animated.createAnimatedComponent(Path);

/** Semicircular gauge showing paid-this-month progress. */
function PaymentGauge({
  pct, paidAmt, unpaidAmt, paidCount, unpaidCount, money, reduce,
}: {
  pct: number; paidAmt: number; unpaidAmt: number;
  paidCount: number; unpaidCount: number;
  money: (n: number) => string; reduce: boolean;
}) {
  const t = useTheme();
  const r = 105;
  const cx = 130;
  const cy = 122;
  const sw = 20;
  const circumference = Math.PI * r;

  const anim = useRef(new Animated.Value(reduce ? pct : 0)).current;
  useEffect(() => {
    if (reduce) { anim.setValue(pct); return; }
    Animated.timing(anim, {
      toValue: pct,
      duration: 950,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [pct, reduce]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const arcD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <Card style={{ marginBottom: 14, paddingTop: 10, paddingBottom: 14, paddingHorizontal: 15 }}>
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <View style={{ width: 260, height: 132 }}>
          <Svg width={260} height={132} viewBox="0 0 260 132">
            <Defs>
              <SvgGradient id="pg" x1={cx - r} y1={cy} x2={cx + r} y2={cy} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={t.accent} stopOpacity="0.35" />
                <Stop offset="1" stopColor={t.accent} stopOpacity="1" />
              </SvgGradient>
            </Defs>
            <Path d={arcD} stroke={t.surface3} strokeWidth={sw} strokeLinecap="round" fill="none" />
            <AnimPath
              d={arcD}
              stroke={"url(#pg)"}
              strokeWidth={sw}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
            />
          </Svg>
          <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, alignItems: "center" }}>
            <Mono size={46} weight="bold">{pct}%</Mono>
            <Low size={12} style={{ marginTop: 2 }}>Paid this month</Low>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Dot kind="ok" />
          <Txt size={12}>{paidCount} paid · <Mono size={12}>{money(paidAmt)}</Mono></Txt>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.surface3 }} />
          <Txt size={12}>{unpaidCount} unpaid · <Mono size={12}>{money(unpaidAmt)}</Mono></Txt>
        </View>
      </View>
    </Card>
  );
}

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
  const [filterCats, setFilterCats] = useState<Set<string>>(new Set());
  const [showBizOnly, setShowBizOnly] = useState(false);
  const [filterBiz, setFilterBiz] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);

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

  const daysLeftInMonth = new Date(_today.getFullYear(), _today.getMonth() + 1, 0).getDate() - _today.getDate();
  const timelineBills = due.filter((b) => b.dueDays <= daysLeftInMonth);

  // Business filter — scope timeline to isBusiness before building cats / visible.
  const hasBizBills = timelineBills.some((b) => b.isBusiness === true);
  // Distinct named businesses across ALL bills — drives the per-business identifier
  // on each row (only worth showing when the user juggles 2+ businesses).
  const bizName = (b: Bill) => (b.businessName ?? "").trim();
  const allBizNames = [...new Set(bills.filter((b) => b.isBusiness && bizName(b)).map(bizName))];
  const hasMultipleBiz = allBizNames.length > 1;
  // Businesses present in THIS month's timeline — drives the sub-filter chips.
  const timelineBizNames = [
    ...new Set(timelineBills.filter((b) => b.isBusiness && bizName(b)).map(bizName)),
  ].sort((a, b) => a.localeCompare(b));
  // Auto-heal a stale selection: if the chosen business no longer has bills this
  // month (e.g. they were all paid) its chip disappears, so ignore the filter
  // rather than silently showing an empty list with no way to clear it.
  const effectiveBiz = filterBiz && timelineBizNames.includes(filterBiz) ? filterBiz : null;
  const filteredTimeline = showBizOnly
    ? timelineBills.filter(
        (b) => b.isBusiness === true && (effectiveBiz === null || bizName(b) === effectiveBiz),
      )
    : timelineBills;

  // Build unique category list ordered by count (most-billed first)
  const catCounts: Record<string, number> = {};
  filteredTimeline.forEach((b) => { catCounts[b.cat] = (catCounts[b.cat] ?? 0) + 1; });
  const cats = Object.keys(catCounts).sort((a, b) => catCounts[b]! - catCounts[a]!);
  const showFilters = cats.length > 1 || hasBizBills;

  // Remaining balance per bill (full amount minus any payment already made this period)
  const remaining = (b: Bill) => Math.max(0, totalOwed(b) - amtPaidThisMonth(b));
  // Money totals exclude bills auto-charged to a linked card — their cost is
  // already in the card's statement, so counting both would double-count. They
  // still appear in the timeline below, tagged "via card".
  // Base the headline "due this month" figures on the CURRENT calendar month
  // (timelineBills), NOT every unpaid bill — otherwise annual bills due in a
  // later month inflate the total and it stops matching the Calendar screen's
  // "Due in <month>" figure for the same period.
  const payable = timelineBills.filter((b) => !isPaidViaCard(b));
  const overdue = payable.filter((b) => b.dueDays < 0);
  const overdueTotal = overdue.reduce((s, b) => s + remaining(b), 0);

  // Apply active filter then chosen sort order
  const visibleBase = overdueOnly
    ? overdue
    : filteredTimeline.filter((b) => filterCats.size === 0 || filterCats.has(b.cat));
  const visible = visibleBase
    .slice()
    .sort((a, b) => sortBy === "amount" ? totalOwed(b) - totalOwed(a) : a.dueDays - b.dueDays);
  // Total of the bills currently shown — surfaced as context text when a category filter is active.
  // Excludes via-card bills (their cost is in the linked card's statement), matching every
  // other money SUM in the app so the footer reconciles with the headline totals.
  const catTotal = visible.filter((b) => !isPaidViaCard(b)).reduce((s, b) => s + remaining(b), 0);

  const total = payable.reduce((s, b) => s + remaining(b), 0);
  const week = payable.filter((b) => b.dueDays >= 0 && b.dueDays <= 7);
  const weekSum = week.reduce((s, b) => s + remaining(b), 0);
  const soon = payable.filter((b) => b.dueDays <= 3).length;

  const openOverdue = () => {
    if (overdue.length === 1) { router.push(`/bill/${overdue[0]!.id}`); return; }
    haptics.selection();
    setFilterCats(new Set());
    setOverdueOnly((v) => !v);
  };

  // Paid-progress scoped to this month's bills only (same window as timelineBills).
  // paid bills are excluded from `due` → not in timelineBills/payable, so source from liveBills.
  const paid = liveBills.filter((b) => !isPaidViaCard(b) && isPaidThisMonth(b));
  const unpaid = payable; // already non-via-card, unpaid, current-month scope
  // paidAmt = fully paid bills + in-progress partial payments on unpaid bills
  const paidAmt =
    paid.reduce((s, b) => s + amtPaidThisMonth(b), 0) +
    unpaid.reduce((s, b) => s + amtPaidThisMonth(b), 0);
  // unpaidAmt is only the remaining balance, not the full original amount
  const unpaidAmt = unpaid.reduce((s, b) => s + remaining(b), 0);
  const grand = paidAmt + unpaidAmt;
  const pct = grand > 0 ? Math.round((paidAmt / grand) * 100) : 0;


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
            {timelineBills.length > 0
              ? `${timelineBills.length} ${timelineBills.length === 1 ? "bill" : "bills"} this month`
              : "You’re all caught up"}
          </Txt>
          <Low size={12} style={{ marginTop: 2 }}>
            {timelineBills.length > 0
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

      <PaymentGauge
        pct={pct}
        paidAmt={paidAmt}
        unpaidAmt={unpaidAmt}
        paidCount={paid.length}
        unpaidCount={unpaid.length}
        money={money}
        reduce={reduce}
      />

      {/* timeline */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: showFilters ? 8 : 12 }}>
        {overdueOnly ? (
          <Pressable
            onPress={() => { haptics.selection(); setOverdueOnly(false); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: t.semantic.overdue + "55", backgroundColor: t.semantic.overdue + "18" }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.semantic.overdue }} />
            <Txt size={12} weight="semibold" color={t.semantic.overdue}>Overdue</Txt>
            <Icon name="close" size={11} color={t.semantic.overdue} />
          </Pressable>
        ) : (
          <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>
            {showBizOnly && filterCats.size === 0 ? (effectiveBiz ?? "Business") : filterCats.size > 0 ? [...filterCats].join(", ") : "This month"}
          </SectionLabel>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          {hasBizBills && (
            <Pressable
              onPress={() => { haptics.selection(); setShowBizOnly((v) => { if (v) setFilterBiz(null); return !v; }); }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 3,
                paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20, borderWidth: 1,
                borderColor: showBizOnly ? t.semantic.urgent : t.hair,
                backgroundColor: showBizOnly ? t.semantic.urgent + "22" : "transparent",
              }}
            >
              <Txt size={11} weight="semibold" color={showBizOnly ? t.semantic.urgent : t.txtMid}>BIZ</Txt>
            </Pressable>
          )}
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
            <Txt size={12} color={t.txtMid}>See all · {timelineBills.length}</Txt>
          </Pill>
        </View>
      </View>

      {showFilters && !overdueOnly && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12, marginHorizontal: -4 }}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 6, flexDirection: "row" }}
        >
          <Chip
            label="All"
            selected={filterCats.size === 0 && !showBizOnly}
            onPress={() => { haptics.selection(); setFilterCats(new Set()); setShowBizOnly(false); setFilterBiz(null); }}
          />
          {cats.map((c) => (
            <Chip
              key={c}
              label={c}
              icon={(CAT_ICONS[c] ?? "spark") as IconName}
              selected={filterCats.has(c)}
              onPress={() => {
                haptics.selection();
                setFilterCats((prev) => {
                  const s = new Set(prev);
                  s.has(c) ? s.delete(c) : s.add(c);
                  return s;
                });
              }}
            />
          ))}
        </ScrollView>
      )}

      {/* Business sub-filter — only when BIZ is active and the user runs 2+ businesses */}
      {showBizOnly && !overdueOnly && timelineBizNames.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12, marginHorizontal: -4 }}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 6, flexDirection: "row" }}
        >
          <Chip
            label="All businesses"
            selected={effectiveBiz === null}
            onPress={() => { haptics.selection(); setFilterBiz(null); }}
          />
          {timelineBizNames.map((name) => (
            <Chip
              key={name}
              label={name}
              icon="wallet"
              selected={effectiveBiz === name}
              onPress={() => { haptics.selection(); setFilterBiz((prev) => (prev === name ? null : name)); }}
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
                          {b.isBusiness && (
                            <View style={{ backgroundColor: "#3b7aff22", borderWidth: 1, borderColor: "#3b7aff55", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Txt size={9.5} weight="medium" color="#6699ff" style={{ letterSpacing: 0.4 }}>BIZ</Txt>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Icon
                            name={(CAT_ICONS[b.cat] ?? "spark") as IconName}
                            size={11}
                            color={!isPaidViaCard(b) && cls === "overdue" ? t.semantic.overdue : t.txtLow}
                          />
                          <Low size={12} color={isPaidViaCard(b) ? undefined : cls === "overdue" ? t.semantic.overdue : undefined}>
                            {dueShort(b.dueDays)}
                          </Low>
                          {hasMultipleBiz && bizName(b) && (
                            <>
                              <Low size={12} color={t.txtLow}>·</Low>
                              <Txt size={12} weight="medium" color="#6699ff" numberOfLines={1} style={{ flexShrink: 1 }}>
                                {bizName(b)}
                              </Txt>
                            </>
                          )}
                        </View>
                      </View>
                      <Mono size={14} color={isPaidViaCard(b) ? t.txtLow : t.semantic[cls]}>
                        {money(remaining(b))}
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

      {(filterCats.size > 0 || showBizOnly) && !overdueOnly && visible.length > 0 && (
        <View style={{ marginTop: 14, alignItems: "center" }}>
          <Low size={12}>
            {visible.length}{" "}
            {showBizOnly ? "business " : ""}
            {visible.length === 1 ? "bill" : "bills"}
            {filterCats.size > 0 ? ` in ${[...filterCats].join(", ")}` : ""} ·{" "}
            <Mono size={12} weight="bold" color={t.txtHi}>{money(catTotal)}</Mono>
          </Low>
        </View>
      )}

    </Screen>
  );
}
