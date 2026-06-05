import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Low, Mono, ProviderLogo, Screen, Txt, mix } from "@/components/ui";
import { currentCycleDue, isPaidViaCard, totalOwed, type Bill } from "@/constants/data";
import { CAT_COLORS } from "@/constants/theme";
import { useJudith } from "@/contexts/JudithStore";
import { useCountUp } from "@/hooks/useCountUp";
import { useTheme } from "@/hooks/useTheme";

/* ─── types ─────────────────────────────────────────────────────── */

type PeriodKey = "this-month" | "last-month" | "3mo" | "6mo" | "custom";
type TrayKey = "period" | "tag" | "house" | "cat" | "prov" | null;
type TagFilter = "all" | "personal" | "business";
interface CatSlice { cat: string; value: number; color: string }

/* ─── period helpers ─────────────────────────────────────────────── */

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Personal vs Business split colors — fixed palette, independent of brand accent. */
const PERSONAL_COLOR = "#36acff";
const BUSINESS_COLOR = "#b394ff";

function toPeriodStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriodChip(p: string): string {
  const [yr, mo] = p.split("-");
  const name = MO[parseInt(mo ?? "1", 10) - 1] ?? "";
  return parseInt(yr ?? "0", 10) !== new Date().getFullYear()
    ? `${name} '${String(yr).slice(2)}`
    : name;
}

/* ─── Donut ──────────────────────────────────────────────────────── */

function Donut({ segments, total, size = 130 }: { segments: CatSlice[]; total: number; size?: number }) {
  const t = useTheme();
  const stroke = 18;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.surface3} strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = total > 0 ? (s.value / total) * C : 0;
          const dash = Math.max(0, len - 3);
          const seg = (
            <Circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color}
              strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc} />
          );
          acc += len;
          return seg;
        })}
      </G>
    </Svg>
  );
}

/* ─── Pie ────────────────────────────────────────────────────────── */
/* Solid filled pie (no hole / no gaps) — deliberately distinct from the
   gapped donut used for "Where it goes". Used for Personal vs Business. */
function Pie({ slices, size = 120 }: { slices: { value: number; color: string }[]; size?: number }) {
  const r = size / 2;
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  let acc = 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => {
        const frac = s.value / total;
        if (frac <= 0) return null;
        // A single full-circle slice can't be drawn as an arc path.
        if (frac >= 1) return <Circle key={i} cx={r} cy={r} r={r} fill={s.color} />;
        const a0 = acc * 2 * Math.PI - Math.PI / 2;
        acc += frac;
        const a1 = acc * 2 * Math.PI - Math.PI / 2;
        const x0 = r + r * Math.cos(a0), y0 = r + r * Math.sin(a0);
        const x1 = r + r * Math.cos(a1), y1 = r + r * Math.sin(a1);
        const large = frac > 0.5 ? 1 : 0;
        const d = `M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
        return <Path key={i} d={d} fill={s.color} />;
      })}
    </Svg>
  );
}

/* ─── PaidBilledBar ──────────────────────────────────────────────── */

function PaidBilledBar({ paidTotal, billedTotal, paidFrac, money }: {
  paidTotal: number; billedTotal: number; paidFrac: number; money: (n: number) => string;
}) {
  const t = useTheme();
  const paidPct   = Math.round(paidFrac * 100);
  const unpaidAmt = billedTotal - paidTotal;
  const allPaid   = unpaidAmt <= 0;
  return (
    <View style={{ marginTop: 16, gap: 8 }}>
      {/* segmented bar */}
      <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: t.semantic.err + "55" }}>
        {paidFrac > 0 && (
          <LinearGradient
            colors={[t.semantic.ok, mix(t.semantic.ok, "#00e066", 0.3)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ width: `${paidPct}%`, height: "100%" }}
          />
        )}
      </View>
      {/* labels — paid left, unpaid right — can never overlap */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.semantic.ok }} />
          <Low size={11}>Paid</Low>
          <Txt size={11} weight="semibold" color={t.semantic.ok}>{money(paidTotal)}</Txt>
          <Low size={10}>({paidPct}%)</Low>
        </View>
        {!allPaid && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Low size={11}>Unpaid</Low>
            <Txt size={11} weight="semibold" color={t.semantic.err}>{money(unpaidAmt)}</Txt>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.semantic.err }} />
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── filter chips ───────────────────────────────────────────────── */

function FChip({ active, label, badge, onPress }: {
  active: boolean; label: string; badge?: number; onPress: () => void;
}) {
  const t = useTheme();
  const color = active ? t.accent : t.txtMid;
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: active ? t.accent : t.hair, backgroundColor: active ? mix(t.accent, t.surface2, 0.12) : t.surface2 }}
    >
      {(badge ?? 0) > 1 && (
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
          <Txt size={9} weight="bold" color={t.onAccent}>{badge}</Txt>
        </View>
      )}
      <Txt size={12} weight="semibold" color={color} numberOfLines={1}>{label}</Txt>
      <Icon name="chev" size={12} color={color} />
    </Pressable>
  );
}

function TrayChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: selected ? t.accent : t.hair, borderRadius: 22, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: selected ? mix(t.accent, t.surface2, 0.16) : t.surface2 }}
    >
      {selected && <Icon name="check" size={11} color={t.accent} />}
      <Txt size={12.5} color={selected ? t.txtHi : t.txtMid}>{label}</Txt>
    </Pressable>
  );
}

/* ─── main screen ────────────────────────────────────────────────── */

export default function InsightsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { bills, persona, money } = useJudith();

  /* filter state */
  const [period, setPeriod] = useState<PeriodKey>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tagF, setTagF] = useState<TagFilter>("all");
  const [houseF, setHouseF] = useState("All");
  const [catSel, setCatSel] = useState<Set<string>>(new Set());
  const [provSel, setProvSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<TrayKey>(null);

  /* active period list (null = current month) */
  const activePeriods = useMemo((): string[] | null => {
    if (period === "this-month") return null;
    const today = new Date();
    const ago = (n: number) => toPeriodStr(new Date(today.getFullYear(), today.getMonth() - n, 1));
    if (period === "last-month") return [ago(1)];
    if (period === "3mo")        return [ago(3), ago(2), ago(1)];
    if (period === "6mo")        return [ago(6), ago(5), ago(4), ago(3), ago(2), ago(1)];
    if (period === "custom" && customFrom && customTo && customFrom <= customTo) {
      const res: string[] = [];
      let [y, m] = customFrom.split("-").map(Number) as [number, number];
      const [ty, tm] = customTo.split("-").map(Number) as [number, number];
      while (y < ty || (y === ty && m <= tm)) {
        res.push(`${y}-${String(m).padStart(2, "0")}`);
        if (++m > 12) { m = 1; y++; }
      }
      return res;
    }
    return null;
  }, [period, customFrom, customTo]);

  const isHistorical = activePeriods !== null;

  /* last 24 months for custom picker */
  const last24Months = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 24 }, (_, i) =>
      toPeriodStr(new Date(today.getFullYear(), today.getMonth() - (23 - i), 1))
    );
  }, []);

  /* available filter options */
  const houses = useMemo(() =>
    Array.from(new Set(bills.map(b => b.house).filter((h): h is string => Boolean(h)))),
    [bills]
  );
  const multiHouse = houses.length > 1;

  const baseFiltered = useMemo(() => bills.filter(b =>
    (houseF === "All" || b.house === houseF) &&
    (tagF === "all" ||
      (tagF === "business" ? b.isBusiness === true : !b.isBusiness))
  ), [bills, houseF, tagF]);

  const allCats = useMemo(() =>
    Array.from(new Set(baseFiltered.map(b => b.cat))),
    [baseFiltered]
  );
  const allProvs = useMemo(() =>
    Array.from(new Set(
      baseFiltered.filter(b => catSel.size === 0 || catSel.has(b.cat)).map(b => b.provider)
    )),
    [baseFiltered, catSel]
  );

  const filteredBills = useMemo(() => baseFiltered.filter(b =>
    (catSel.size === 0 || catSel.has(b.cat)) &&
    (provSel.size === 0 || provSel.has(b.provider))
  ), [baseFiltered, catSel, provSel]);

  /* stats */
  const { billedTotal, paidTotal, catTotal, catSlices, topProviders, biggest } = useMemo(() => {
    let billed = 0, paid = 0;
    // "Where it goes" uses an attribute + net model: a bill auto-charged to a
    // linked card is shown under its OWN category (e.g. Meralco → Electricity),
    // and each card contributes only its un-itemized remainder (statement minus
    // the tracked charges linked to it) under "Credit card". This keeps the
    // grand total identical to the billed total (no double-counting) while
    // showing people where their money actually goes.
    const catMap: Record<string, number> = {};
    const provMap: Record<string, { amount: number; cat: string; id: string }> = {};
    // Largest single bill (via-card excluded — its cost lives in the card statement).
    let biggest: { amount: number; provider: string; cat: string; id: string } | null = null;
    const considerBiggest = (amount: number, provider: string, cat: string, id: string) => {
      if (amount > (biggest?.amount ?? 0)) biggest = { amount, provider, cat, id };
    };

    const addCat = (cat: string, v: number) => { if (v > 0) catMap[cat] = (catMap[cat] ?? 0) + v; };
    const addProv = (provider: string, v: number, cat: string, id: string) => {
      if (v > 0) provMap[provider] = { amount: (provMap[provider]?.amount ?? 0) + v, cat, id };
    };

    if (!isHistorical) {
      const _now = new Date();
      const _curPeriod = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;
      const _amtPaid = (b: Bill): number => {
        const rec = (b.paymentHistory ?? []).find((r) => r.period === _curPeriod);
        if (rec) return rec.paid;
        return b.amountPaid ?? 0; // in-progress partial
      };
      // Scope to bills due this month (overdue included) + any already paid this month.
      const _daysLeft = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate() - _now.getDate();
      const _curMonthBills = filteredBills.filter(b => {
        if ((b.paymentHistory ?? []).some(r => r.period === _curPeriod)) return true;
        const { dueDays } = currentCycleDue(b, _now);
        return dueDays <= _daysLeft;
      });
      // Tracked charges linked to each card id.
      const linkedByCard: Record<string, number> = {};
      _curMonthBills.forEach(b => {
        if (isPaidViaCard(b) && b.parentCardId) linkedByCard[b.parentCardId] = (linkedByCard[b.parentCardId] ?? 0) + b.amount;
      });
      _curMonthBills.forEach(b => {
        if (isPaidViaCard(b)) {
          // Attribute the merchant charge to its real category/provider.
          addCat(b.cat, b.amount);
          addProv(b.provider, b.amount, b.cat, b.id);
          return; // not in billed/paid — the card's statement covers it
        }
        const _owed = totalOwed(b);
        const _remaining = Math.max(0, _owed - _amtPaid(b));
        billed += _owed;
        paid += _amtPaid(b);
        considerBiggest(_remaining, b.provider, b.cat, b.id);
        // A card contributes only the part of its statement not explained by tracked charges.
        const net = Math.max(0, _owed - (linkedByCard[b.id] ?? 0));
        addCat(b.cat, net);
        addProv(b.provider, net, b.cat, b.id);
      });
    } else {
      const linkedByCard: Record<string, number> = {};
      filteredBills.forEach(b => {
        if (isPaidViaCard(b) && b.parentCardId) {
          const recs = (b.paymentHistory ?? []).filter(r => activePeriods!.includes(r.period));
          recs.forEach(r => { linkedByCard[b.parentCardId!] = (linkedByCard[b.parentCardId!] ?? 0) + r.totalDue; });
        }
      });
      filteredBills.forEach(b => {
        const recs = (b.paymentHistory ?? []).filter(r => activePeriods!.includes(r.period));
        const totalDue = recs.reduce((s, r) => s + r.totalDue, 0);
        if (isPaidViaCard(b)) {
          addCat(b.cat, totalDue);
          addProv(b.provider, totalDue, b.cat, b.id);
          return;
        }
        recs.forEach(r => { billed += r.totalDue; paid += r.paid; considerBiggest(r.totalDue, b.provider, b.cat, b.id); });
        const net = Math.max(0, totalDue - (linkedByCard[b.id] ?? 0));
        addCat(b.cat, net);
        addProv(b.provider, net, b.cat, b.id);
      });
    }

    const catSlices: CatSlice[] = Object.entries(catMap)
      .map(([cat, value]) => ({ cat, value, color: (CAT_COLORS as Record<string, string>)[cat] ?? t.accent }))
      .sort((a, b) => b.value - a.value);
    const catTotal = catSlices.reduce((s, c) => s + c.value, 0);

    const topProviders = Object.entries(provMap)
      .map(([provider, d]) => ({ provider, ...d }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return { billedTotal: billed, paidTotal: paid, catTotal, catSlices, topProviders, biggest: biggest as { amount: number; provider: string; cat: string; id: string } | null };
  }, [filteredBills, isHistorical, activePeriods, t.accent]);

  // Personal vs Business split — only relevant when the user actually tags
  // business expenses. Computed over house+period and respects the tag filter
  // (filtering to Business/Personal collapses the pie to that single side) using
  // the same attribute+net money model as "Where it goes": a via-card charge
  // counts toward its OWN tag, and a card contributes only its un-itemized
  // remainder under its tag — so the two sides sum to the same grand total
  // without double-counting.
  const hasBusiness = useMemo(() => bills.some(b => b.isBusiness === true), [bills]);
  const tagSplit = useMemo(() => {
    if (!hasBusiness) return null;
    const scoped = bills.filter(b =>
      (houseF === "All" || b.house === houseF) &&
      (tagF === "all" || (tagF === "business" ? b.isBusiness === true : !b.isBusiness))
    );
    let personal = 0, business = 0;
    const add = (b: Bill, v: number) => {
      if (v <= 0) return;
      if (b.isBusiness) business += v; else personal += v;
    };
    if (!isHistorical) {
      const linkedByCard: Record<string, number> = {};
      scoped.forEach(b => {
        if (isPaidViaCard(b) && b.parentCardId) linkedByCard[b.parentCardId] = (linkedByCard[b.parentCardId] ?? 0) + b.amount;
      });
      scoped.forEach(b => {
        if (isPaidViaCard(b)) { add(b, totalOwed(b)); return; }
        add(b, Math.max(0, totalOwed(b) - (linkedByCard[b.id] ?? 0)));
      });
    } else {
      const linkedByCard: Record<string, number> = {};
      scoped.forEach(b => {
        if (isPaidViaCard(b) && b.parentCardId) {
          const recs = (b.paymentHistory ?? []).filter(r => activePeriods!.includes(r.period));
          recs.forEach(r => { linkedByCard[b.parentCardId!] = (linkedByCard[b.parentCardId!] ?? 0) + r.totalDue; });
        }
      });
      scoped.forEach(b => {
        const recs = (b.paymentHistory ?? []).filter(r => activePeriods!.includes(r.period));
        const totalDue = recs.reduce((s, r) => s + r.totalDue, 0);
        if (isPaidViaCard(b)) { add(b, totalDue); return; }
        add(b, Math.max(0, totalDue - (linkedByCard[b.id] ?? 0)));
      });
    }
    return { personal, business, total: personal + business };
  }, [hasBusiness, bills, houseF, tagF, isHistorical, activePeriods]);

  const billedTotalA = useCountUp(billedTotal);
  const unpaidTotal = billedTotal - paidTotal;
  const paidFrac = billedTotal > 0 ? paidTotal / billedTotal : 0;
  const paidPct = Math.round(paidFrac * 100);
  const providerCount = new Set(filteredBills.map(b => b.provider)).size;

  /* display labels */
  const periodDisplayLabel = useMemo((): string => {
    const today = new Date();
    if (period === "this-month") return `${MO[today.getMonth()]} ${today.getFullYear()}`;
    if (period === "last-month") {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return `${MO[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (period === "3mo") {
      const from = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const to   = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return `${MO[from.getMonth()]} – ${MO[to.getMonth()]} ${to.getFullYear()}`;
    }
    if (period === "6mo") {
      const from = new Date(today.getFullYear(), today.getMonth() - 6, 1);
      const to   = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return `${MO[from.getMonth()]} – ${MO[to.getMonth()]} ${to.getFullYear()}`;
    }
    if (period === "custom" && customFrom && customTo) {
      return `${formatPeriodChip(customFrom)} – ${formatPeriodChip(customTo)}`;
    }
    return `${MO[today.getMonth()]} ${today.getFullYear()}`;
  }, [period, customFrom, customTo]);

  const periodChipLabel = useMemo((): string => {
    if (period === "this-month") return "This month";
    if (period === "last-month") return "Last month";
    if (period === "3mo")        return "3 months";
    if (period === "6mo")        return "6 months";
    if (period === "custom") {
      if (!customFrom || !customTo) return "Custom";
      return `${formatPeriodChip(customFrom)} – ${formatPeriodChip(customTo)}`;
    }
    return "Period";
  }, [period, customFrom, customTo]);

  /* multi-select helpers */
  const toggleCat = (c: string) => setCatSel(prev => { const s = new Set(prev); s.has(c) ? s.delete(c) : s.add(c); return s; });
  const toggleProv = (p: string) => setProvSel(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });

  const anyActive = period !== "this-month" || tagF !== "all" || houseF !== "All" || catSel.size > 0 || provSel.size > 0;
  const clearAll = () => {
    setPeriod("this-month"); setCustomFrom(""); setCustomTo("");
    setTagF("all"); setHouseF("All"); setCatSel(new Set()); setProvSel(new Set()); setOpen(null);
  };

  const card = { borderWidth: 1, borderColor: t.hair, borderRadius: t.radius.md, backgroundColor: t.surface2, padding: t.space.pad } as const;
  const sectionLabel = { fontFamily: t.fonts.medium, fontSize: 13, color: t.txtMid, letterSpacing: 0.5, textTransform: "uppercase" as const, marginTop: 18, marginBottom: 10 };

  return (
    <Screen>
      {/* header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 6, marginBottom: 14 }}>
        <Txt size={28} weight="semibold" style={{ letterSpacing: -0.56 }}>Insights</Txt>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Low size={12}>{periodDisplayLabel}</Low>
          {anyActive && (
            <Pressable onPress={clearAll} hitSlop={8}>
              <Low size={11} color={t.accent}>Clear filters</Low>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── filter chips (horizontal scroll) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        style={{ marginBottom: 10 }}
      >
        <FChip
          active={period !== "this-month"}
          label={periodChipLabel}
          onPress={() => setOpen(open === "period" ? null : "period")}
        />
        <FChip
          active={tagF !== "all"}
          label={tagF === "all" ? "Tag" : tagF === "business" ? "Business" : "Personal"}
          onPress={() => setOpen(open === "tag" ? null : "tag")}
        />
        {multiHouse && (
          <FChip
            active={houseF !== "All"}
            label={houseF === "All" ? "Home" : houseF}
            onPress={() => setOpen(open === "house" ? null : "house")}
          />
        )}
        <FChip
          active={catSel.size > 0}
          label={catSel.size === 0 ? "Category" : catSel.size === 1 ? [...catSel][0]! : `${catSel.size} cats`}
          badge={catSel.size}
          onPress={() => setOpen(open === "cat" ? null : "cat")}
        />
        <FChip
          active={provSel.size > 0}
          label={provSel.size === 0 ? "Provider" : provSel.size === 1 ? [...provSel][0]! : `${provSel.size} providers`}
          badge={provSel.size}
          onPress={() => setOpen(open === "prov" ? null : "prov")}
        />
      </ScrollView>

      {/* ── filter trays ── */}
      {open === "period" && (
        <View style={{ marginBottom: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {(["this-month","last-month","3mo","6mo"] as PeriodKey[]).map((key) => (
              <TrayChip
                key={key}
                label={key === "this-month" ? "This month" : key === "last-month" ? "Last month" : key === "3mo" ? "3 months" : "6 months"}
                selected={period === key}
                onPress={() => { setPeriod(key); setOpen(null); }}
              />
            ))}
            <TrayChip
              label="Custom range"
              selected={period === "custom"}
              onPress={() => setPeriod("custom")}
            />
          </View>
          {period === "custom" && (
            <View style={{ gap: 10 }}>
              <View>
                <Low size={11} style={{ marginBottom: 8 }}>
                  From{customFrom ? ` · ${formatPeriodChip(customFrom)}` : " — pick a month"}
                </Low>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                  {last24Months.map(m => (
                    <TrayChip key={m} label={formatPeriodChip(m)} selected={customFrom === m} onPress={() => setCustomFrom(m)} />
                  ))}
                </ScrollView>
              </View>
              <View>
                <Low size={11} style={{ marginBottom: 8 }}>
                  To{customTo ? ` · ${formatPeriodChip(customTo)}` : " — pick a month"}
                </Low>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                  {last24Months.filter(m => !customFrom || m >= customFrom).map(m => (
                    <TrayChip key={m} label={formatPeriodChip(m)} selected={customTo === m}
                      onPress={() => { setCustomTo(m); if (customFrom) setOpen(null); }} />
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      )}

      {open === "tag" && (
        <View style={{ flexDirection: "row", gap: 7, marginBottom: 14 }}>
          <TrayChip label="All" selected={tagF === "all"} onPress={() => { setTagF("all"); setOpen(null); }} />
          <TrayChip label="Personal" selected={tagF === "personal"} onPress={() => { setTagF("personal"); setOpen(null); }} />
          <TrayChip label="Business" selected={tagF === "business"} onPress={() => { setTagF("business"); setOpen(null); }} />
        </View>
      )}

      {open === "house" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          {["All", ...houses].map(h => (
            <TrayChip key={h} label={h === "All" ? "All homes" : h} selected={houseF === h} onPress={() => { setHouseF(h); setOpen(null); }} />
          ))}
        </View>
      )}

      {open === "cat" && (
        <View style={{ marginBottom: 14, gap: 9 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <TrayChip label="All categories" selected={catSel.size === 0} onPress={() => setCatSel(new Set())} />
            {allCats.map(c => (
              <TrayChip key={c} label={c} selected={catSel.has(c)} onPress={() => toggleCat(c)} />
            ))}
          </View>
          <Pressable onPress={() => setOpen(null)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <Low size={12} color={t.accent}>Done</Low>
          </Pressable>
        </View>
      )}

      {open === "prov" && (
        <View style={{ marginBottom: 14, gap: 9 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <TrayChip label="All providers" selected={provSel.size === 0} onPress={() => setProvSel(new Set())} />
            {allProvs.map(p => (
              <TrayChip key={p} label={p} selected={provSel.has(p)} onPress={() => toggleProv(p)} />
            ))}
          </View>
          <Pressable onPress={() => setOpen(null)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <Low size={12} color={t.accent}>Done</Low>
          </Pressable>
        </View>
      )}

      {/* ── main content ── */}
      {filteredBills.length === 0 && !isHistorical ? (
        <View style={[card, { alignItems: "center", paddingVertical: 30 }]}>
          <Low>No bills match this filter.</Low>
        </View>
      ) : isHistorical && billedTotal === 0 ? (
        <View style={[card, { alignItems: "center", paddingVertical: 28, paddingHorizontal: 16, gap: 8 }]}>
          <Low size={13}>No payment data for this period.</Low>
          <Low size={12} style={{ textAlign: "center", lineHeight: 17 }}>
            Records build up as you mark bills paid or roll them over each month.
          </Low>
        </View>
      ) : (
        <>
          {/* total + paid bar */}
          <View style={[card, { marginBottom: 12 }]}>
            <Low size={12}>{isHistorical ? "Total bill" : "Total bill this month"}</Low>
            <Mono size={36} weight="semibold" style={{ letterSpacing: -0.8, marginTop: 2 }}>
              {money(Math.round(billedTotalA))}
            </Mono>
            <PaidBilledBar paidTotal={paidTotal} billedTotal={billedTotal} paidFrac={paidFrac} money={money} />
          </View>

          {/* KPI grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
            {[
              { label: "Biggest bill", value: biggest ? money(biggest.amount) : "—", sub: biggest?.provider ?? "" },
              {
                label: isHistorical ? "Avg / month" : "Avg / bill",
                value: isHistorical
                  ? (activePeriods!.length > 0 ? money(billedTotal / activePeriods!.length) : "—")
                  : (filteredBills.length ? money(billedTotal / filteredBills.length) : "—"),
                sub: isHistorical
                  ? `${activePeriods!.length} months`
                  : `${filteredBills.length} ${filteredBills.length === 1 ? "bill" : "bills"}`,
              },
              { label: "Providers", value: String(providerCount), sub: `${catSlices.length} ${catSlices.length === 1 ? "category" : "categories"}` },
              {
                label: "Still owed",
                value: money(unpaidTotal),
                sub: paidPct === 100 ? "All paid ✓" : `${paidPct}% paid`,
                valueColor: unpaidTotal > 0 ? t.semantic.urgent : t.semantic.ok,
                subColor: paidPct === 100 ? t.semantic.ok : t.txtMid,
              },
            ].map((kpi, i) => (
              <View key={i} style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
                <Low size={11}>{kpi.label}</Low>
                <Mono size={19} weight="semibold" color={kpi.valueColor}>{kpi.value}</Mono>
                <Low size={11} color={kpi.subColor}>{kpi.sub}</Low>
              </View>
            ))}
          </View>

          {/* personal vs business — only when the user tags business expenses */}
          {tagSplit && tagSplit.total > 0 && (
            <>
              <Txt style={sectionLabel}>PERSONAL VS BUSINESS</Txt>
              <View style={[card, { flexDirection: "row", gap: 16, alignItems: "center" }]}>
                <Pie
                  slices={[
                    { value: tagSplit.personal, color: PERSONAL_COLOR },
                    { value: tagSplit.business, color: BUSINESS_COLOR },
                  ].filter(s => s.value > 0)}
                  size={120}
                />
                <View style={{ flex: 1, gap: 11 }}>
                  {[
                    { label: "Personal", value: tagSplit.personal, color: PERSONAL_COLOR },
                    { label: "Business", value: tagSplit.business, color: BUSINESS_COLOR },
                  ].filter(row => row.value > 0).map(row => (
                    <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: row.color, shadowColor: row.color, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
                      <Txt size={13} style={{ flex: 1 }}>{row.label}</Txt>
                      <Low size={11}>{Math.round((row.value / tagSplit.total) * 100)}%</Low>
                      <Mono size={12} weight="semibold" style={{ minWidth: 52, textAlign: "right" }}>{money(row.value)}</Mono>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* where it goes */}
          <Txt style={sectionLabel}>WHERE IT GOES</Txt>
          <View style={[card, { flexDirection: "row", gap: 16, alignItems: "center" }]}>
            <View style={{ position: "relative" }}>
              <Donut segments={catSlices} total={catTotal} size={130} />
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                <Low size={10}>total</Low>
                <Mono size={15} weight="semibold">{money(catTotal)}</Mono>
              </View>
            </View>
            <View style={{ flex: 1, gap: 9 }}>
              {catSlices.map(c => (
                <View key={c.cat} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color, shadowColor: c.color, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
                  <Txt size={13} style={{ flex: 1 }}>{c.cat}</Txt>
                  <Low size={11}>{catTotal > 0 ? Math.round((c.value / catTotal) * 100) : 0}%</Low>
                  <Mono size={12} weight="semibold" style={{ minWidth: 52, textAlign: "right" }}>{money(c.value)}</Mono>
                </View>
              ))}
            </View>
          </View>

          {/* top providers */}
          <Txt style={sectionLabel}>TOP PROVIDERS</Txt>
          <View style={{ gap: 9 }}>
            {topProviders.map(b => (
              <View key={b.provider} style={{ flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 1, borderColor: t.hair, borderRadius: t.radius.md, backgroundColor: t.surface2, paddingVertical: 13, paddingHorizontal: 14 }}>
                <ProviderLogo provider={b.provider} cat={b.cat} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={15} weight="medium">{b.provider}</Txt>
                  <Low size={12} style={{ marginTop: 2 }}>
                    {b.cat} · {catTotal > 0 ? Math.round((b.amount / catTotal) * 100) : 0}% of total
                  </Low>
                </View>
                <Mono size={15} weight="semibold">{money(b.amount)}</Mono>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ask Judith */}
      <Pressable
        onPress={() => router.push("/ask")}
        style={({ pressed }) => [
          { marginTop: 14, flexDirection: "row", gap: 13, alignItems: "center", borderWidth: 1, borderColor: mix(t.accent, t.surface2, 0.28), borderRadius: t.radius.md, backgroundColor: t.surface2, padding: t.space.pad },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <JudithAvatar persona={persona} size={42} state="idle" />
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="semibold">Ask about your spending</Txt>
          <Low size={12}>"Why is my bill higher this month?"</Low>
        </View>
        <Icon name="mic" size={18} color={t.txtMid} />
      </Pressable>
    </Screen>
  );
}
