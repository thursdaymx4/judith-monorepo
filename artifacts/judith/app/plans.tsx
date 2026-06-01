import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Low, Mono, Screen, SheetHeader, Txt, mix } from "@/components/ui";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

interface Pack {
  price: number;
  asks: number;
  tag: string | null;
}

const PACKS: Pack[] = [
  { price: 49, asks: 15, tag: null },
  { price: 99, asks: 30, tag: "Most popular" },
];

export default function PlansModal() {
  const t = useTheme();
  const router = useRouter();
  const { asksLeft, money, addAsks, showToast } = useJudith();

  const buyAsks = (n: number) => {
    addAsks(n);
    showToast("Added " + n + " asks ✓");
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingTop: 14, gap: 14 }}>
      <SheetHeader title="Top up your asks" onClose={() => router.back()} />

      <Txt size={14} color={t.txtMid} style={{ marginTop: -4 }}>
        Each question to Judith uses one ask. Bills & reminders stay unlimited. You have{" "}
        <Mono size={14} color={t.txtHi}>
          {asksLeft}
        </Mono>{" "}
        left.
      </Txt>

      {PACKS.map((p, i) => (
        <View
          key={i}
          style={{
            borderWidth: 1,
            borderColor: p.tag ? mix(t.accent, t.surface2, 0.35) : t.hair,
            borderRadius: t.radius.md,
            backgroundColor: t.surface2,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 15,
                backgroundColor: mix(t.accent, t.surface3, 0.16),
                borderWidth: 1,
                borderColor: mix(t.accent, t.surface2, 0.35),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mono size={22} weight="bold" color={t.accent} style={{ lineHeight: 22 }}>
                {p.asks}
              </Mono>
              <Text
                style={{
                  fontFamily: t.fonts.regular,
                  fontSize: 9,
                  letterSpacing: 0.72,
                  marginTop: 2,
                  color: t.accent,
                }}
              >
                ASKS
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt size={17} weight="semibold">
                  {p.asks} asks
                </Txt>
                {p.tag && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      borderWidth: 1,
                      borderColor: t.accent,
                      borderRadius: 22,
                      paddingVertical: 3,
                      paddingHorizontal: 9,
                      backgroundColor: mix(t.accent, t.surface2, 0.16),
                    }}
                  >
                    <Icon name="star" size={10} color={t.txtHi} />
                    <Text style={{ fontFamily: t.fonts.regular, fontSize: 10, color: t.txtHi }}>{p.tag}</Text>
                  </View>
                )}
              </View>
              <Low size={12} style={{ marginTop: 3 }}>
                One-time top-up
              </Low>
            </View>

            <Pressable
              onPress={() => buyAsks(p.asks)}
              style={({ pressed }) => [
                {
                  backgroundColor: t.accent,
                  borderRadius: t.radius.md,
                  paddingVertical: 12,
                  paddingHorizontal: 17,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { transform: [{ scale: 0.985 }] },
              ]}
            >
              <Text style={{ fontFamily: t.fonts.bold, fontSize: 15, color: t.onAccent }}>{money(p.price)}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Low size={12} style={{ textAlign: "center" }}>
        One-time top-ups — no subscription.
      </Low>
    </Screen>
  );
}
