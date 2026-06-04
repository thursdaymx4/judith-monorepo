import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import {
  Card,
  Dot,
  Low,
  mix,
  Mono,
  ProviderLogo,
  Screen,
  SectionLabel,
  Txt,
  type Urgency,
} from "@/components/ui";
import { dueClass, dueShort, totalOwed, type Bill } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/lib/haptics";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const fmtK = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : String(n);

type ByDay = Record<number, Bill[]>;

/* ---- shared improved legend ---- */
function CalLegend() {
  const t = useTheme();
  const items: { kind: Urgency; label: string; sub: string }[] = [
    { kind: "urgent", label: "Urgent", sub: "≤3d" },
    { kind: "near", label: "This week", sub: "≤7d" },
    { kind: "ok", label: "Upcoming", sub: "later" },
  ];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: 6, marginBottom: 12, paddingHorizontal: 2 }}>
      {items.map((it) => (
        <View key={it.kind} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginRight: 16 }}>
          <Dot kind={it.kind} size={7} />
          <Txt size={11.5} weight="semibold">{it.label}</Txt>
          <Low size={10.5}>{it.sub}</Low>
        </View>
      ))}
    </View>
  );
}

/* ---- variant: heatmap dots ---- */
function CalHeat({
  byDay, sel, setSel, firstDow, daysInMonth, todayDate, getDueDays, getAmt, isFuture,
}: {
  byDay: ByDay;
  sel: number | null;
  setSel: (d: number | null) => void;
  firstDow: number;
  daysInMonth: number;
  todayDate: number | null;
  getDueDays: (b: Bill) => number;
  getAmt: (b: Bill) => number;
  isFuture: boolean;
}) {
  const t = useTheme();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // In future months all bills are "upcoming" (not yet paid for that cycle)
  const dueBills = (items: Bill[]) =>
    isFuture ? items : items.filter((b) => b.status !== "paid");

  let maxDay = 1;
  Object.keys(byDay).forEach((k) => {
    const total = dueBills(byDay[Number(k)] || []).reduce((s, b) => s + getAmt(b), 0);
    if (total > maxDay) maxDay = total;
  });

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <Card style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 8 }}>
        {DOW.map((d, i) => (
          <Txt key={i} size={10} weight="semibold" color={t.txtLow} style={{ flex: 1, textAlign: "center" }}>{d}</Txt>
        ))}
      </View>
      <View style={{ gap: 4 }}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: 4 }}>
            {row.map((d, ci) => {
              if (d == null) return <View key={"e" + ci} style={{ flex: 1 }} />;
              const items = byDay[d] || [];
              const due = dueBills(items);
              const top = due.slice().sort((a, b) => getDueDays(a) - getDueDays(b))[0];
              const cls = top ? (dueClass(getDueDays(top)) as Urgency) : null;
              const isToday = d === todayDate;
              const isSel = d === sel;
              const dayTotal = due.reduce((s, b) => s + getAmt(b), 0);
              const sz = due.length ? Math.round(13 + (dayTotal / maxDay) * 20) : 0;
              const dotColor = cls ? t.semantic[cls] : t.txtLow;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    if (!items.length) return;
                    haptics.light();
                    setSel(isSel ? null : d);
                  }}
                  style={{
                    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center",
                    borderRadius: 999,
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: isToday ? t.accent : "transparent",
                    backgroundColor: isSel ? mix(t.accent, t.surface2, 0.22) : "transparent",
                  }}
                >
                  {due.length > 0 && (
                    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                      <View style={{ width: sz, height: sz, borderRadius: sz / 2, backgroundColor: dotColor, opacity: 0.9, shadowColor: dotColor, shadowOpacity: 0.7, shadowRadius: Math.round(sz / 2), shadowOffset: { width: 0, height: 0 } }} />
                    </View>
                  )}
                  <Txt size={10} weight={due.length ? "bold" : "regular"} color={due.length ? t.onAccent : t.txtLow}>{d}</Txt>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14 }}>
        <Low size={10}>smaller bill</Low>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          {[7, 11, 16, 22].map((s) => (
            <View key={s} style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: mix(t.accent, t.surface3, 0.6) }} />
          ))}
        </View>
        <Low size={10}>bigger</Low>
      </View>
    </Card>
  );
}

/* ---- small reusable nav arrow button ---- */
function NavBtn({ onPress, rotate }: { onPress: () => void; rotate?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32, height: 32, borderRadius: 16,
        borderWidth: 1, borderColor: t.hair,
        backgroundColor: pressed ? t.surface3 : t.surface2,
        alignItems: "center", justifyContent: "center",
      })}
    >
      <View style={rotate ? { transform: [{ rotate: "180deg" }] } : undefined}>
        <Icon name="chev" size={15} color={t.txtMid} />
      </View>
    </Pressable>
  );
}

export default function CalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const { bills, persona, money } = useJudith();
  const [sel, setSel] = useState<number | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const todayReal = new Date();
  const viewDate = new Date(todayReal.getFullYear(), todayReal.getMonth() + monthOffset, 1);
  const monthIndex = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const dim = new Date(year, monthIndex + 1, 0).getDate(); // days in viewed month
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const isCurrentMonth = monthOffset === 0;
  const isFutureMonth = monthOffset > 0;
  const todayDate = isCurrentMonth ? todayReal.getDate() : null;
  const monthShort = MONTHS[monthIndex]!.slice(0, 3);

  const prevMonth = () => { haptics.light(); setSel(null); setMonthOffset((o) => o - 1); };
  const nextMonth = () => { haptics.light(); setSel(null); setMonthOffset((o) => o + 1); };

  const viewedPeriodKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const openBill = (b: Bill) => router.push(`/bill/${b.id}?period=${viewedPeriodKey}`);

  // Days from today to the bill's due day within the VIEWED month.
  // Annual bills: use their stored dueDays (points to the actual annual occurrence).
  // Monthly bills: recompute to the viewed month's occurrence of dueDate.
  const todayStart = new Date(
    todayReal.getFullYear(), todayReal.getMonth(), todayReal.getDate()
  ).getTime();

  const viewedDueDays = (b: Bill): number => {
    if (b.frequency === "annual") return b.dueDays;
    const dayInMonth = Math.min(b.dueDate, dim);
    const target = new Date(year, monthIndex, dayInMonth).getTime();
    return Math.round((target - todayStart) / 86_400_000);
  };

  // Amount owed for this bill in the viewed month:
  //   current month  → remaining balance (totalOwed − amountPaid)
  //   future month   → base amount + whatever carryOver wasn't paid yet
  //                    (paid bills get a fresh cycle = base amount only)
  //   past month     → show remaining as best approximation
  const viewedAmt = (b: Bill): number => {
    if (isCurrentMonth) {
      return Math.max(0, totalOwed(b) - (b.amountPaid ?? 0));
    }
    if (isFutureMonth) {
      // CC: bank folds any unpaid balance into the new statement — we don't know the
      // new amount yet, so we show the last known amount as an estimate
      if (b.cat === "Credit card") return b.amount;
      if (b.status === "paid") return b.amount; // fresh cycle, no carry
      // Effective carry into next month:
      // - If a partial payment was made this cycle: the remaining balance carries forward
      //   (payPartial stores amountPaid but doesn't set carryOver until rollOver() fires)
      // - If carryOver was set by a formal rollover (amountPaid reset to 0): use carryOver
      // - If bill is fully unpaid (amountPaid=0, carryOver=0): no extra carry — fresh amount only
      const hasPartial = (b.amountPaid ?? 0) > 0;
      const effectiveCarry = hasPartial
        ? Math.max(0, totalOwed(b) - (b.amountPaid ?? 0))
        : (b.carryOver ?? 0);
      return b.amount + effectiveCarry;
    }
    // Past month — best we can do without history
    return Math.max(0, totalOwed(b) - (b.amountPaid ?? 0));
  };

  // Bills applicable to the viewed month.
  // Monthly bills → always, as long as dueDate ≤ days in that month.
  // Annual bills  → only in the month their next occurrence actually falls.
  const billsForMonth = bills.filter((b) => {
    if (b.dueDate > dim) return false; // e.g. Feb 30 doesn't exist
    if (b.frequency === "annual") {
      // Annual: include only when the real due date falls in the viewed month
      const nextDue = new Date(todayReal.getTime());
      nextDue.setDate(nextDue.getDate() + b.dueDays);
      return nextDue.getFullYear() === year && nextDue.getMonth() === monthIndex;
    }
    return true; // monthly → every month
  });

  // Upcoming: unpaid bills in the viewed month.
  // In future months every bill is "upcoming" (none have been paid for that cycle yet).
  const agendaForMonth = isCurrentMonth
    ? billsForMonth.filter((b) => b.status !== "paid")
    : billsForMonth;

  // "Paid this month" section — only meaningful for the current month
  const agendaPaid = isCurrentMonth ? bills.filter((b) => b.status === "paid") : [];

  const monthTotal = agendaForMonth.reduce((s, b) => s + viewedAmt(b), 0);
  const agenda = agendaForMonth.slice().sort((a, b) => a.dueDate - b.dueDate);

  // Calendar dot map keyed by day-of-month
  const byDay: ByDay = {};
  billsForMonth.forEach((b) => {
    const d = Math.min(b.dueDate, dim);
    (byDay[d] = byDay[d] || []).push(b);
  });

  // Weekly bar chart
  const ranges: [number, number][] = [];
  for (let s = 1; s <= dim; s += 7) ranges.push([s, Math.min(s + 6, dim)]);
  const weeks = ranges.map(() => 0);
  agendaForMonth.forEach((b) => {
    const w = Math.min(ranges.length - 1, Math.floor((b.dueDate - 1) / 7));
    weeks[w]! += viewedAmt(b);
  });
  const maxW = Math.max(1, ...weeks);

  // "This week" count: bills due within the next 7 days
  const thisWeekCount = agendaForMonth.filter((b) => {
    const d = viewedDueDays(b);
    return d >= 0 && d <= 7;
  }).length;

  return (
    <Screen>
      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <View>
          <Txt size={28} weight="semibold" style={{ letterSpacing: -0.56 }}>Calendar</Txt>
          <Low size={12} style={{ marginTop: 2 }}>{MONTHS[monthIndex]} {year}</Low>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <NavBtn onPress={prevMonth} rotate />
          <NavBtn onPress={nextMonth} />
        </View>
      </View>

      {/* month summary */}
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View>
          <Low size={12}>Due in {MONTHS[monthIndex]}</Low>
          <Mono size={24} weight="semibold">{money(monthTotal)}</Mono>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Low size={12} style={{ textAlign: "right" }}>
            <Txt size={12} weight="semibold" color={t.txtHi}>{agendaForMonth.length}</Txt> bills
          </Low>
          <Low size={12} style={{ textAlign: "right" }}>
            <Txt size={12} weight="semibold" color={t.semantic.near}>
              {thisWeekCount}
            </Txt> this week
          </Low>
        </View>
      </Card>

      <CalLegend />

      <CalHeat
        byDay={byDay}
        sel={sel}
        setSel={setSel}
        firstDow={firstDow}
        daysInMonth={dim}
        todayDate={todayDate}
        getDueDays={viewedDueDays}
        getAmt={viewedAmt}
        isFuture={isFutureMonth}
      />

      {/* weekly cash flow */}
      <View style={{ marginTop: 14 }}>
        <SectionLabel style={{ marginTop: 0 }}>Weekly total bills due</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {weeks.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
              <Mono size={10} weight="semibold" color={w > 0 ? t.txtHi : t.txtLow}>
                {w > 0 ? "₱" + fmtK(w) : "—"}
              </Mono>
              <View style={{ width: "100%", height: 54, borderRadius: 9, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hair2, justifyContent: "flex-end", overflow: "hidden" }}>
                <LinearGradient
                  colors={[mix(t.accent, t.surface3, 0.35), t.accent]}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={{ width: "100%", height: `${Math.round((w / maxW) * 100)}%`, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}
                />
              </View>
              <Low size={9}>
                {ranges[i]![0] === ranges[i]![1] ? ranges[i]![0] : ranges[i]![0] + "–" + ranges[i]![1]}
              </Low>
            </View>
          ))}
        </View>
      </View>

      {/* agenda */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 }}>
        <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>
          {isFutureMonth ? `Bills in ${MONTHS[monthIndex]}` : "Upcoming"}
        </SectionLabel>
      </View>

      {agenda.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 26, paddingHorizontal: 16 }}>
          <JudithAvatar persona={persona} size={56} state="idle" />
          <Txt size={14} weight="semibold" style={{ marginTop: 12 }}>You're all caught up</Txt>
          <Low size={13} style={{ marginTop: 3 }}>Nothing left due — I'll flag the next one.</Low>
        </Card>
      ) : (
        <View style={{ gap: 9 }}>
          {agenda.map((b) => {
            const dd = viewedDueDays(b);
            const cls = dueClass(dd) as Urgency;
            const amt = viewedAmt(b);
            const isCCEst = isFutureMonth && b.cat === "Credit card";
            // Effective carry uses the same logic as viewedAmt above
            const hasPartialForLabel = (b.amountPaid ?? 0) > 0;
            const effectiveCarryForLabel = isFutureMonth && !isCCEst && b.status !== "paid"
              ? (hasPartialForLabel
                  ? Math.max(0, totalOwed(b) - (b.amountPaid ?? 0))
                  : (b.carryOver ?? 0))
              : 0;
            const hasCarryOver = effectiveCarryForLabel > 0;
            return (
              <CalBillRow
                key={b.id}
                bill={b}
                onPress={() => openBill(b)}
                amtColor={isCCEst ? t.txtMid : t.semantic[cls]}
                money={money}
                monthShort={monthShort}
                displayAmt={amt}
                estLabel={isCCEst}
                carryAmt={hasCarryOver ? effectiveCarryForLabel : undefined}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Dot kind={cls} />
                  <Low size={12}>
                    {b.cat}
                    {" · "}
                    {dueShort(dd)}
                    {isCCEst ? " · est." : hasCarryOver ? " · carried balance" : ""}
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
              <CalBillRow key={b.id} bill={b} onPress={() => openBill(b)} amtColor={t.txtLow} money={money} paid monthShort={monthShort}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Icon name="check" size={12} color={t.txtLow} />
                  <Low size={12}>Paid · {b.cat}</Low>
                </View>
              </CalBillRow>
            ))}
          </View>
        </View>
      )}

      <DayBillsModal
        day={sel}
        bills={sel != null ? byDay[sel] || [] : []}
        money={money}
        monthName={MONTHS[monthIndex]!}
        onClose={() => setSel(null)}
        onOpenBill={(b) => { setSel(null); openBill(b); }}
        getDueDays={viewedDueDays}
        getAmt={viewedAmt}
        isFuture={isFutureMonth}
      />
    </Screen>
  );
}

/* ---- day overlay: bills due on a tapped date ---- */
function DayBillsModal({
  day, bills, money, monthName, onClose, onOpenBill, getDueDays, getAmt, isFuture,
}: {
  day: number | null;
  bills: Bill[];
  money: (n: number) => string;
  monthName: string;
  onClose: () => void;
  onOpenBill: (b: Bill) => void;
  getDueDays: (b: Bill) => number;
  getAmt: (b: Bill) => number;
  isFuture: boolean;
}) {
  const t = useTheme();
  const items = bills.slice().sort((a, b) => getDueDays(a) - getDueDays(b));
  const dueItems = isFuture ? items : items.filter((b) => b.status !== "paid");
  const paidItems = isFuture ? [] : items.filter((b) => b.status === "paid");
  const dueTotal = dueItems.reduce((s, b) => s + getAmt(b), 0);

  return (
    <Modal visible={day != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: t.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: t.hair, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 34 }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.hair2, marginBottom: 14 }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <Txt size={18} weight="semibold">{monthName} {day}</Txt>
            <Pressable onPress={onClose} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.surface3, alignItems: "center", justifyContent: "center" }}>
              <Icon name="x" size={15} color={t.txtMid} />
            </Pressable>
          </View>
          <Low size={12} style={{ marginBottom: 14 }}>
            {items.length} {items.length === 1 ? "bill" : "bills"}
            {dueTotal > 0 ? ` · ${money(dueTotal)} due` : ""}
          </Low>
          <View style={{ gap: 9 }}>
            {dueItems.map((b) => {
              const dd = getDueDays(b);
              const cls = dueClass(dd) as Urgency;
              return (
                <CalBillRow
                  key={b.id}
                  bill={b}
                  onPress={() => onOpenBill(b)}
                  amtColor={t.semantic[cls]}
                  money={money}
                  monthShort={monthName.slice(0, 3)}
                  displayAmt={getAmt(b)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Dot kind={cls} />
                    <Low size={12}>{b.cat} · {dueShort(dd)}</Low>
                  </View>
                </CalBillRow>
              );
            })}
            {paidItems.map((b) => (
              <CalBillRow
                key={b.id}
                bill={b}
                onPress={() => onOpenBill(b)}
                amtColor={t.txtLow}
                money={money}
                paid
                monthShort={monthName.slice(0, 3)}
                displayAmt={b.amount}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Icon name="check" size={12} color={t.txtLow} />
                  <Low size={12}>Paid · {b.cat}</Low>
                </View>
              </CalBillRow>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---- agenda bill row with date chip ---- */
function CalBillRow({
  bill, onPress, amtColor, money, paid, monthShort, displayAmt, estLabel, carryAmt, children,
}: {
  bill: Bill;
  onPress: () => void;
  amtColor: string;
  money: (n: number) => string;
  paid?: boolean;
  monthShort: string;
  displayAmt?: number;
  estLabel?: boolean;
  /** Carry-over portion of displayAmt — when set, shows a ₱base + ₱carry breakdown below the total */
  carryAmt?: number;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const amt = displayAmt ?? bill.amount;
  const baseAmt = carryAmt && carryAmt > 0 ? amt - carryAmt : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 1, borderColor: t.hair, borderRadius: t.radius.md, backgroundColor: t.surface2, paddingVertical: 13, paddingHorizontal: 14, opacity: paid ? 0.55 : 1 },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={{ width: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: t.surface3, paddingVertical: 5 }}>
        <Mono size={16} weight="semibold" style={{ lineHeight: 16 }}>{bill.dueDate}</Mono>
        <Low size={9} style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>{monthShort}</Low>
      </View>
      <ProviderLogo provider={bill.provider} cat={bill.cat} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={14} weight="medium">{bill.provider}</Txt>
        {children}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Mono size={14} color={amtColor}>{money(amt)}</Mono>
        {estLabel && <Low size={9} style={{ marginTop: 1 }}>est.</Low>}
        {baseAmt != null && carryAmt != null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
            <Low size={9}>{money(baseAmt)}</Low>
            <Low size={9} color={t.semantic.near}>+{money(carryAmt)}</Low>
          </View>
        )}
      </View>
    </Pressable>
  );
}
