import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { Dot, Low, Mono, Screen, Txt, mix } from "@/components/ui";
import { VOICES } from "@/constants/data";
import { PERSONAS } from "@/constants/personas";
import { useJudith, type Toggles } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

interface ToggleDef {
  key: keyof Toggles;
  icon: IconName;
  t: string;
  s: string;
}

const TOGGLE_DEFS: ToggleDef[] = [
  { key: "dueReminders", icon: "bell", t: "Due-date reminders", s: "Before every bill" },
  { key: "widget", icon: "grid", t: "Home-screen widget", s: "Next due bill at a glance" },
  { key: "watch", icon: "watch", t: "Apple Watch", s: "Glanceable on your wrist" },
  { key: "nudges", icon: "wallet", t: "Payment nudges", s: "Remind me to pay, not autopay" },
];

function IcoBox({
  name,
  size = 38,
  iconSize,
  color,
  borderColor,
}: {
  name: IconName;
  size?: number;
  iconSize: number;
  color: string;
  borderColor?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: borderColor ?? t.hair,
        backgroundColor: t.surface3,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={iconSize} color={color} />
    </View>
  );
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 46,
        height: 28,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: on ? t.accent : t.hair,
        backgroundColor: on ? t.accent : t.surface3,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#fff",
          transform: [{ translateX: on ? 18 : 0 }],
        }}
      />
    </Pressable>
  );
}

function VoiceLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontFamily: t.fonts.medium,
        fontSize: 13,
        color: t.txtMid,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        marginTop: 18,
        marginBottom: 10,
      }}
    >
      Voice{" "}
      <Text style={{ color: t.txtLow, textTransform: "none", letterSpacing: 0 }}>{children}</Text>
    </Text>
  );
}

function SettingsLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontFamily: t.fonts.medium,
        fontSize: 13,
        color: t.txtMid,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        marginTop: 18,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { persona, setPersona, voiceId, setVoice, toggles, setToggle, asksLeft, tier, theme, setTheme, restart, money } =
    useJudith();

  const subscribed = tier !== "free";
  const isPro = tier === "unlimited";

  const rowBase = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: t.hair,
    backgroundColor: t.surface2,
  };

  return (
    <Screen contentStyle={{ paddingTop: 8, paddingBottom: 24 }}>
      <Text
        style={{
          fontFamily: t.fonts.semibold,
          fontSize: 28,
          color: t.txtHi,
          letterSpacing: -0.56,
          marginTop: 6,
          marginBottom: 14,
        }}
      >
        Settings
      </Text>

      {/* plan */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderWidth: 1,
          borderColor: mix(t.accent, t.surface2, 0.3),
          borderRadius: t.radius.md,
          backgroundColor: mix(t.accent, t.surface2, 0.14),
          padding: t.space.pad,
        }}
      >
        <IcoBox
          name="star"
          size={44}
          iconSize={20}
          color={t.accent}
          borderColor={mix(t.accent, t.surface2, 0.4)}
        />
        <View style={{ flex: 1 }}>
          <Txt size={14} weight="semibold">
            Judith Premium
          </Txt>
          <Low size={12}>
            <Mono size={12}>{money(199)}</Mono> · Lifetime · Active
          </Low>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Dot kind="ok" />
          <Txt size={12} color={t.semantic.ok}>
            Active
          </Txt>
        </View>
      </View>

      {/* asks */}
      <Pressable
        onPress={() => router.push("/plans")}
        style={({ pressed }) => [
          { ...rowBase, borderRadius: t.radius.md, marginTop: 12 },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <IcoBox name={subscribed ? "star" : "spark"} iconSize={18} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium">
            {subscribed ? (isPro ? "Judith Unlimited" : "Judith+") : "Ask Judith"}
          </Txt>
          <Low size={12} style={{ marginTop: 1 }}>
            {subscribed ? (
              isPro ? (
                <>
                  Unlimited asks · <Mono size={12}>{money(199)}</Mono>/mo
                </>
              ) : (
                <>
                  <Mono size={12}>{asksLeft}</Mono> of 50 asks left · <Mono size={12}>{money(99)}</Mono>/mo
                </>
              )
            ) : (
              <>
                <Mono size={12}>{asksLeft}</Mono> free asks left
              </>
            )}
          </Low>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 20,
            paddingVertical: 6,
            paddingHorizontal: 12,
          }}
        >
          <Text style={{ fontFamily: t.fonts.bold, fontSize: 13, color: t.accent }}>
            {subscribed ? (isPro ? "Manage" : "Upgrade") : "Go unlimited"}
          </Text>
        </View>
      </Pressable>

      {/* appearance */}
      <SettingsLabel>Appearance</SettingsLabel>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {(["dark", "light"] as const).map((mode) => {
          const on = theme === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setTheme(mode)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                padding: 16,
                borderRadius: t.radius.md,
                borderWidth: 1,
                borderColor: on ? t.accent : t.hair,
                backgroundColor: t.surface2,
              }}
            >
              <Icon name={mode === "dark" ? "moon" : "sun"} size={17} color={on ? t.txtHi : t.txtMid} />
              <Text style={{ fontFamily: t.fonts.semibold, fontSize: 15, color: on ? t.txtHi : t.txtMid }}>
                {mode === "dark" ? "Dark" : "Light"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* persona */}
      <SettingsLabel>Judith's personality</SettingsLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        {PERSONAS.map((p, i) => {
          const on = persona === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPersona(p.id)}
              style={{ ...rowBase, borderTopWidth: i === 0 ? 1 : 0, borderBottomWidth: 0 }}
            >
              <IcoBox name={p.icon as IconName} iconSize={17} color={on ? t.accent : t.txtMid} />
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="medium">
                  {p.name}
                </Txt>
                <Low size={12} style={{ marginTop: 1 }}>
                  {p.vibe}
                </Low>
              </View>
              {on ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />}
            </Pressable>
          );
        })}
      </View>

      {/* voice */}
      <VoiceLabel>· powered by ElevenLabs</VoiceLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        {VOICES.map((v, i) => {
          const on = voiceId === v.id;
          return (
            <Pressable
              key={v.id}
              onPress={() => setVoice(v.id)}
              style={{ ...rowBase, borderTopWidth: i === 0 ? 1 : 0, borderBottomWidth: 0 }}
            >
              <IcoBox name="play" iconSize={15} color={on ? t.accent : t.txtMid} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Txt size={15} weight="medium">
                    {v.name}
                  </Txt>
                  {v.tag && (
                    <View
                      style={{
                        marginLeft: 4,
                        borderWidth: 1,
                        borderColor: t.accent,
                        borderRadius: 22,
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                        backgroundColor: mix(t.accent, t.surface2, 0.16),
                      }}
                    >
                      <Text style={{ fontFamily: t.fonts.regular, fontSize: 9, color: t.txtHi }}>{v.tag}</Text>
                    </View>
                  )}
                </View>
                <Low size={12} style={{ marginTop: 1 }}>
                  {v.desc}
                </Low>
              </View>
              {on ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />}
            </Pressable>
          );
        })}
      </View>
      <Low size={12} style={{ marginTop: 8, lineHeight: 17 }}>
        Judith always speaks in English, in the voice you choose — even when your bills are local.
      </Low>

      {/* reminders */}
      <SettingsLabel>Reminders & devices</SettingsLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        {TOGGLE_DEFS.map((d, i) => {
          const on = toggles[d.key];
          return (
            <View key={d.key} style={{ ...rowBase, borderTopWidth: i === 0 ? 1 : 0, borderBottomWidth: 0 }}>
              <IcoBox name={d.icon} iconSize={17} color={on ? t.accent : t.txtMid} />
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="medium">
                  {d.t}
                </Txt>
                <Low size={12} style={{ marginTop: 1 }}>
                  {d.s}
                </Low>
              </View>
              <Toggle on={on} onPress={() => setToggle(d.key, !on)} />
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push("/devices")}
        style={({ pressed }) => [
          { ...rowBase, borderRadius: t.radius.md, marginTop: 9 },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <IcoBox name="watch" iconSize={17} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium">
            Preview on your devices
          </Txt>
          <Low size={12} style={{ marginTop: 1 }}>
            Widgets & Apple Watch concepts
          </Low>
        </View>
        <Icon name="chev" size={16} color={t.txtMid} />
      </Pressable>

      <View style={{ alignItems: "center", marginTop: 22 }}>
        <Low size={12}>Judith v1.0 · Made for the Philippines</Low>
        <Pressable onPress={restart} style={{ marginTop: 6 }}>
          <Low size={12}>Restart demo</Low>
        </Pressable>
      </View>
    </Screen>
  );
}
