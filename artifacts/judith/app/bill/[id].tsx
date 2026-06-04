import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, TextInput, View } from "react-native";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn, Card, Low, Mono, ProviderLogo, Screen, SectionLabel, SheetHeader, Txt } from "@/components/ui";
import {
  dueClass,
  isPartialBill,
  partialPct,
  totalOwed,
  type Bill,
  type BillCycleRecord,
} from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/lib/haptics";

/* ─── helpers ────────────────────────────────────────────────────── */

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function periodLabel(period: string): string {
  const [yr, mo] = period.split("-");
  const moName = MONTH_SHORT[parseInt(mo ?? "1", 10) - 1] ?? "";
  const thisYear = new Date().getFullYear();
  if (parseInt(yr ?? "0", 10) !== thisYear) return `${moName} '${String(yr).slice(2)}`;
  return moName;
}

type ChartPoint = { label: string; value: number; current: boolean };

function buildChart(bill: Bill): ChartPoint[] {
  const today = new Date();
  const points: ChartPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mo = d.getMonth();
    const yr = d.getFullYear();
    const period = `${yr}-${String(mo + 1).padStart(2, "0")}`;
    const label = MONTH_SHORT[mo] ?? "";
    if (i === 0) {
      points.push({ label, value: totalOwed(bill), current: true });
      continue;
    }
    const real = bill.paymentHistory?.find((r) => r.period === period);
    // Only show real recorded data — no synthetic or static backfill
    points.push({ label, value: real ? real.totalDue : 0, current: false });
  }
  return points;
}

function buildHistory(bill: Bill): BillCycleRecord[] {
  // Deduplicate by period (upsert is now enforced in the store, but guard here too)
  const seen = new Set<string>();
  const rows: BillCycleRecord[] = [];
  for (const r of bill.paymentHistory ?? []) {
    if (!seen.has(r.period)) { seen.add(r.period); rows.push(r); }
  }
  rows.sort((a, b) => b.period.localeCompare(a.period));
  return rows.slice(0, 24);
}

/* ─── sub-components ─────────────────────────────────────────────── */

function MiniBarChart({ points, money }: { points: ChartPoint[]; money: (n: number) => string }) {
  const t = useTheme();
  const BAR_H = 80;
  const max = Math.max(...points.map((p) => p.value), 1);
  const current = points[points.length - 1];
  const prev = points[points.length - 2];
  const trend =
    current && prev && prev.value > 0
      ? Math.round(((current.value - prev.value) / prev.value) * 100)
      : null;

  const hasHistory = points.some((p) => !p.current && p.value > 0);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
        {points.map((p, i) => {
          const h = p.value > 0 ? Math.max(6, Math.round((p.value / max) * BAR_H)) : 0;
          return (
            <View key={i} style={{ flex: 1 }}>
              <View style={{ height: BAR_H, justifyContent: "flex-end" }}>
                {h > 0 && (
                  <View
                    style={{
                      height: h,
                      borderRadius: 5,
                      alignSelf: "stretch",
                      backgroundColor: p.current ? t.accent : t.accent + "55",
                    }}
                  />
                )}
              </View>
              <Low size={9} style={{ marginTop: 4, textAlign: "center" }}>{p.label}</Low>
            </View>
          );
        })}
      </View>
      {!hasHistory && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Low size={11} style={{ fontStyle: "italic" }}>
            Previous months will appear here as you record payments.
          </Low>
        </View>
      )}
      {hasHistory && trend !== null && current && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Icon
            name={trend > 0 ? "trend" : "trenddown"}
            size={12}
            color={trend > 0 ? t.semantic.near : t.semantic.ok}
          />
          <Low size={11}>
            {trend > 0 ? "+" : ""}{trend}% vs last month ·{" "}
            <Mono size={11} weight="semibold">{money(current.value)}</Mono> this month
          </Low>
        </View>
      )}
    </View>
  );
}

function CycleRow({ record, money }: { record: BillCycleRecord; money: (n: number) => string }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 14 }}>
      {/* header: period + on-time badge */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Txt size={13} weight="semibold">{periodLabel(record.period)}</Txt>
        {record.onTime === true && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: t.semantic.ok + "18", borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 }}>
            <Icon name="check" size={10} color={t.semantic.ok} />
            <Low size={10} color={t.semantic.ok} weight="medium">On time</Low>
          </View>
        )}
        {record.onTime === false && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: t.semantic.urgent + "18", borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 }}>
            <Low size={10} color={t.semantic.urgent} weight="medium">Paid late</Low>
          </View>
        )}
        {record.onTime === null && record.rolledOver > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: t.semantic.near + "18", borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 }}>
            <Icon name="trend" size={9} color={t.semantic.near} />
            <Low size={10} color={t.semantic.near} weight="medium">Partially paid</Low>
          </View>
        )}
      </View>
      {/* 4-column stats: due · paid · carry-in · on time */}
      <View style={{ flexDirection: "row" }}>
        {[
          { label: "Total due", val: money(record.totalDue), color: t.txtHi },
          {
            label: "Paid",
            val: money(record.paid),
            color: record.paid >= record.totalDue ? t.semantic.ok : t.semantic.near,
          },
          {
            label: "Carry-in",
            val: record.carriedIn > 0 ? money(record.carriedIn) : "—",
            color: record.carriedIn > 0 ? t.semantic.near : t.txtLow,
          },
          {
            label: "Rolled out",
            val: record.rolledOver > 0 ? money(record.rolledOver) : "—",
            color: record.rolledOver > 0 ? t.semantic.near : t.txtLow,
          },
        ].map((s, i) => (
          <View key={i} style={{ flex: 1 }}>
            <Low size={10} style={{ marginBottom: 3 }}>{s.label}</Low>
            <Mono size={12} weight="semibold" color={s.color}>{s.val}</Mono>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── main screen ────────────────────────────────────────────────── */

export default function BillDetailModal() {
  const t = useTheme();
  const router = useRouter();
  const { id, period: periodParam } = useLocalSearchParams<{ id: string; period?: string }>();
  const { bills, money, persona, togglePaid, payPartial, updateBillAmount, showToast } = useJudith();
  const [showInput, setShowInput] = useState(false);
  const [input, setInput] = useState("");
  const [showCCUpdate, setShowCCUpdate] = useState(false);
  const [ccInput, setCCInput] = useState("");

  const bill = bills.find((b) => b.id === id);

  if (!bill) {
    return (
      <Screen contentStyle={{ paddingTop: 14 }}>
        <SheetHeader title="Bill" onClose={() => router.back()} />
        <View style={{ height: 20 }} />
        <Low>Bill not found.</Low>
      </Screen>
    );
  }

  // ── Period-awareness (calendar may open a future/past month's slot) ──
  const today = new Date();
  const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const viewedPeriod = periodParam ?? currentPeriod;
  const isCurrentPeriod = viewedPeriod === currentPeriod;
  const isFuturePeriod = viewedPeriod > currentPeriod;

  const cls = dueClass(bill.dueDays);
  // For future months the bill hasn't been paid yet regardless of global status
  const paid = isCurrentPeriod ? bill.status === "paid" : false;
  const overdue = !paid && !isFuturePeriod && bill.dueDays < 0;
  const daysLate = -bill.dueDays;
  const partial = isCurrentPeriod && isPartialBill(bill);
  const owed = totalOwed(bill);
  // For future months show the base amount (fresh cycle, no carry-in yet)
  const viewedOwed = isFuturePeriod ? bill.amount : owed;
  const pct = partialPct(bill);
  const remaining = owed - (bill.amountPaid ?? 0);
  const hasCarryOver = isCurrentPeriod && (bill.carryOver ?? 0) > 0;
  const isCC = bill.cat === "Credit card";
  const todayDay = today.getDate();
  const statementIsToday = isCC && isCurrentPeriod && bill.statementDay === todayDay;

  const chartPoints = buildChart(bill);
  const historyRows = buildHistory(bill);

  const handleCCUpdate = () => {
    const amt = parseFloat(ccInput.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;
    updateBillAmount(bill.id, amt);
    setCCInput("");
    setShowCCUpdate(false);
    haptics.success();
    showToast("Statement amount updated");
  };

  const handlePayPartial = () => {
    const amt = parseFloat(input.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;
    payPartial(bill.id, amt);
    setInput("");
    setShowInput(false);
    haptics.success();
    const rem = owed - amt;
    if (rem > 0) {
      Alert.alert(
        "Payment recorded",
        `${money(rem)} remaining will roll over to next month automatically — nothing else for you to do.`,
        [{ text: "Got it", onPress: () => router.back() }],
      );
    } else {
      router.back();
    }
  };

  const statusColor = isFuturePeriod ? t.txtLow : paid ? t.semantic.ok : t.semantic[cls];

  return (
    <Screen contentStyle={{ paddingTop: 14 }}>
      <SheetHeader title={bill.provider} onClose={() => router.back()} />
      <View style={{ height: 14 }} />

      {/* ── COMPACT STATUS CARD ──────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: t.radius.md,
          backgroundColor: t.surface2,
          padding: 14,
        }}
      >
        <ProviderLogo provider={bill.provider} cat={bill.cat} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={15} weight="semibold" numberOfLines={1}>{bill.provider}</Txt>
          <Low size={12} numberOfLines={1}>
            {bill.cat}{bill.house ? ` · ${bill.house}` : ""}
          </Low>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Mono size={22} weight="bold" color={statusColor}>{money(viewedOwed)}</Mono>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: statusColor + "18",
              borderRadius: 20,
              paddingVertical: 2,
              paddingHorizontal: 8,
            }}
          >
            {paid && <Icon name="check" size={10} color={statusColor} />}
            <Low size={10} color={statusColor} weight="medium">
              {isFuturePeriod
                ? `due ${periodLabel(viewedPeriod)}`
                : paid
                  ? "paid"
                  : overdue
                    ? `${daysLate}d overdue`
                    : bill.dueDays === 0
                      ? "due today"
                      : `in ${bill.dueDays}d`}
            </Low>
          </View>
        </View>
      </View>

      {/* ── PROGRESS BAR ────────────────────────────────────── */}
      {(partial || paid) && (
        <View style={{ marginTop: 11, gap: 6 }}>
          <View
            style={{ height: 8, borderRadius: 4, backgroundColor: t.surface3, overflow: "hidden" }}
          >
            <View
              style={{
                height: "100%",
                width: `${pct}%`,
                backgroundColor: paid ? t.semantic.ok : t.semantic.near,
                borderRadius: 4,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Low size={11}>{pct}% paid · {money(bill.amountPaid ?? 0)}</Low>
            {!paid && <Low size={11}>{money(remaining)} remaining</Low>}
          </View>
        </View>
      )}

      {/* ── CARRY-OVER NOTICE ───────────────────────────────── */}
      {hasCarryOver && (
        <View
          style={{
            marginTop: 11,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: t.semantic.near + "44",
            borderRadius: 10,
            paddingVertical: 9,
            paddingHorizontal: 12,
            backgroundColor: t.semantic.near + "0c",
          }}
        >
          <Icon name="trend" size={13} color={t.semantic.near} />
          <Low size={12} style={{ flex: 1 }}>
            Includes{" "}
            <Mono size={12} color={t.semantic.near}>{money(bill.carryOver!)}</Mono>
            {" "}carried over from last month
          </Low>
        </View>
      )}

      {/* ── OVERDUE NOTICE ──────────────────────────────────── */}
      {overdue && (
        <View
          style={{
            marginTop: 11,
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
            borderWidth: 1,
            borderColor: t.semantic.overdue + "44",
            backgroundColor: t.semantic.overdue + "10",
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <JudithAvatar persona={persona} size={28} state="idle" />
          <Low size={12} style={{ flex: 1, lineHeight: 17 }}>
            This one slipped past its due date. Pay it now and I'll mark you caught up — no judgment.
          </Low>
        </View>
      )}

      {/* ── CC STATEMENT NUDGE ──────────────────────────────── */}
      {statementIsToday && (
        <View
          style={{
            marginTop: 11,
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
            borderWidth: 1,
            borderColor: t.semantic.near + "55",
            backgroundColor: t.semantic.near + "10",
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <Icon name="card" size={16} color={t.semantic.near} />
          <Low size={12} style={{ flex: 1, lineHeight: 17 }}>
            Did your statement come in today? Update the amount to keep your calendar accurate.
          </Low>
        </View>
      )}

      {/* ── ROLLOVER WARNING ────────────────────────────────── */}
      {partial && !paid && (
        <View
          style={{
            marginTop: 11,
            borderWidth: 1,
            borderColor: t.semantic.near + "55",
            borderRadius: 12,
            padding: 12,
            backgroundColor: t.surface1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="trend" size={13} color={t.semantic.near} />
            <Txt size={13} weight="semibold" color={t.semantic.near}>
              {money(remaining)} rolls over automatically
            </Txt>
          </View>
          <Low size={12} style={{ marginTop: 3, lineHeight: 17 }}>
            The unpaid balance carries forward and adds to your next{" "}
            {money(bill.amount)} charge — nothing for you to do.
          </Low>
        </View>
      )}

      {/* ── 6-MONTH TREND CHART ─────────────────────────────── */}
      <SectionLabel style={{ marginTop: 22 }}>6-month trend</SectionLabel>
      <Card style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
        <MiniBarChart points={chartPoints} money={money} />
      </Card>

      {/* ── ACTION BUTTONS ──────────────────────────────────── */}
      <View style={{ gap: 9, marginTop: 20 }}>
        {/* Future-month notice: this is a preview, not yet payable */}
        {isFuturePeriod && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              borderWidth: 1,
              borderColor: t.hair,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: t.surface2,
            }}
          >
            <Icon name="cal" size={14} color={t.txtLow} />
            <Low size={13} style={{ flex: 1, lineHeight: 18 }}>
              This is <Txt size={13} weight="semibold">{periodLabel(viewedPeriod)}</Txt>'s bill.
              {" "}You haven't paid it yet — come back when it's due to mark it paid.
            </Low>
          </View>
        )}

        {/* Current-month pay / unpay / partial */}
        {isCurrentPeriod && (
          <>
            <Btn
              label={paid ? "Mark as unpaid" : overdue ? "Mark paid — catch up" : "Mark as fully paid"}
              variant={paid ? "soft" : "primary"}
              onPress={() => {
                if (!paid) haptics.success();
                togglePaid(bill.id);
                router.back();
              }}
            />
            {!paid && (
              <Btn
                label={showInput ? "Cancel" : partial ? "Update partial" : "Pay partial"}
                variant="soft"
                onPress={() => {
                  if (showInput) { setShowInput(false); setInput(""); }
                  else { setInput(bill.amountPaid ? String(bill.amountPaid) : ""); setShowInput(true); }
                }}
              />
            )}
            {isCC && !showCCUpdate && (
              <Btn
                label={statementIsToday ? "Update statement · today" : "Update statement amount"}
                variant="soft"
                onPress={() => {
                  setCCInput(String(bill.amount));
                  setShowCCUpdate(true);
                  setShowInput(false);
                }}
              />
            )}
          </>
        )}

        {/* Edit bill — always visible */}
        <Btn
          label="Edit bill"
          variant="soft"
          onPress={() => router.push(`/add-bill?id=${bill.id}`)}
        />
      </View>

      {/* ── CC UPDATE INPUT ─────────────────────────────────── */}
      {showCCUpdate && (
        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: t.semantic.near + "66",
            borderRadius: 14,
            backgroundColor: t.surface2,
            gap: 10,
          }}
        >
          <Txt size={13} weight="semibold">New statement amount</Txt>
          <Low size={12}>
            Enter the total from your latest bank statement. Judith will reset this month's cycle to that amount.
          </Low>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Mono size={24} weight="bold" color={t.txtHi} style={{ marginRight: 3 }}>₱</Mono>
            <TextInput
              value={ccInput}
              onChangeText={setCCInput}
              keyboardType="decimal-pad"
              placeholder={bill.amount.toLocaleString()}
              placeholderTextColor={t.txtLow}
              autoFocus
              style={{ fontFamily: t.fonts.mono, fontSize: 24, color: t.txtHi, paddingVertical: 4, flex: 1 }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Btn label="Update amount" onPress={handleCCUpdate} /></View>
            <View style={{ flex: 1 }}>
              <Btn label="Cancel" variant="soft" onPress={() => { setShowCCUpdate(false); setCCInput(""); }} />
            </View>
          </View>
        </View>
      )}

      {/* ── PARTIAL PAYMENT INPUT ───────────────────────────── */}
      {showInput && (
        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 14,
            backgroundColor: t.surface2,
            gap: 10,
          }}
        >
          <Low size={12}>Amount paid so far (cumulative total)</Low>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Mono size={24} weight="bold" color={t.txtHi} style={{ marginRight: 3 }}>₱</Mono>
            <TextInput
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              placeholder={Math.round(owed * 0.5).toLocaleString()}
              placeholderTextColor={t.txtLow}
              style={{ fontFamily: t.fonts.mono, fontSize: 24, color: t.txtHi, paddingVertical: 4, flex: 1 }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Btn label="Record Payment" onPress={handlePayPartial} /></View>
            <View style={{ flex: 1 }}>
              <Btn
                label="Cancel"
                variant="soft"
                onPress={() => { setShowInput(false); setInput(""); }}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── PAYMENT HISTORY ─────────────────────────────────── */}
      {historyRows.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 24 }}>Payment history</SectionLabel>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {historyRows.map((record, i) => (
              <View key={record.period}>
                {i > 0 && <View style={{ height: 1, backgroundColor: t.hair }} />}
                <CycleRow record={record} money={money} />
              </View>
            ))}
          </Card>
        </>
      )}

      <View style={{ height: 32 }} />
    </Screen>
  );
}
