import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Low, Mono, ProviderLogo, Screen, Txt, mix } from "@/components/ui";
import { CAT_COLORS } from "@/constants/theme";
import { useJudith } from "@/contexts/JudithStore";
import { useCountUp } from "@/hooks/useCountUp";
import { useTheme } from "@/hooks/useTheme";

interface CatSlice { cat: string; value: number; color: string }

/* ---- donut ---- */
function Donut({ segments, total, size = 130 }: { segments: CatSlice[]; total: number; size?: number }) {
  const t = useTheme();
  const stroke = 18;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.surface3} strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = total > 0 ? (s.value / total) * C : 0;
          const dash = Math.max(0, len - 3);
          const seg = (
            <Circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
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

/* ---- paid vs billed bar ---- */
function PaidBilledBar({ paidTotal, billedTotal, paidFrac, money }: {
  paidTotal: number; billedTotal: number; paidFrac: number; money: (n: number) => string;
}) {
  const t = useTheme();
  const paidPct = Math.round(paidFrac * 100);
  return (
    <View style={{ gap: 10, marginTop: 16 }}>
      {/* billed bar with paid overlay */}
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Low size={11}>Billed this month</Low>
          <Mono size={11} weight="semibold">{money(billedTotal)}</Mono>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: t.surface3, overflow: "hidden" }}>
          <LinearGradient
            colors={[t.accent, mix(t.accent, t.surface3, 0.4)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ width: "100%", height: "100%", borderRadius: 5 }}
          />
        </View>
      </View>
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Low size={11}>Paid so far</Low>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Txt size={11} weight="semibold" color={paidPct === 100 ? t.semantic.ok : t.txtHi}>{money(paidTotal)}</Txt>
            <Low size={10}>({paidPct}%)</Low>
          </View>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: t.surface3, overflow: "hidden" }}>
          {paidFrac > 0 && (
            <LinearGradient
              colors={[t.semantic.ok, mix(t.semantic.ok, t.surface3, 0.3)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ width: `${paidPct}%`, height: "100%", borderRadius: 5 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

type TrayKey = "cat" | "prov" | "house" | null;

function FChip({ active, label, icon, onPress }: {
  active: boolean; label: string; icon: "home" | "layers" | "grid"; onPress: () => void;
}) {
  const t = useTheme();
  const color = active ? t.accent : t.txtMid;
  return (
    <Pressable onPress={onPress} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderColor: active ? t.accent : t.hair, backgroundColor: active ? mix(t.accent, t.surface2, 0.12) : t.surface2 }}>
      <Icon name={icon} size={13} color={color} />
      <Txt size={12} weight="semibold" color={color} numberOfLines={1}>{label}</Txt>
      <Icon name="chev" size={12} color={color} />
    </Pressable>
  );
}

function TrayChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ borderWidth: 1, borderColor: selected ? t.accent : t.hair, borderRadius: 22, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: selected ? mix(t.accent, t.surface2, 0.16) : t.surface2 }}>
      <Txt size={12.5} color={selected ? t.txtHi : t.txtMid}>{label}</Txt>
    </Pressable>
  );
}

export default function InsightsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { bills, persona, money } = useJudith();

  const [catF, setCatF] = useState("All");
  const [provF, setProvF] = useState("All");
  const [houseF, setHouseF] = useState("All");
  const [open, setOpen] = useState<TrayKey>(null);

  const houses = Array.from(new Set(bills.map((b) => b.house).filter((h): h is string => Boolean(h))));
  const multiHouse = houses.length > 1;
  const allCats = Array.from(new Set(
    bills.filter((b) => houseF === "All" || b.house === houseF).map((b) => b.cat)
  ));
  const allProvs = Array.from(new Set(
    bills
      .filter((b) => (houseF === "All" || b.house === houseF) && (catF === "All" || b.cat === catF))
      .map((b) => b.provider)
  ));

  const active = bills.filter(
    (b) =>
      (houseF === "All" || b.house === houseF) &&
      (catF === "All" || b.cat === catF) &&
      (provF === "All" || b.provider === provF),
  );

  // Real totals only — from the user's actual logged bills
  const billedTotal = active.reduce((s, b) => s + b.amount, 0);
  const billedTotalA = useCountUp(billedTotal);

  const paidTotal = active.reduce((s, b) => {
    if (b.status === "paid") return s + b.amount;
    return s + (b.amountPaid ?? 0);
  }, 0);
  const unpaidTotal = billedTotal - paidTotal;
  const paidFrac = billedTotal > 0 ? paidTotal / billedTotal : 0;
  const paidPct = Math.round(paidFrac * 100);

  const catMap: Record<string, number> = {};
  active.forEach((b) => { catMap[b.cat] = (catMap[b.cat] || 0) + b.amount; });
  const cats: CatSlice[] = Object.keys(catMap)
    .map((cat) => ({ cat, value: catMap[cat]!, color: CAT_COLORS[cat] || t.accent }))
    .sort((a, b) => b.value - a.value);

  const providers = active.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);
  const biggest = active.slice().sort((a, b) => b.amount - a.amount)[0];
  const providerCount = new Set(active.map((b) => b.provider)).size;

  const card = { borderWidth: 1, borderColor: t.hair, borderRadius: t.radius.md, backgroundColor: t.surface2, padding: t.space.pad } as const;
  const sectionLabel = { fontFamily: t.fonts.medium, fontSize: 13, color: t.txtMid, letterSpacing: 0.5, textTransform: "uppercase" as const, marginTop: 18, marginBottom: 10 };

  // Current month label for display
  const now = new Date();
  const monthLabel = now.toLocaleString("default", { month: "long" });
  const yearLabel = now.getFullYear();

  return (
    <Screen>
      {/* header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 12 }}>
        <Txt size={28} weight="semibold" style={{ letterSpacing: -0.56 }}>Insights</Txt>
        <Low size={12}>{monthLabel} {yearLabel}</Low>
      </View>

      {/* filters */}
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {multiHouse && (
            <FChip active={houseF !== "All"} label={houseF === "All" ? "All homes" : houseF} icon="home" onPress={() => setOpen(open === "house" ? null : "house")} />
          )}
          <FChip active={catF !== "All"} label={catF === "All" ? "Category" : catF} icon="layers" onPress={() => setOpen(open === "cat" ? null : "cat")} />
          <FChip active={provF !== "All"} label={provF === "All" ? "Provider" : provF} icon="grid" onPress={() => setOpen(open === "prov" ? null : "prov")} />
        </View>
        {open === "house" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {["All", ...houses].map((h) => (
              <TrayChip key={h} label={h === "All" ? "All homes" : h} selected={houseF === h} onPress={() => { setHouseF(h); setOpen(null); }} />
            ))}
          </View>
        )}
        {open === "cat" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {["All", ...allCats].map((c) => (
              <TrayChip key={c} label={c} selected={catF === c} onPress={() => { setCatF(c); setProvF("All"); setOpen(null); }} />
            ))}
          </View>
        )}
        {open === "prov" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {["All", ...allProvs].map((p) => (
              <TrayChip key={p} label={p} selected={provF === p} onPress={() => { setProvF(p); setOpen(null); }} />
            ))}
          </View>
        )}
      </View>

      {active.length === 0 ? (
        <View style={[card, { alignItems: "center", paddingVertical: 30, paddingHorizontal: 16 }]}>
          <Low>No bills logged yet.</Low>
        </View>
      ) : (
        <>
          {/* ── total billed + paid vs billed ── */}
          <View style={[card, { marginBottom: 12 }]}>
            <Low size={12}>Total billed this month</Low>
            <Mono size={36} weight="semibold" style={{ letterSpacing: -0.8, marginTop: 2 }}>
              {money(Math.round(billedTotalA))}
            </Mono>

            <PaidBilledBar
              paidTotal={paidTotal}
              billedTotal={billedTotal}
              paidFrac={paidFrac}
              money={money}
            />
          </View>

          {/* KPI grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>Biggest bill</Low>
              <Mono size={19} weight="semibold">{biggest ? money(biggest.amount) : "—"}</Mono>
              <Low size={11}>{biggest ? biggest.provider : ""}</Low>
            </View>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>Avg / bill</Low>
              <Mono size={19} weight="semibold">{active.length ? money(billedTotal / active.length) : "—"}</Mono>
              <Low size={11}>{active.length} {active.length === 1 ? "bill" : "bills"}</Low>
            </View>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>Providers</Low>
              <Mono size={19} weight="semibold">{providerCount}</Mono>
              <Low size={11}>across {cats.length} {cats.length === 1 ? "category" : "categories"}</Low>
            </View>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>Still owed</Low>
              <Mono size={19} weight="semibold" color={unpaidTotal > 0 ? t.semantic.urgent : t.semantic.ok}>
                {money(unpaidTotal)}
              </Mono>
              <Low size={11} color={paidPct === 100 ? t.semantic.ok : t.txtMid}>
                {paidPct === 100 ? "All paid ✓" : `${paidPct}% paid`}
              </Low>
            </View>
          </View>

          {/* where it goes */}
          <Txt style={sectionLabel}>WHERE IT GOES</Txt>
          <View style={[card, { flexDirection: "row", gap: 16, alignItems: "center" }]}>
            <View style={{ position: "relative" }}>
              <Donut segments={cats} total={billedTotal} size={130} />
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Low size={10}>monthly</Low>
                <Mono size={15} weight="semibold">{money(billedTotal)}</Mono>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: "column", gap: 9 }}>
              {cats.map((c) => (
                <View key={c.cat} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color, shadowColor: c.color, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
                  <Txt size={13} style={{ flex: 1 }}>{c.cat}</Txt>
                  <Low size={11}>{billedTotal > 0 ? Math.round((c.value / billedTotal) * 100) : 0}%</Low>
                  <Mono size={12} weight="semibold" style={{ minWidth: 52, textAlign: "right" }}>{money(c.value)}</Mono>
                </View>
              ))}
            </View>
          </View>

          {/* top providers */}
          <Txt style={sectionLabel}>TOP PROVIDERS</Txt>
          <View style={{ flexDirection: "column", gap: 9 }}>
            {providers.map((b) => (
              <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 1, borderColor: t.hair, borderRadius: t.radius.md, backgroundColor: t.surface2, paddingVertical: 13, paddingHorizontal: 14 }}>
                <ProviderLogo provider={b.provider} cat={b.cat} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={15} weight="medium">{b.provider}</Txt>
                  <Low size={12} style={{ marginTop: 2 }}>
                    {b.cat} · {billedTotal > 0 ? Math.round((b.amount / billedTotal) * 100) : 0}% of bills
                  </Low>
                </View>
                <Mono size={15} weight="semibold">{money(b.amount)}</Mono>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ask about spending */}
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
