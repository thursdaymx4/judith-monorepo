import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Low, Mono, ProviderLogo, Screen, Txt, mix } from "@/components/ui";
import { CAT_COLORS } from "@/constants/theme";
import { TREND_6MO } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

type RangeKey = "1m" | "3m" | "6m" | "1y";
interface TrendPoint {
  m: string;
  a: number;
}
interface CatSlice {
  cat: string;
  value: number;
  color: string;
}

/* ---- donut ---- */
function Donut({
  segments,
  total,
  size = 130,
}: {
  segments: CatSlice[];
  total: number;
  size?: number;
}) {
  const t = useTheme();
  const stroke = 18;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={t.surface3}
          strokeWidth={stroke}
        />
        {segments.map((s, i) => {
          const len = total > 0 ? (s.value / total) * C : 0;
          const dash = Math.max(0, len - 3);
          const seg = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return seg;
        })}
      </G>
    </Svg>
  );
}

/* ---- trend bars ---- */
function TrendBars({ data }: { data: TrendPoint[] }) {
  const t = useTheme();
  const max = Math.max(...data.map((d) => d.a), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 110, marginTop: 8 }}>
      {data.map((d, i) => {
        const h = Math.max(8, (d.a / max) * 100);
        const last = i === data.length - 1;
        const colors: [string, string] = last
          ? [t.accent, mix(t.accent, t.surface3, 0.45)]
          : [mix(t.accent, t.surface3, 0.22), t.surface3];
        return (
          <View
            key={d.m + i}
            style={{
              flex: 1,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              height: "100%",
            }}
          >
            <Mono size={9} weight="medium" color={t.txtLow}>
              {(d.a / 1000).toFixed(1)}k
            </Mono>
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                width: "100%",
                height: `${h}%`,
                borderTopLeftRadius: 7,
                borderTopRightRadius: 7,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
                ...(last
                  ? {
                      shadowColor: t.accent,
                      shadowOpacity: 0.55,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                    }
                  : {}),
              }}
            />
            <Txt
              size={10}
              weight={last ? "bold" : "regular"}
              color={last ? t.accent : t.txtLow}
            >
              {d.m}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/* ---- compact filter header ---- */
type TrayKey = "cat" | "prov" | "house" | null;

function SegRange({ range, setRange }: { range: RangeKey; setRange: (r: RangeKey) => void }) {
  const t = useTheme();
  const ranges: [RangeKey, string][] = [
    ["1m", "1M"],
    ["3m", "3M"],
    ["6m", "6M"],
    ["1y", "1Y"],
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.surface2,
        borderWidth: 1,
        borderColor: t.hair,
        borderRadius: 11,
        padding: 3,
        gap: 2,
      }}
    >
      {ranges.map(([v, l]) => {
        const on = range === v;
        return (
          <Pressable
            key={v}
            onPress={() => setRange(v)}
            style={{
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? t.accent : "transparent",
            }}
          >
            <Txt size={12} weight="semibold" color={on ? t.onAccent : t.txtMid}>
              {l}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function FChip({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: "home" | "layers" | "grid";
  onPress: () => void;
}) {
  const t = useTheme();
  const color = active ? t.accent : t.txtMid;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: active ? t.accent : t.hair,
        backgroundColor: active ? mix(t.accent, t.surface2, 0.12) : t.surface2,
      }}
    >
      <Icon name={icon} size={13} color={color} />
      <Txt size={12} weight="semibold" color={color} numberOfLines={1}>
        {label}
      </Txt>
      <Icon name="chev" size={12} color={color} />
    </Pressable>
  );
}

function TrayChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: selected ? t.accent : t.hair,
        borderRadius: 22,
        paddingVertical: 7,
        paddingHorizontal: 12,
        backgroundColor: selected ? mix(t.accent, t.surface2, 0.16) : t.surface2,
      }}
    >
      <Txt size={12.5} color={selected ? t.txtHi : t.txtMid}>
        {label}
      </Txt>
    </Pressable>
  );
}

export default function InsightsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { bills, persona, money } = useJudith();

  const [range, setRange] = useState<RangeKey>("6m");
  const [catF, setCatF] = useState("All");
  const [provF, setProvF] = useState("All");
  const [houseF, setHouseF] = useState("All");
  const [open, setOpen] = useState<TrayKey>(null);

  const houses = Array.from(
    new Set(bills.map((b) => b.house).filter((h): h is string => Boolean(h))),
  );
  const multiHouse = houses.length > 1;
  const allCats = Array.from(
    new Set(bills.filter((b) => houseF === "All" || b.house === houseF).map((b) => b.cat)),
  );
  const provsForCat = bills
    .filter(
      (b) =>
        (houseF === "All" || b.house === houseF) && (catF === "All" || b.cat === catF),
    )
    .map((b) => b.provider);
  const allProvs = Array.from(new Set(provsForCat));

  const active = bills.filter(
    (b) =>
      (houseF === "All" || b.house === houseF) &&
      (catF === "All" || b.cat === catF) &&
      (provF === "All" || b.provider === provF),
  );
  const total = active.reduce((s, b) => s + b.amount, 0);
  const prev = TREND_6MO[TREND_6MO.length - 2]!.a;
  const delta = total - prev;
  const deltaPct = prev > 0 ? Math.round((delta / prev) * 100) : 0;

  const catMap: Record<string, number> = {};
  active.forEach((b) => {
    catMap[b.cat] = (catMap[b.cat] || 0) + b.amount;
  });
  const cats: CatSlice[] = Object.keys(catMap)
    .map((cat) => ({ cat, value: catMap[cat]!, color: CAT_COLORS[cat] || t.accent }))
    .sort((a, b) => b.value - a.value);
  const providers = active.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);
  const biggest = active.slice().sort((a, b) => b.amount - a.amount)[0];
  const providerCount = new Set(active.map((b) => b.provider)).size;
  const nMap: Record<RangeKey, number> = { "1m": 2, "3m": 3, "6m": 6, "1y": 6 };
  const lastTrend = TREND_6MO[TREND_6MO.length - 1]!.a;
  const trendData: TrendPoint[] = TREND_6MO.slice(-nMap[range]).map((d) => ({
    ...d,
    a:
      catF === "All" && provF === "All"
        ? d.a
        : Math.round(d.a * (total / (lastTrend || 1))),
  }));

  const deltaColor = delta >= 0 ? t.semantic.urgent : t.semantic.ok;

  const card = {
    borderWidth: 1,
    borderColor: t.hair,
    borderRadius: t.radius.md,
    backgroundColor: t.surface2,
    padding: t.space.pad,
  } as const;

  const sectionLabel = {
    fontFamily: t.fonts.medium,
    fontSize: 13,
    color: t.txtMid,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginTop: 18,
    marginBottom: 10,
  };

  return (
    <Screen contentStyle={{ paddingTop: 8 }}>
      {/* header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 6,
          marginBottom: 12,
        }}
      >
        <Txt size={28} weight="semibold" style={{ letterSpacing: -0.56 }}>
          Insights
        </Txt>
      </View>

      {/* filters */}
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <SegRange range={range} setRange={setRange} />
          {multiHouse && (
            <FChip
              active={houseF !== "All"}
              label={houseF === "All" ? "All homes" : houseF}
              icon="home"
              onPress={() => setOpen(open === "house" ? null : "house")}
            />
          )}
          <FChip
            active={catF !== "All"}
            label={catF === "All" ? "Category" : catF}
            icon="layers"
            onPress={() => setOpen(open === "cat" ? null : "cat")}
          />
          <FChip
            active={provF !== "All"}
            label={provF === "All" ? "Provider" : provF}
            icon="grid"
            onPress={() => setOpen(open === "prov" ? null : "prov")}
          />
        </View>
        {open === "house" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {["All", ...houses].map((h) => (
              <TrayChip
                key={h}
                label={h === "All" ? "All homes" : h}
                selected={houseF === h}
                onPress={() => {
                  setHouseF(h);
                  setOpen(null);
                }}
              />
            ))}
          </View>
        )}
        {open === "cat" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {["All", ...allCats].map((c) => (
              <TrayChip
                key={c}
                label={c}
                selected={catF === c}
                onPress={() => {
                  setCatF(c);
                  setProvF("All");
                  setOpen(null);
                }}
              />
            ))}
          </View>
        )}
        {open === "prov" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {["All", ...allProvs].map((p) => (
              <TrayChip
                key={p}
                label={p}
                selected={provF === p}
                onPress={() => {
                  setProvF(p);
                  setOpen(null);
                }}
              />
            ))}
          </View>
        )}
      </View>

      {active.length === 0 ? (
        <View style={[card, { alignItems: "center", paddingVertical: 30, paddingHorizontal: 16 }]}>
          <Low>No bills match these filters.</Low>
        </View>
      ) : (
        <>
          {/* total monthly bills */}
          <View style={[card, { marginBottom: 12 }]}>
            <Low size={12}>Total monthly bills</Low>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 11, flexWrap: "wrap" }}>
              <Mono size={40} weight="semibold" style={{ letterSpacing: -0.8 }}>
                {money(total)}
              </Mono>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="trend" size={14} color={deltaColor} />
                <Txt size={13} color={deltaColor}>
                  {delta >= 0 ? "+" : ""}
                  {deltaPct}% vs prev
                </Txt>
              </View>
            </View>
            <TrendBars data={trendData} />
          </View>

          {/* KPI grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>Biggest bill</Low>
              <Mono size={19} weight="semibold">
                {biggest ? money(biggest.amount) : "—"}
              </Mono>
              <Low size={11}>{biggest ? biggest.provider : ""}</Low>
            </View>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>Avg / bill</Low>
              <Mono size={19} weight="semibold">
                {active.length ? money(total / active.length) : "—"}
              </Mono>
              <Low size={11}>{active.length} bills</Low>
            </View>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>Providers</Low>
              <Mono size={19} weight="semibold">
                {providerCount}
              </Mono>
              <Low size={11}>across {cats.length} categories</Low>
            </View>
            <View style={[card, { width: "47.5%", paddingVertical: 14, paddingHorizontal: 15, gap: 2 }]}>
              <Low size={11}>On-time rate</Low>
              <Mono size={19} weight="semibold" color={t.semantic.ok}>
                100%
              </Mono>
              <Low size={11}>last 6 months</Low>
            </View>
          </View>

          {/* where it goes */}
          <Txt style={sectionLabel}>WHERE IT GOES</Txt>
          <View style={[card, { flexDirection: "row", gap: 16, alignItems: "center" }]}>
            <View style={{ position: "relative" }}>
              <Donut segments={cats} total={total} size={130} />
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Low size={10}>monthly</Low>
                <Mono size={15} weight="semibold">
                  {money(total)}
                </Mono>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: "column", gap: 9 }}>
              {cats.map((c) => (
                <View key={c.cat} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: c.color,
                      shadowColor: c.color,
                      shadowOpacity: 0.9,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 0 },
                    }}
                  />
                  <Txt size={13} style={{ flex: 1 }}>
                    {c.cat}
                  </Txt>
                  <Low size={11}>{total > 0 ? Math.round((c.value / total) * 100) : 0}%</Low>
                  <Mono size={12} weight="semibold" style={{ minWidth: 52, textAlign: "right" }}>
                    {money(c.value)}
                  </Mono>
                </View>
              ))}
            </View>
          </View>

          {/* top providers */}
          <Txt style={sectionLabel}>TOP PROVIDERS</Txt>
          <View style={{ flexDirection: "column", gap: 9 }}>
            {providers.map((b) => (
              <View
                key={b.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 13,
                  borderWidth: 1,
                  borderColor: t.hair,
                  borderRadius: t.radius.md,
                  backgroundColor: t.surface2,
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                }}
              >
                <ProviderLogo provider={b.provider} cat={b.cat} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={15} weight="medium">
                    {b.provider}
                  </Txt>
                  <Low size={12} style={{ marginTop: 2 }}>
                    {b.cat} · {total > 0 ? Math.round((b.amount / total) * 100) : 0}% of bills
                  </Low>
                </View>
                <Mono size={15} weight="semibold">
                  {money(b.amount)}
                </Mono>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ask about spending */}
      <Pressable
        onPress={() => router.push("/ask")}
        style={({ pressed }) => [
          {
            marginTop: 14,
            flexDirection: "row",
            gap: 13,
            alignItems: "center",
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.28),
            borderRadius: t.radius.md,
            backgroundColor: t.surface2,
            padding: t.space.pad,
          },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <JudithAvatar persona={persona} size={42} state="idle" />
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="semibold">
            Ask about your spending
          </Txt>
          <Low size={12}>“Why is my bill higher this month?”</Low>
        </View>
        <Icon name="mic" size={18} color={t.txtMid} />
      </Pressable>
    </Screen>
  );
}
