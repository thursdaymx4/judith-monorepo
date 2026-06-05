import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

import * as Notifications from "expo-notifications";
import { Icon, type IconName } from "@/components/Icon";
import { Dot, Low, Mono, Screen, Txt, mix } from "@/components/ui";
import { LANGUAGES, langDesc, languageByCode } from "@/constants/languages";
import { PERSONAS } from "@/constants/personas";
import { useAuth } from "@/contexts/AuthContext";
import { useJudith, type Toggles } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { requestPermission } from "@/lib/notifications";
import { PRIVACY_URL, TERMS_URL, openLegal } from "@/constants/legal";

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
  const { persona, setPersona, language, setLanguage, toggles, setToggle, reduceMotion, setReduceMotion, asksLeft, tier, theme, setTheme, restart, money, bills, name, guest, country } =
    useJudith();
  const { user } = useAuth();
  const email = user?.email ?? (guest ? "Guest account" : "—");

  const subscribed = tier !== "free";

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const canRestart = confirmText.trim().toLowerCase() === "restart";

  const [langOpen, setLangOpen] = React.useState(false);
  const [langQ, setLangQ] = React.useState("");
  const [langExpanded, setLangExpanded] = React.useState<string | null>(null);

  const currentLangDisplay = React.useMemo(() => {
    for (const l of LANGUAGES) {
      if (l.code === language && !l.dialects?.length) return { flag: l.flag, native: l.native };
      const d = (l.dialects ?? []).find((d) => d.code === language);
      if (d) return { flag: l.flag, native: d.native };
      if (l.code === language) return { flag: l.flag, native: l.native };
    }
    return { flag: "🇬🇧", native: "English" };
  }, [language]);

  const langQuery = langQ.trim().toLowerCase();
  const langList = LANGUAGES.filter((l) => {
    if (!langQuery) return true;
    if (l.label.toLowerCase().includes(langQuery) || l.native.toLowerCase().includes(langQuery)) return true;
    return (l.dialects ?? []).some((d) => d.label.toLowerCase().includes(langQuery) || d.native.toLowerCase().includes(langQuery));
  });

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
  };
  const doRestart = () => {
    if (!canRestart) return;
    closeConfirm();
    restart();
  };

  const handleShare = useCallback(async () => {
    await Share.share({
      title: "Track your bills with Judith",
      message:
        "Hey! I\u2019ve been using Judith to stay on top of all my bills \u2014 it reminds me before every due date so I never miss a payment. You should try it! \ud83d\udcf1\nhttps://judith.app",
    });
  }, []);

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
            {tier === "voice" ? "Voice Ask" : tier === "chat" ? "Chat Ask" : "Ask Judith"}
          </Txt>
          <Low size={12}>
            {subscribed
              ? <>{tier === "voice" ? <Mono size={12}>{money(199)}</Mono> : <Mono size={12}>{money(99)}</Mono>} · Monthly · Active</>
              : <>8 free asks included</>}
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
            {tier === "voice" ? "Voice Ask" : tier === "chat" ? "Chat Ask" : "Ask Judith"}
          </Txt>
          <Low size={12} style={{ marginTop: 1 }}>
            {tier === "voice" ? (
              <>Unlimited text & voice asks · <Mono size={12}>{money(199)}</Mono>/mo</>
            ) : tier === "chat" ? (
              <>Unlimited text asks · <Mono size={12}>{money(99)}</Mono>/mo</>
            ) : (
              <><Mono size={12}>{asksLeft}</Mono> free asks left</>
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
            {tier === "voice" ? "Manage" : tier === "chat" ? "Upgrade" : "Get a plan"}
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

      {/* voice language */}
      <SettingsLabel>Voice language</SettingsLabel>
      <Pressable
        onPress={() => { setLangQ(""); setLangExpanded(null); setLangOpen(true); }}
        style={({ pressed }) => [
          { ...rowBase, borderRadius: t.radius.md },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <IcoBox name="mic" iconSize={17} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium">{currentLangDisplay.native}</Txt>
          <Low size={12} style={{ marginTop: 1 }}>Judith's spoken language</Low>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 22 }}>{currentLangDisplay.flag}</Text>
          <Icon name="chev" size={16} color={t.txtMid} />
        </View>
      </Pressable>

      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <Pressable onPress={() => setLangOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: t.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: t.hair, maxHeight: "85%", paddingBottom: 34 }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.hair2, marginTop: 12, marginBottom: 14 }} />
            <View style={{ paddingHorizontal: 18 }}>
              <Txt size={18} weight="semibold" style={{ marginBottom: 12 }}>Judith's voice language</Txt>
              <TextInput
                value={langQ}
                onChangeText={setLangQ}
                placeholder="Search languages…"
                placeholderTextColor={t.txtLow}
                style={{
                  borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2,
                  borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14,
                  color: t.txtHi, fontFamily: t.fonts.regular, fontSize: 14, marginBottom: 12,
                }}
              />
            </View>
            <ScrollView style={{ paddingHorizontal: 18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 12 }}>
              {langList.map((l) => {
                const hasDialects = !!l.dialects?.length;
                const isDialectActive = (l.dialects ?? []).some((d) => d.code === language);
                const isActive = language === l.code || isDialectActive;
                const isOpen = langExpanded === l.code || (hasDialects && isDialectActive);
                return (
                  <View key={l.code} style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        if (hasDialects) {
                          setLangExpanded(isOpen ? null : l.code);
                        } else {
                          setLanguage(l.code);
                          setLangOpen(false);
                        }
                      }}
                      style={({ pressed }) => ({
                        flexDirection: "row", alignItems: "center", gap: 12,
                        paddingVertical: 13, paddingHorizontal: 14,
                        borderRadius: 12, borderWidth: 1,
                        borderColor: isActive ? t.accent : t.hair,
                        backgroundColor: isActive ? mix(t.accent, t.surface2, 0.12) : t.surface2,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 24 }}>{l.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Txt size={14} weight="medium">{l.native}</Txt>
                        <Low size={12} style={{ marginTop: 2 }}>{langDesc(l.code)}</Low>
                      </View>
                      {hasDialects
                        ? <View style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}><Icon name="chev" size={16} color={t.txtLow} /></View>
                        : isActive ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />
                      }
                    </Pressable>
                    {hasDialects && isOpen && (
                      <View style={{ gap: 8, marginLeft: 18 }}>
                        {l.dialects!.map((d) => {
                          const don = language === d.code;
                          return (
                            <Pressable
                              key={d.code}
                              onPress={() => { setLanguage(d.code); setLangOpen(false); }}
                              style={({ pressed }) => ({
                                flexDirection: "row", alignItems: "center", gap: 12,
                                paddingVertical: 12, paddingHorizontal: 14,
                                borderRadius: 12, borderWidth: 1,
                                borderColor: don ? t.accent : t.hair,
                                backgroundColor: don ? mix(t.accent, t.surface2, 0.12) : t.surface2,
                                opacity: pressed ? 0.85 : 1,
                              })}
                            >
                              <View style={{ flex: 1 }}>
                                <Txt size={13.5} weight="medium">{d.label}</Txt>
                                <Low size={12} style={{ marginTop: 2 }}>{d.native} · {d.desc}</Low>
                              </View>
                              {don ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* persona */}
      <SettingsLabel>Judith's personality</SettingsLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        {PERSONAS.filter(p => !p.phOnly || country.code === "PH").map((p, i) => {
          const on = persona === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPersona(p.id)}
              style={{ ...rowBase, borderTopWidth: i === 0 ? 1 : 0, borderBottomWidth: 0 }}
            >
              <IcoBox name={p.icon as IconName} iconSize={17} color={on ? t.accent : t.txtMid} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Txt size={15} weight="medium">{p.name}</Txt>
                  {p.phOnly && (
                    <View style={{
                      backgroundColor: "#f472b6",
                      borderRadius: 20,
                      paddingVertical: 2,
                      paddingHorizontal: 7,
                    }}>
                      <Txt size={10} weight="semibold" color="#fff">🇵🇭 PH only</Txt>
                    </View>
                  )}
                </View>
                <Low size={12} style={{ marginTop: 1 }}>
                  {p.vibe}
                </Low>
              </View>
              {on ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />}
            </Pressable>
          );
        })}
      </View>

      {/* voice — only for Voice Ask subscribers */}
      {tier === "voice" && (
        <>
          <SettingsLabel>Voice</SettingsLabel>
          <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
            <View style={{ ...rowBase, borderTopWidth: 1, borderBottomWidth: 0 }}>
              <IcoBox name={toggles.voiceReplies ? "volume" : "volumeOff"} iconSize={17} color={toggles.voiceReplies ? t.accent : t.txtMid} />
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="medium">
                  Speak answers aloud
                </Txt>
                <Low size={12} style={{ marginTop: 1 }}>
                  Turn off to get text-only replies in public
                </Low>
              </View>
              <Toggle on={toggles.voiceReplies} onPress={() => setToggle("voiceReplies", !toggles.voiceReplies)} />
            </View>
          </View>
        </>
      )}

      {/* reminders */}
      <SettingsLabel>Reminders & devices</SettingsLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        {TOGGLE_DEFS.map((d, i) => {
          const on = toggles[d.key];
          const needsPermission = d.key === "dueReminders" || d.key === "nudges";
          const handleToggle = async () => {
            const next = !on;
            if (next && needsPermission) {
              const granted = await requestPermission();
              if (!granted) return;
            }
            setToggle(d.key, next);
          };
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
              <Toggle on={on} onPress={handleToggle} />
            </View>
          );
        })}
      </View>

      {/* test notification */}
      <Pressable
        onPress={async () => {
          const granted = await requestPermission();
          if (!granted) return;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Test · ${persona === "funny" ? "Heads up 👀" : persona === "pro" ? "Reminder: you have bills." : persona === "mama" ? "Anak, test lang 👋" : persona === "marites" ? "Psst! Test notification 🤫" : "Test notification"}`,
              body: "Notifications are working! ₱2,500 due in 3 days.",
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, repeats: false },
          });
        }}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
            marginTop: 9,
            paddingVertical: 14,
            paddingHorizontal: 15,
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.4),
            borderRadius: t.radius.md,
            backgroundColor: mix(t.accent, t.surface2, 0.1),
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <IcoBox name="bell" iconSize={17} color={t.accent} borderColor={mix(t.accent, t.surface2, 0.4)} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium" color={t.accent}>Fire test notification</Txt>
          <Low size={12} style={{ marginTop: 1 }}>Fires in 3 seconds — lock your screen</Low>
        </View>
        <Icon name="chev" size={16} color={t.accent} />
      </Pressable>

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

      {/* share */}
      <SettingsLabel>Share</SettingsLabel>
      <Pressable
        onPress={handleShare}
        style={({ pressed }) => [
          {
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.38),
            backgroundColor: mix(t.accent, t.surface2, 0.13),
            overflow: "hidden",
          },
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: mix(t.accent, t.surface2, 0.22),
                borderWidth: 1,
                borderColor: mix(t.accent, t.surface2, 0.45),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="share" size={19} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="semibold" color={t.accent}>Tell a friend about Judith</Txt>
              <Low size={12} style={{ marginTop: 1 }}>They probably have bills too 😅</Low>
            </View>
          </View>
          <View
            style={{
              backgroundColor: t.accent,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: t.fonts.bold, fontSize: 15, color: "#000", letterSpacing: -0.2 }}>
              Share Judith 📱
            </Text>
          </View>
        </View>
      </Pressable>

      {/* legal */}
      <SettingsLabel>Legal</SettingsLabel>
      <View style={{ borderRadius: t.radius.md, overflow: "hidden" }}>
        {[
          { icon: "receipt" as IconName, t: "Terms of Use", s: "Including acceptable & fair use", url: TERMS_URL },
          { icon: "lock" as IconName, t: "Privacy Policy", s: "How your data is handled", url: PRIVACY_URL },
        ].map((row, i) => (
          <Pressable
            key={row.t}
            onPress={() => openLegal(row.url)}
            style={({ pressed }) => [
              { ...rowBase, borderTopWidth: i === 0 ? 1 : 0, borderBottomWidth: 0 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IcoBox name={row.icon} iconSize={17} color={t.txtMid} />
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="medium">{row.t}</Txt>
              <Low size={12} style={{ marginTop: 1 }}>{row.s}</Low>
            </View>
            <Icon name="chev" size={16} color={t.txtMid} />
          </Pressable>
        ))}
      </View>

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
