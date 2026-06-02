import { useRouter } from "expo-router";
import React from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { Dot, Low, Mono, Screen, Txt, mix } from "@/components/ui";
import { PERSONAS } from "@/constants/personas";
import { useAuth } from "@/contexts/AuthContext";
import { useJudith, type Toggles } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

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
  const { persona, setPersona, toggles, setToggle, reduceMotion, setReduceMotion, asksLeft, tier, theme, setTheme, restart, money, bills, name, guest } =
    useJudith();
  const { user } = useAuth();
  const email = user?.email ?? (guest ? "Guest account" : "—");

  const subscribed = tier !== "free";
  const isPro = tier === "unlimited";

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const canRestart = confirmText.trim().toLowerCase() === "restart";

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
  };
  const doRestart = () => {
    if (!canRestart) return;
    closeConfirm();
    restart();
  };

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
    <Screen contentStyle={{ paddingBottom: 24 }}>
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

      {/* account */}
      <Pressable
        onPress={() => router.push("/account")}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: t.radius.md,
            backgroundColor: t.surface2,
            padding: t.space.pad,
            marginBottom: 12,
          },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mix(t.accent, t.surface3, 0.18),
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.4),
          }}
        >
          <Text style={{ fontFamily: t.fonts.bold, fontSize: 16, color: t.accent }}>
            {initialsOf(name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="semibold">
            {name || "Your account"}
          </Txt>
          <Low size={12} style={{ marginTop: 1 }}>
            {email}
          </Low>
        </View>
        <Icon name="chev" size={16} color={t.txtMid} />
      </Pressable>

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

      {/* accessibility */}
      <SettingsLabel>Accessibility</SettingsLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        <View style={{ ...rowBase, borderTopWidth: 1, borderBottomWidth: 0 }}>
          <IcoBox name="sliders" iconSize={17} color={reduceMotion ? t.accent : t.txtMid} />
          <View style={{ flex: 1 }}>
            <Txt size={15} weight="medium">
              Reduce motion
            </Txt>
            <Low size={12} style={{ marginTop: 1 }}>
              Calm the animations — instant transitions
            </Low>
          </View>
          <Toggle on={reduceMotion} onPress={() => setReduceMotion(!reduceMotion)} />
        </View>
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
        <Pressable onPress={() => setConfirmOpen(true)} style={{ marginTop: 6 }}>
          <Low size={12}>Restart demo</Low>
        </Pressable>
      </View>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
        statusBarTranslucent
      >
        <Pressable
          onPress={closeConfirm}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
            padding: 26,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: t.hair,
              backgroundColor: t.surface2,
              padding: 22,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix("#ff645f", t.surface2, 0.16),
                borderWidth: 1,
                borderColor: mix("#ff645f", t.surface2, 0.4),
                marginBottom: 14,
              }}
            >
              <Icon name="bell" size={22} color="#ff645f" />
            </View>

            <Text
              style={{
                fontFamily: t.fonts.semibold,
                fontSize: 19,
                color: t.txtHi,
                letterSpacing: -0.3,
                marginBottom: 8,
              }}
            >
              Restart from scratch?
            </Text>

            <Low size={13} style={{ lineHeight: 19 }}>
              This permanently deletes{" "}
              <Low size={13} weight="medium" color={t.txtHi}>
                all {bills.length} of your bill records
              </Low>{" "}
              and resets every setting, so you can start a brand-new
              onboarding. This can&rsquo;t be undone.
            </Low>

            <Low size={12} style={{ marginTop: 16, marginBottom: 7 }}>
              Type{" "}
              <Low size={12} weight="medium" color={t.txtHi}>
                restart
              </Low>{" "}
              to confirm
            </Low>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="restart"
              placeholderTextColor={t.txtLow}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                fontFamily: t.fonts.medium,
                fontSize: 15,
                color: t.txtHi,
                borderWidth: 1,
                borderColor: canRestart ? "#ff645f" : t.hair,
                backgroundColor: t.surface3,
                borderRadius: 11,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={closeConfirm}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 13,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: t.hair,
                  backgroundColor: t.surface3,
                }}
              >
                <Txt size={14} weight="medium">
                  Cancel
                </Txt>
              </Pressable>
              <Pressable
                onPress={doRestart}
                disabled={!canRestart}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 13,
                  borderRadius: 11,
                  backgroundColor: canRestart ? "#ff645f" : mix("#ff645f", t.surface2, 0.3),
                  opacity: canRestart ? 1 : 0.5,
                }}
              >
                <Txt size={14} weight="semibold" color="#ffffff">
                  Delete & restart
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
