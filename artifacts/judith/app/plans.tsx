import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Low, Mono, Txt, mix } from "@/components/ui";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { getTierPackages, purchaseForTier, type TierPackages } from "@/lib/purchases";
import type { PurchasesPackage } from "react-native-purchases";

/* ---- thin separator ---- */
function Sep() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.hair, marginVertical: 2 }} />;
}

/* ---- math row ---- */
function MathRow({
  label,
  value,
  color,
  sub,
  large,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
  large?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 }}>
      <View style={{ flex: 1 }}>
        <Txt size={large ? 14 : 13} weight={large ? "semibold" : "regular"} color={t.txtMid}>
          {label}
        </Txt>
        {sub && <Low size={11} style={{ marginTop: 2 }}>{sub}</Low>}
      </View>
      <Mono size={large ? 17 : 15} weight="bold" color={color}>
        {value}
      </Mono>
    </View>
  );
}

/* ---- outcome / relief row ---- */
function Relief({ icon, headline, body }: { icon: IconName; headline: string; body: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, borderWidth: 1, borderColor: t.hair, borderRadius: 16, backgroundColor: t.surface2, padding: 16 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: mix(t.accent, t.surface2, 0.14),
        borderWidth: 1, borderColor: mix(t.accent, t.surface2, 0.3),
        alignItems: "center", justifyContent: "center", marginTop: 1,
      }}>
        <Icon name={icon} size={16} color={t.accent} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt size={14} weight="semibold">{headline}</Txt>
        <Low size={12} style={{ lineHeight: 18 }}>{body}</Low>
      </View>
    </View>
  );
}

/* ---- feature line ---- */
function Feature({ text, accent }: { text: string; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ marginTop: 2 }}>
        <Icon name="check" size={14} color={accent ? t.accent : t.semantic.ok} />
      </View>
      <Low size={13} style={{ flex: 1, lineHeight: 19 }}>{text}</Low>
    </View>
  );
}

/* ---- main CTA button ---- */
function CtaBtn({
  label,
  sub,
  loading,
  disabled,
  primary,
  onPress,
}: {
  label: string;
  sub?: string;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          paddingVertical: 16,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 56,
          backgroundColor: disabled
            ? t.surface3
            : primary
              ? t.accent
              : mix(t.accent, t.surface2, 0.2),
          borderWidth: disabled ? 1 : 0,
          borderColor: t.hair,
          gap: 2,
        }}
      >
        {loading ? (
          <ActivityIndicator color={primary ? t.onAccent : t.accent} size="small" />
        ) : (
          <>
            <Txt
              size={15}
              weight="semibold"
              color={disabled ? t.txtMid : primary ? t.onAccent : t.accent}
            >
              {label}
            </Txt>
            {sub && !disabled && (
              <Low
                size={11}
                style={{ color: primary ? t.onAccent + "aa" : t.txtLow }}
              >
                {sub}
              </Low>
            )}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function PlansModal() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { asksLeft, tier, persona, money, subscribe, showToast } = useJudith();

  const [packages, setPackages] = useState<TierPackages>({ chat: null, voice: null });
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [buyingTier, setBuyingTier] = useState<"chat" | "voice" | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const voiceCardY = useRef<number>(0);

  /* hero fade-in */
  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOp, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(heroY, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getTierPackages()
      .then(setPackages)
      .finally(() => setLoadingPkgs(false));
  }, []);

  useEffect(() => {
    if (focus !== "voice") return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: voiceCardY.current, animated: true });
    }, 300);
    return () => clearTimeout(id);
  }, [focus, loadingPkgs]);

  const buy = async (targetTier: "chat" | "voice", pkg: PurchasesPackage | null) => {
    if (!pkg) {
      subscribe(targetTier);
      showToast(targetTier === "chat" ? "Chat Ask activated ✓" : "Voice Ask activated ✓");
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
  const isFree = tier === "free";

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: t.canvas }}
      contentContainerStyle={{
        paddingHorizontal: 22,
        paddingTop: Math.max(insets.top, 44) + 10,
        paddingBottom: insets.bottom + 48,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* close */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 24 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hair,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="x" size={15} color={t.txtMid} />
        </Pressable>
      </View>

      {/* ── HERO ── */}
      <Animated.View
        style={{ opacity: heroOp, transform: [{ translateY: heroY }], alignItems: "center", marginBottom: 32 }}
      >
        <JudithAvatar persona={persona} size={64} state="idle" />
        <View style={{ marginTop: 18, alignItems: "center", gap: 10 }}>
          <Txt
            size={27}
            weight="semibold"
            style={{ textAlign: "center", lineHeight: 34, letterSpacing: -0.5 }}
          >
            {money(99)}/month.{"\n"}Less than one late fee.
          </Txt>
          <Low size={13} style={{ textAlign: "center", lineHeight: 20 }}>
            Globe suspends your line at Day 30. BDO charges{"\n"}
            ₱750 automatically. Meralco disconnects without{"\n"}
            mercy. Judith costs less than any of that.
          </Low>
        </View>
      </Animated.View>

      {/* ── MATH CARD: 1 month of fees vs 1 month of Judith ── */}
      <View
        style={{
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: 18,
          backgroundColor: t.surface1,
          paddingHorizontal: 18,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        {/* section label */}
        <View style={{ paddingTop: 14, paddingBottom: 6 }}>
          <Low size={10} style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
            One bad month, without Judith
          </Low>
        </View>
        <MathRow
          label="Credit card late fee"
          sub="BPI, BDO, Security Bank — automatic, no grace"
          value="₱750"
          color={t.semantic.urgent}
        />
        <Sep />
        <MathRow
          label="Postpaid reconnection fee"
          sub="Globe, Smart, PLDT — charged when line is cut"
          value="₱200"
          color={t.semantic.urgent}
        />
        <Sep />
        <MathRow
          label="Meralco reconnection"
          sub="Service interruption after 30-day overdue"
          value="₱150"
          color={t.semantic.urgent}
        />
        <Sep />
        <MathRow
          label="Total risk, one bad month"
          value="₱1,100"
          color={t.semantic.urgent}
          large
        />

        {/* divider */}
        <View style={{ height: 1, backgroundColor: mix(t.accent, t.surface2, 0.3), marginVertical: 6 }} />

        <MathRow
          label="Judith — all your bills, all month"
          sub="Every due date tracked, every bill reminded"
          value={money(99)}
          color={t.semantic.ok}
          large
        />
        <Sep />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
          <Icon name="trend" size={16} color={t.accent} />
          <Low size={12} style={{ flex: 1, lineHeight: 17 }}>
            One avoided late fee and Judith pays for itself for the{" "}
            <Txt size={12} weight="semibold" color={t.accent}>entire year.</Txt>
          </Low>
        </View>
      </View>

      {/* ── WHAT YOU ACTUALLY GET (emotional) ── */}
      <View style={{ gap: 10, marginBottom: 28 }}>
        <Relief
          icon="bell"
          headline="No service cutoffs"
          body="Globe and PLDT suspend at Day 30. Meralco sends a disconnection notice at Day 28. Judith nudges you days before it ever reaches that point."
        />
        <Relief
          icon="card"
          headline="No surprise late charges"
          body="Credit card fees hit automatically — no call, no warning, just ₱750 gone. Judith shows every due date clearly, weeks in advance."
        />
        <Relief
          icon="sliders"
          headline="Finally in control"
          body="No more keeping five due dates in your head or panicking mid-month. Every bill tracked. Every cycle clear. Judith holds it all so you don't have to."
        />
      </View>

      {/* ── FREE ASKS NOTICE ── */}
      {isFree && asksLeft > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 14,
            backgroundColor: t.surface2,
            paddingVertical: 11,
            paddingHorizontal: 14,
            marginBottom: 20,
          }}
        >
          <Icon name="spark" size={15} color={t.accent} />
          <Low size={13} style={{ flex: 1 }}>
            You have{" "}
            <Mono size={13} weight="bold" color={t.txtHi}>{asksLeft}</Mono>
            {" "}free ask{asksLeft !== 1 ? "s" : ""} left. Subscribe for unlimited.
          </Low>
        </View>
      )}

      {/* ── PLAN CARDS ── */}
      {loadingPkgs ? (
        <View style={{ alignItems: "center", paddingVertical: 48 }}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {/* VOICE CARD — hero */}
          <View onLayout={(e) => { voiceCardY.current = e.nativeEvent.layout.y; }}>
            <View
              style={{
                borderWidth: 1.5,
                borderColor: mix(t.accent, t.surface2, 0.35),
                borderRadius: 20,
                backgroundColor: mix(t.accent, t.canvas, 0.06),
                overflow: "hidden",
              }}
            >
              {!voiceActive && (
                <View style={{ backgroundColor: t.accent, paddingVertical: 6, alignItems: "center" }}>
                  <Txt size={11} weight="semibold" color={t.onAccent} style={{ letterSpacing: 0.8 }}>
                    MOST POPULAR
                  </Txt>
                </View>
              )}
              <View style={{ padding: 20, gap: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View>
                    <Txt size={18} weight="semibold">Voice Ask</Txt>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                      <Mono size={28} weight="bold" color={t.accent}>{money(199)}</Mono>
                      <Low size={12}>/mo</Low>
                    </View>
                    <Low size={11} style={{ marginTop: 2 }}>Cancel anytime</Low>
                  </View>
                  {voiceActive && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: mix(t.semantic.ok, t.surface2, 0.4), borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11, backgroundColor: mix(t.semantic.ok, t.surface2, 0.12) }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.semantic.ok }} />
                      <Txt size={11} weight="semibold" color={t.semantic.ok}>Active</Txt>
                    </View>
                  )}
                </View>
                <View style={{ gap: 10 }}>
                  <Feature text="Talk to Judith — speak your question, hear her answer" accent />
                  <Feature text="Voice replies in Tagalog, English, Bisaya, or any language you set" accent />
                  <Feature text="Unlimited text + voice asks, all 5 personas" />
                  <Feature text="Bill tracking, reminders, and calendar — all included" />
                </View>
                <CtaBtn
                  label={voiceActive ? "Current plan" : "Get Voice Ask"}
                  sub={voiceActive ? undefined : money(199) + "/month · cancel anytime"}
                  primary={!voiceActive}
                  disabled={voiceActive}
                  loading={buyingTier === "voice"}
                  onPress={() => buy("voice", packages.voice)}
                />
              </View>
            </View>
          </View>

          {/* CHAT CARD */}
          <View
            style={{
              borderWidth: 1,
              borderColor: chatActive && !voiceActive ? mix(t.accent, t.surface2, 0.3) : t.hair,
              borderRadius: 20,
              backgroundColor: t.surface1,
              overflow: "hidden",
            }}
          >
            <View style={{ padding: 20, gap: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View>
                  <Txt size={17} weight="semibold">Chat Ask</Txt>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                    <Mono size={26} weight="bold" color={chatActive && !voiceActive ? t.accent : t.txtHi}>
                      {money(99)}
                    </Mono>
                    <Low size={12}>/mo</Low>
                  </View>
                  <Low size={11} style={{ marginTop: 2 }}>Cancel anytime</Low>
                </View>
                {chatActive && !voiceActive && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: mix(t.semantic.ok, t.surface2, 0.4), borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11, backgroundColor: mix(t.semantic.ok, t.surface2, 0.12) }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.semantic.ok }} />
                    <Txt size={11} weight="semibold" color={t.semantic.ok}>Active</Txt>
                  </View>
                )}
              </View>
              <View style={{ gap: 10 }}>
                <Feature text="Unlimited text asks to Judith — type anything, get a real answer" />
                <Feature text="Bill tracking, reminders, and calendar" />
                <Feature text="All 5 personas — mama, Marites, ate, and more" />
              </View>
              <CtaBtn
                label={chatActive ? "Current plan" : "Get Chat Ask"}
                sub={chatActive ? undefined : money(99) + "/month · cancel anytime"}
                primary={false}
                disabled={chatActive}
                loading={buyingTier === "chat"}
                onPress={() => buy("chat", packages.chat)}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── TRUST FOOTER ── */}
      <View style={{ marginTop: 28, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
          {[
            { icon: "lock" as const, label: "Secure" },
            { icon: "refresh" as const, label: "Cancel anytime" },
            { icon: "star" as const, label: "No hidden fees" },
          ].map((item) => (
            <View key={item.label} style={{ alignItems: "center", gap: 5 }}>
              <Icon name={item.icon} size={16} color={t.txtLow} />
              <Low size={10}>{item.label}</Low>
            </View>
          ))}
        </View>
        <Low size={11} style={{ textAlign: "center", lineHeight: 16, marginTop: 4 }}>
          Managed by the App Store / Google Play.{"\n"}
          Prices shown in your local currency.
        </Low>
      </View>
    </ScrollView>
  );
}
