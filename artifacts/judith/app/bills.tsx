import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BillRow, Card, Chip, Low, Mono, Screen, SheetHeader } from "@/components/ui";
import { currentCycleDue, type Bill } from "@/constants/data";
import { getCategoryLabel } from "@/constants/categoryLocale";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { isPaidThisMonth, remainingThisMonth } from "@/lib/currentCycle";

type SortKey = "due" | "amount" | "name";

export default function BillsModal() {
  const t = useTheme();
  const router = useRouter();
  const { bills, money, language } = useJudith();
  const [cat, setCat] = useState("All");
  const [prov, setProv] = useState("All");
  const [sort, setSort] = useState<SortKey>("due");
  const today = new Date();

  const cats = ["All", ...Array.from(new Set(bills.map((b) => b.cat)))];
  const provsForCat = bills
    .filter((b) => cat === "All" || b.cat === cat)
    .map((b) => b.provider);
  const provs = ["All", ...Array.from(new Set(provsForCat))];

  const billRemaining = (b: Bill) => remainingThisMonth(b, today);
  const liveBills = bills.map((b) => ({ ...b, ...currentCycleDue(b, today) }));

  let list = liveBills.filter(
    (b) => (cat === "All" || b.cat === cat) && (prov === "All" || b.provider === prov),
  );
  list = list.slice().sort((a, b) => {
    if (sort === "amount") return billRemaining(b) - billRemaining(a);
    if (sort === "name") return a.provider.localeCompare(b.provider);
    // due: unpaid first by days, paid last
    const aPaid = isPaidThisMonth(a, today);
    const bPaid = isPaidThisMonth(b, today);
    if (aPaid !== bPaid) return aPaid ? 1 : -1;
    return a.dueDays - b.dueDays;
  });
  const total = list
    .filter((b) => !isPaidThisMonth(b, today))
    .reduce((s, b) => s + billRemaining(b), 0);
  const sorts: [SortKey, string][] = [
    ["due", "Due date"],
    ["amount", "Amount"],
    ["name", "Name"],
  ];

  const flabelStyle = {
    fontFamily: t.fonts.regular,
    fontSize: 11,
    color: t.txtLow,
    letterSpacing: 0.55,
    textTransform: "uppercase" as const,
    width: 64,
  };
  const chipStyle = { paddingVertical: 7, paddingHorizontal: 12 };

  return (
    <Screen contentStyle={{ paddingTop: 14 }}>
      <SheetHeader title="All bills" onClose={() => router.back()} />
      <Low size={12} style={{ marginTop: 6 }}>
        {list.length} shown · <Mono size={12}>{money(total)}</Mono> due
      </Low>

      <View
        style={{
          gap: 10,
          marginTop: 14,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: t.hair2,
        }}
      >
        {/* Category */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={flabelStyle}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, paddingBottom: 2 }}
          >
            {cats.map((c) => (
              <Chip
                key={c}
                label={c === "All" ? "All" : getCategoryLabel(c, language)}
                selected={cat === c}
                onPress={() => {
                  setCat(c);
                  setProv("All");
                }}
                style={chipStyle}
              />
            ))}
          </ScrollView>
        </View>

        {/* Provider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={flabelStyle}>Provider</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, paddingBottom: 2 }}
          >
            {provs.map((p) => (
              <Chip
                key={p}
                label={p}
                selected={prov === p}
                onPress={() => setProv(p)}
                style={chipStyle}
              />
            ))}
          </ScrollView>
        </View>

        {/* Sort */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={flabelStyle}>Sort</Text>
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
            {sorts.map(([v, l]) => {
              const on = sort === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setSort(v)}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    backgroundColor: on ? t.accent : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: t.fonts.semibold,
                      fontSize: 13,
                      color: on ? t.onAccent : t.txtMid,
                    }}
                  >
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={{ gap: 9, marginTop: 14 }}>
        {list.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: 30, paddingHorizontal: 16 }}>
            <Low>No bills match these filters.</Low>
          </Card>
        ) : (
          list.map((b) => (
            <BillRow
              key={b.id}
              bill={b}
              money={money}
              onPress={() => router.push(`/bill/${b.id}`)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}
