import { Stack, useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Low, Mono, Screen, Txt, mix } from "@/components/ui";
import { useJudithSelect } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { safeBack } from "@/lib/navigation";

/**
 * Home-screen widget — install + showcase route.
 *
 * Replaces the previous cosmetic "Home-screen widget" toggle in Settings
 * (which never gated anything — see lib/watch.ts:166-169 unconditionally
 * pushes payloads via JudithWidgetBridge.writePayload).
 *
 * iOS does NOT let an app programmatically add its own widget to the home
 * screen. The user has to do it via Apple's system flow (long-press →
 * "+" → search → add). The most we can do is render an accurate preview
 * of the widget, walk the user through the steps, and reload the widget
 * timeline so any existing widget refreshes immediately.
 *
 * We deliberately avoid `exit(0)` / forced backgrounding — Apple's HIG
 * discourages it, and a clear instruction list is enough.
 */

// Mock data drives the preview so the user sees a faithful Judith widget
// regardless of the actual bill state. Keep the values realistic — large
// enough to demonstrate the mono-font headline, small enough to look like
// a real first user's bill.
const PREVIEW = {
  provider: "Electricity",
  totalOwed: 2400,
  amount: 1450,
  dueLabel: "3d",
  unpaidCount: 4,
};

function WidgetPreviewSmall({ persona }: { persona: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        // Match Apple's small-widget aspect (square-ish) at preview size.
        width: 168,
        height: 168,
        borderRadius: 22,
        padding: 14,
        backgroundColor: "#181b22", // surface1 — exact match with SwiftUI side
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Subtle accent blob — matches the SwiftUI WidgetCardBackground
          decorative circles (offset off-screen for soft gradient effect). */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -50,
          top: -50,
          width: 130,
          height: 130,
          borderRadius: 130,
          backgroundColor: t.accent,
          opacity: 0.08,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -40,
          bottom: -40,
          width: 110,
          height: 110,
          borderRadius: 110,
          backgroundColor: t.accent,
          opacity: 0.14,
        }}
      />

      {/* Header row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 }}>
        <JudithAvatar persona={persona as never} size={18} state="idle" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: t.fonts.bold, fontSize: 8, color: t.accent, letterSpacing: 1.4 }}>
            JUDITH
          </Text>
          <Text style={{ fontFamily: t.fonts.medium, fontSize: 7, color: "#6a7180" }}>
            Bill tracker
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Text style={{ fontFamily: t.fonts.bold, fontSize: 9, color: "#f3f5f8" }}>
            {PREVIEW.unpaidCount}
          </Text>
        </View>
      </View>

      {/* DUE THIS MONTH kicker */}
      <Text style={{ fontFamily: t.fonts.bold, fontSize: 8, color: "#6a7180", letterSpacing: 0.8, marginBottom: 4 }}>
        DUE THIS MONTH
      </Text>

      {/* Big mono total */}
      <Mono size={24} weight="bold" color="#f3f5f8" style={{ marginBottom: 6 }}>
        ₱{PREVIEW.totalOwed.toLocaleString()}
      </Mono>

      {/* Provider in accent */}
      <Text style={{ fontFamily: t.fonts.bold, fontSize: 12, color: t.accent, marginBottom: 4 }}>
        {PREVIEW.provider}
      </Text>

      {/* Due badge + amount */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 5,
            backgroundColor: "rgba(255,100,95,0.15)",
            borderWidth: 0.5,
            borderColor: "rgba(255,100,95,0.35)",
          }}
        >
          <Text style={{ fontFamily: t.fonts.bold, fontSize: 8, color: t.semantic.urgent }}>
            {PREVIEW.dueLabel.toUpperCase()}
          </Text>
        </View>
        <Mono size={10} weight="bold" color={t.semantic.urgent}>
          ₱{PREVIEW.amount.toLocaleString()}
        </Mono>
      </View>

      {/* Status line — pinned to bottom */}
      <View
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          right: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: t.semantic.urgent }} />
        <Text style={{ fontFamily: t.fonts.medium, fontSize: 9, color: "#a7adba" }}>
          Next: {PREVIEW.dueLabel}
        </Text>
      </View>
    </View>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mix(t.accent, t.surface3, 0.18),
          borderWidth: 1,
          borderColor: mix(t.accent, t.surface2, 0.4),
        }}
      >
        <Text style={{ fontFamily: t.fonts.bold, fontSize: 12, color: t.accent }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="semibold">{title}</Txt>
        <Low size={12} style={{ marginTop: 2, lineHeight: 17 }}>{body}</Low>
      </View>
    </View>
  );
}

export default function WidgetScreen() {
  const t = useTheme();
  const router = useRouter();
  // Subscribe ONLY to the persona slice so the preview reflects the user's
  // selection. No other state needed on this screen.
  const persona = useJudithSelect((s) => s.persona);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <Screen contentStyle={{ paddingBottom: 28 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4, paddingBottom: 8 }}>
          <Pressable
            onPress={() => safeBack(router)}
            hitSlop={10}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.surface2,
              borderWidth: 1,
              borderColor: t.hair,
            }}
          >
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <Icon name="chev" size={16} color={t.txtHi} />
            </View>
          </Pressable>
          <Text
            style={{
              fontFamily: t.fonts.semibold,
              fontSize: 22,
              color: t.txtHi,
              letterSpacing: -0.4,
              flex: 1,
            }}
          >
            Home-screen widget
          </Text>
        </View>

        {/* Hero: tilted preview on a soft accent-lit canvas */}
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 28,
            marginBottom: 12,
            borderRadius: 22,
            backgroundColor: mix(t.accent, t.surface2, 0.06),
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.18),
          }}
        >
          <WidgetPreviewSmall persona={persona} />
          <Low size={11} style={{ marginTop: 14, textAlign: "center" }}>
            Live preview — your real bills will appear here.
          </Low>
        </View>

        {/* Headline */}
        <Text
          style={{
            fontFamily: t.fonts.semibold,
            fontSize: 22,
            color: t.txtHi,
            letterSpacing: -0.4,
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          Add Judith to your Home Screen
        </Text>
        <Low size={13} style={{ marginBottom: 12, lineHeight: 19 }}>
          Glance at your next due bill without opening the app. The widget
          updates automatically every time you mark something paid.
        </Low>

        {/* Steps */}
        <View
          style={{
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.hair,
            backgroundColor: t.surface2,
            paddingVertical: 6,
            paddingHorizontal: 14,
            marginTop: 8,
          }}
        >
          <Step
            n={1}
            title="Go to your Home Screen"
            body="Press the Home button or swipe up from the bottom edge of your screen to leave this app."
          />
          <View style={{ height: 1, backgroundColor: t.hair, marginLeft: 38 }} />
          <Step
            n={2}
            title="Touch and hold any empty area"
            body="Keep holding until the app icons begin to jiggle."
          />
          <View style={{ height: 1, backgroundColor: t.hair, marginLeft: 38 }} />
          <Step
            n={3}
            title='Tap "+" in the top-left'
            body="The widget gallery opens. Search for Judith and pick a size (small, medium, or large)."
          />
          <View style={{ height: 1, backgroundColor: t.hair, marginLeft: 38 }} />
          <Step
            n={4}
            title='Tap "Add Widget", then Done'
            body="Your widget lands on the Home Screen. It'll fill in within a few seconds with your real bills."
          />
        </View>

        {/* Lock Screen widget — same flow note */}
        <View
          style={{
            marginTop: 16,
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.hair,
            backgroundColor: t.surface2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Icon name="lock" size={15} color={t.accent} />
            <Txt size={14} weight="semibold">Want it on your Lock Screen too?</Txt>
          </View>
          <Low size={12} style={{ lineHeight: 17 }}>
            Long-press the Lock Screen, tap <Low size={12} weight="medium" color={t.txtHi}>Customize</Low>, choose <Low size={12} weight="medium" color={t.txtHi}>Lock Screen</Low>, then tap the widget area and pick Judith.
          </Low>
        </View>

        {/* Got-it CTA */}
        <Pressable
          onPress={() => safeBack(router)}
          style={({ pressed }) => [
            {
              marginTop: 22,
              alignItems: "center",
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: t.accent,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text
            style={{
              fontFamily: t.fonts.bold,
              fontSize: 15,
              color: t.onAccent,
              letterSpacing: -0.2,
            }}
          >
            Got it
          </Text>
        </Pressable>

        {/* Already-added hint */}
        <Low size={11} style={{ marginTop: 12, textAlign: "center", lineHeight: 16 }}>
          Already added it? The widget auto-updates as bills change — no extra steps needed.
        </Low>
      </Screen>
    </>
  );
}
