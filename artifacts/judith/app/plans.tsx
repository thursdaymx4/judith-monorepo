import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Low, SheetHeader, Txt, mix, Mono } from "@/components/ui";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import {
  getTierPackages,
  purchaseForTier,
  type TierPackages,
} from "@/lib/purchases";
import type { PurchasesPackage } from "react-native-purchases";

const CHAT_FEATURES = [
  "Unlimited text asks to Judith",
  "Bill tracking & reminders",
  "All 5 personas",
];

const VOICE_FEATURES = [
  "Everything in Chat Ask",
  "Unlimited voice asks (speak + listen)",
  "Voice replies in your language",
];

interface PlanCardProps {
  title: string;
  price: number;
  priceLabel: string;
  badge?: string;
  highlight?: boolean;
  features: string[];
  cta: string;
  active: boolean;
  loading: boolean;
  onPress: () => void;
  money: (n: number) => string;
}

function PlanCard({
  title,
  priceLabel,
  badge,
  highlight,
  features,
  cta,
  active,
  loading,
  onPress,
}: PlanCardProps) {
  const t = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: highlight ? mix(t.accent, t.surface2, 0.3) : t.hair,
        borderRadius: t.radius.md,
        backgroundColor: highlight
          ? mix(t.accent, t.surface2, 0.1)
          : t.surface2,
        overflow: "hidden",
      }}
    >
      {badge && (
        <View
          style={{
            backgroundColor: t.accent,
            paddingVertical: 5,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: t.fonts.semibold,
              fontSize: 11,
              letterSpacing: 0.6,
              color: t.onAccent,
            }}
          >
            {badge.toUpperCase()}
          </Text>
        </View>
      )}

      <View style={{ padding: 18, gap: 14 }}>
        {/* header */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ gap: 3 }}>
            <Txt size={17} weight="semibold">{title}</Txt>
            <Txt size={22} weight="bold" color={highlight ? t.accent : t.txtHi}>
              {priceLabel}
            </Txt>
            <Low size={11}>per month · cancel anytime</Low>
          </View>
          {active && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                borderWidth: 1,
                borderColor: mix(t.semantic.ok, t.surface2, 0.4),
                borderRadius: 20,
                paddingVertical: 4,
                paddingHorizontal: 10,
                backgroundColor: mix(t.semantic.ok, t.surface2, 0.12),
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: t.semantic.ok,
                }}
              />
              <Txt size={11} weight="semibold" color={t.semantic.ok}>
                Active
              </Txt>
            </View>
          )}
        </View>

        {/* features */}
        <View style={{ gap: 8 }}>
          {features.map((f) => (
            <View key={f} style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
              <View style={{ marginTop: 1 }}>
                <Icon name="check" size={14} color={t.accent} />
              </View>
              <Low size={13} style={{ flex: 1, lineHeight: 18 }}>{f}</Low>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={active || loading ? undefined : onPress}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 15,
            borderRadius: 12,
            backgroundColor: active
              ? t.surface3
              : highlight
              ? t.accent
              : mix(t.accent, t.surface2, 0.25),
            borderWidth: active ? 1 : 0,
            borderColor: t.hair,
            opacity: pressed && !active && !loading ? 0.85 : 1,
            minHeight: 50,
          })}
        >
          {loading ? (
            <ActivityIndicator color={highlight ? t.onAccent : t.accent} size="small" />
          ) : (
            <Txt
              size={15}
              weight="semibold"
              color={active ? t.txtMid : highlight ? t.onAccent : t.accent}
            >
              {cta}
            </Txt>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function PlansModal() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { asksLeft, tier, money, subscribe, showToast } = useJudith();

  const [packages, setPackages] = useState<TierPackages>({ chat: null, voice: null });
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [buyingTier, setBuyingTier] = useState<"chat" | "voice" | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const voiceCardY = useRef<number>(0);

  useEffect(() => {
    getTierPackages()
      .then(setPackages)
      .finally(() => setLoadingPkgs(false));
  }, []);

  // Auto-scroll to the Voice Ask card when arriving with focus=voice
  useEffect(() => {
    if (focus !== "voice") return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: voiceCardY.current, animated: true });
    }, 300);
    return () => clearTimeout(id);
  }, [focus, loadingPkgs]);

  const buy = async (targetTier: "chat" | "voice", pkg: PurchasesPackage | null) => {
    if (!pkg) {
      // RevenueCat not configured (Expo Go / dev build without keys) — simulate locally
      subscribe(targetTier);
      showToast(
        targetTier === "chat" ? "Chat Ask activated ✓" : "Voice Ask activated ✓",
      );
      router.back();
      return;
    }
    setBuyingTier(targetTier);
    try {
      const newTier = await purchaseForTier(pkg);
      if (newTier !== "free") {
        subscribe(newTier);
        showToast(newTier === "voice" ? "Voice Ask activated ✓" : "Chat Ask activated ✓");
        router.back();
      } else {
        showToast("Purchase cancelled");
      }
    } catch {
      showToast("Purchase failed — try again");
    } finally {
      setBuyingTier(null);
    }
  };

  const chatActive = tier === "chat" || tier === "voice";
  const voiceActive = tier === "voice";
  const focusVoice = focus === "voice";

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: t.canvas }}
      contentContainerStyle={{
        paddingHorizontal: 22,
        paddingTop: Math.max(insets.top, 44) + 14,
        paddingBottom: 96,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <SheetHeader title="Ask Judith plan" onClose={() => router.back()} />

      {/* free-tier status */}
      {tier === "free" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: t.radius.md,
            backgroundColor: t.surface2,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <Icon name="spark" size={16} color={t.accent} />
          <Low size={13} style={{ flex: 1 }}>
            You have{" "}
            <Mono size={13} color={t.txtHi} weight="bold">
              {asksLeft}
            </Mono>{" "}
            free ask{asksLeft !== 1 ? "s" : ""} remaining. Subscribe for unlimited.
          </Low>
        </View>
      )}

      {/* Upgrade nudge banner — shown when arriving from the voice upgrade sheet */}
      {focusVoice && !voiceActive && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.35),
            borderRadius: t.radius.md,
            backgroundColor: mix(t.accent, t.surface2, 0.1),
            paddingVertical: 11,
            paddingHorizontal: 14,
          }}
        >
          <Icon name="mic" size={16} color={t.accent} />
          <Low size={13} style={{ flex: 1 }}>
            Voice asks are included in{" "}
            <Txt size={13} weight="semibold" color={t.txtHi}>Voice Ask (₱199/mo)</Txt>
            {" "}— upgrade below.
          </Low>
        </View>
      )}

      {loadingPkgs ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : (
        <>
          <PlanCard
            title="Chat Ask"
            price={99}
            priceLabel={money(99)}
            features={CHAT_FEATURES}
            cta={chatActive ? "Current plan" : "Subscribe · " + money(99) + "/mo"}
            active={chatActive}
            loading={buyingTier === "chat"}
            highlight={!chatActive && !focusVoice}
            onPress={() => buy("chat", packages.chat)}
            money={money}
          />

          <View
            onLayout={(e) => { voiceCardY.current = e.nativeEvent.layout.y; }}
          >
            <PlanCard
              title="Voice Ask"
              price={199}
              priceLabel={money(199)}
              badge={focusVoice && !voiceActive ? "Recommended for you" : "Includes Chat"}
              features={VOICE_FEATURES}
              cta={voiceActive ? "Current plan" : "Subscribe · " + money(199) + "/mo"}
              active={voiceActive}
              loading={buyingTier === "voice"}
              highlight={true}
              onPress={() => buy("voice", packages.voice)}
              money={money}
            />
          </View>
        </>
      )}

      <Low size={11} style={{ textAlign: "center", lineHeight: 16 }}>
        Subscriptions are managed by the App Store / Google Play.{"\n"}
        Cancel anytime. Prices shown in your local currency.
      </Low>
    </ScrollView>
  );
}
