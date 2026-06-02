import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Dot, Low, Mono, Screen, SheetHeader, Txt, mix } from "@/components/ui";
import { dueClass, dueShort, dueText, type Bill } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

type NextBill = { provider: string; amount: number; dueDays: number; cat: string };

function WidgetSmall({
  next,
  money,
}: {
  next: NextBill;
  money: (n: number) => string;
}) {
  const t = useTheme();
  const cls = dueClass(next.dueDays);
  return (
    <View
      style={{
        width: 116,
        height: 116,
        flex: 0,
        flexDirection: "column",
        backgroundColor: "rgba(20,23,29,0.72)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        borderRadius: 20,
        padding: 13,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <JudithAvatar persona="pro" size={26} state="idle" />
        <Text style={{ fontFamily: t.fonts.bold, fontSize: 12, color: t.semantic[cls] }}>
          {dueShort(next.dueDays)}
        </Text>
      </View>
      <View style={{ marginTop: "auto" }}>
        <Text
          style={{
            fontFamily: t.fonts.regular,
            fontSize: 10,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Next due
        </Text>
        <Text style={{ fontFamily: t.fonts.semibold, fontSize: 13, lineHeight: 15, color: "#f3f5f8" }}>
          {next.provider}
        </Text>
        <Mono size={19} weight="bold" color="#f3f5f8">
          {money(next.amount)}
        </Mono>
      </View>
    </View>
  );
}

function WidgetMedium({
  due,
  total,
  money,
}: {
  due: Bill[];
  total: number;
  money: (n: number) => string;
}) {
  const t = useTheme();
  const soon = due.slice(0, 3);
  return (
    <View
      style={{
        flex: 1,
        height: 116,
        flexDirection: "row",
        gap: 12,
        backgroundColor: "rgba(20,23,29,0.72)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        borderRadius: 20,
        padding: 13,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: t.fonts.regular,
            fontSize: 10,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Due this month
        </Text>
        <Mono size={24} weight="bold" color="#f3f5f8" style={{ lineHeight: 24 }}>
          {money(total)}
        </Mono>
        <View style={{ flexDirection: "column", gap: 6, marginTop: 12 }}>
          {soon.map((b) => (
            <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Dot kind={dueClass(b.dueDays)} size={7} />
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontFamily: t.fonts.regular, fontSize: 11, color: "#f3f5f8" }}
              >
                {b.provider}
              </Text>
              <Mono size={11} weight="medium" color="#f3f5f8" style={{ opacity: 0.8 }}>
                {money(b.amount)}
              </Mono>
            </View>
          ))}
        </View>
      </View>
      <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
      <View style={{ width: 76, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <JudithAvatar persona="pro" size={40} state="idle" />
        <View style={{ alignItems: "center" }}>
          <Mono size={15} weight="bold" color={t.semantic.near}>
            {due.length}
          </Mono>
          <Text
            style={{
              fontFamily: t.fonts.regular,
              fontSize: 9,
              letterSpacing: 0.36,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            upcoming
          </Text>
        </View>
      </View>
    </View>
  );
}

function DevLabel({ icon, label, marginTop }: { icon: string; label: string; marginTop?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginBottom: 11,
        marginTop: marginTop ?? 0,
      }}
    >
      <Icon name={icon} size={13} color={t.txtLow} />
      <Text
        style={{
          fontFamily: t.fonts.semibold,
          fontSize: 12,
          letterSpacing: 0.48,
          textTransform: "uppercase",
          color: t.txtLow,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function DevicesModal() {
  const t = useTheme();
  const router = useRouter();
  const { bills, money, country } = useJudith();

  const cur = country?.cur || "₱";
  const due = bills
    .filter((b) => b.status !== "paid")
    .slice()
    .sort((a, b) => a.dueDays - b.dueDays);
  const total = due.reduce((s, b) => s + b.amount, 0);
  const next: NextBill = due[0] ?? { provider: "Meralco", amount: 3450, dueDays: 3, cat: "Electricity" };

  return (
    <Screen contentStyle={{ paddingTop: 14, paddingBottom: 28 }}>
      <SheetHeader title="On your devices" onClose={() => router.back()} />
      <Txt size={14} color={t.txtMid} style={{ marginTop: 8, marginBottom: 18 }}>
        A preview of where Judith shows up — concepts for what’s coming next.
      </Txt>

      {/* HOME SCREEN */}
      <DevLabel icon="grid" label="Home Screen" />
      <View
        style={{
          borderRadius: 26,
          padding: 18,
          paddingTop: 20,
          paddingBottom: 16,
          backgroundColor: "#1d2028",
          borderWidth: 1,
          borderColor: t.hair,
        }}
      >
        <View style={{ flexDirection: "row", gap: 14, alignItems: "stretch" }}>
          <WidgetSmall next={next} money={money} />
          <WidgetMedium due={due} total={total} money={money} />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 16,
            marginTop: 18,
            padding: 11,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          {(["phone", "spark", "card", "bell"] as const).map((ic, i) => (
            <View
              key={i}
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix(t.accent, "#1d2028", 0.7),
              }}
            >
              <Icon name={ic} size={18} color="#fff" />
            </View>
          ))}
        </View>
      </View>

      {/* LOCK SCREEN */}
      <DevLabel icon="bell" label="Lock Screen" marginTop={22} />
      <View
        style={{
          borderRadius: 22,
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 18,
          backgroundColor: "#16191f",
          borderWidth: 1,
          borderColor: t.hair,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, marginBottom: 6 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(255,255,255,0.14)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <JudithAvatar persona="pro" size={30} state="idle" />
          </View>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(255,255,255,0.14)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderWidth: 2.5,
              borderColor: t.accent,
            }}
          >
            <Mono size={16} weight="bold" color="#fff" style={{ lineHeight: 16 }}>
              {due.length}
            </Mono>
            <Text
              style={{
                fontSize: 8,
                letterSpacing: 0.48,
                textTransform: "uppercase",
                color: "#fff",
                opacity: 0.8,
                marginTop: 1,
                fontFamily: t.fonts.regular,
              }}
            >
              due
            </Text>
          </View>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: "rgba(255,255,255,0.14)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Icon name="card" size={16} color="#fff" />
            <Mono
              size={8}
              weight="medium"
              color="#fff"
              style={{ letterSpacing: 0.48, opacity: 0.8, marginTop: 1 }}
            >
              {cur}
              {(total / 1000).toFixed(1)}k
            </Mono>
          </View>
        </View>

        <View style={{ alignItems: "center", marginTop: 8, marginBottom: 14 }}>
          <Text
            style={{
              fontFamily: t.fonts.semibold,
              fontSize: 50,
              lineHeight: 50,
              letterSpacing: -1,
              color: "#fff",
            }}
          >
            9:41
          </Text>
          <Text style={{ fontFamily: t.fonts.regular, fontSize: 13, color: "#fff", opacity: 0.8, marginTop: 4 }}>
            Monday, June 1
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.13)",
          }}
        >
          <JudithAvatar persona="pro" size={28} state="idle" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: t.fonts.semibold, fontSize: 12.5, color: "#fff" }}>
              {next.provider} {dueText(next.dueDays)}
            </Text>
            <Text style={{ fontFamily: t.fonts.regular, fontSize: 11, color: "#fff", opacity: 0.75 }}>
              {money(next.amount)} · tap to pay
            </Text>
          </View>
        </View>
      </View>

      {/* APPLE WATCH */}
      <DevLabel icon="watch" label="Apple Watch" marginTop={22} />
      <View style={{ flexDirection: "row", gap: 16, justifyContent: "center" }}>
        {/* watch 1 — month total */}
        <View
          style={{
            width: 150,
            height: 182,
            borderRadius: 46,
            backgroundColor: "#05060a",
            borderWidth: 7,
            borderColor: "#15171d",
            padding: 16,
            paddingHorizontal: 15,
            flexDirection: "row",
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 32,
              backgroundColor: "#14171e",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              paddingVertical: 14,
              paddingHorizontal: 13,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <Mono size={13} weight="bold" color={t.semantic.near}>
                9:41
              </Mono>
              <JudithAvatar persona="pro" size={20} state="idle" />
            </View>
            <Mono size={26} weight="bold" color="#f2f4f7" style={{ lineHeight: 27, letterSpacing: -0.5 }}>
              {money(total)}
            </Mono>
            <Text
              style={{
                fontFamily: t.fonts.regular,
                fontSize: 9,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              due this month
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" }}>
              <Dot kind={dueClass(next.dueDays)} size={7} />
              <Text style={{ fontFamily: t.fonts.regular, fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>
                {next.provider} · {dueShort(next.dueDays)}
              </Text>
            </View>
          </View>
        </View>

        {/* watch 2 — next due */}
        <View
          style={{
            width: 150,
            height: 182,
            borderRadius: 46,
            backgroundColor: "#05060a",
            borderWidth: 7,
            borderColor: "#15171d",
            padding: 16,
            paddingHorizontal: 15,
            flexDirection: "row",
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 32,
              backgroundColor: "#14171e",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 14,
              paddingHorizontal: 13,
            }}
          >
            <JudithAvatar persona="pro" size={34} state="speaking" />
            <Text
              style={{
                fontFamily: t.fonts.regular,
                fontSize: 9,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                marginTop: 2,
              }}
            >
              NEXT DUE
            </Text>
            <Text style={{ fontFamily: t.fonts.semibold, fontSize: 12, color: "#f2f4f7" }}>
              {next.provider}
            </Text>
            <Mono size={20} weight="bold" color="#f2f4f7" style={{ letterSpacing: -0.4, lineHeight: 21 }}>
              {money(next.amount)}
            </Mono>
            <Pressable
              style={({ pressed }) => [
                {
                  marginTop: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: t.accent,
                },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <Text style={{ fontFamily: t.fonts.bold, fontSize: 12, color: "#07080a" }}>Pay now</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Low size={12} style={{ textAlign: "center", marginTop: 20, lineHeight: 18 }}>
        Widgets &amp; Watch are on the roadmap — turn them on in Settings to be first when they ship.
      </Low>
    </Screen>
  );
}
