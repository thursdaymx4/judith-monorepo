import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

import * as Notifications from "expo-notifications";
import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Dot, Low, Mono, Screen, Txt, mix } from "@/components/ui";
import { COUNTRIES, CURRENCIES } from "@/constants/countries";
import { LANGUAGES, langDesc, languageByCode } from "@/constants/languages";
import { PERSONAS } from "@/constants/personas";
import { useAuth } from "@/contexts/AuthContext";
import { useJudith, type Toggles } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { requestPermission } from "@/lib/notifications";
import { PRIVACY_URL, TERMS_URL, openLegal } from "@/constants/legal";
import { DEMO_ACCOUNTS } from "@/constants/demoAccounts";
import { fetchSample } from "@/lib/proxy";
import { playBase64Mp3, playFromUrl, stopCurrentAudio } from "@/lib/audio";
import type { PersonaId } from "@/constants/personas";

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
  const { persona, setPersona, language, setLanguage, toggles, setToggle, reduceMotion, setReduceMotion, asksLeft, tier, theme, setTheme, restart, loadDemoData, loadDemoAccount, money, bills, name, guest, country, setCountry, currency, setCurrency, countryCode } =
    useJudith();
  const { user } = useAuth();
  const email = user?.email ?? (guest ? "Guest account" : "—");

  const [speakingPersona, setSpeakingPersona] = useState<PersonaId | null>(null);
  const speakRequestRef = useRef(0);

  useEffect(() => {
    speakRequestRef.current += 1;
    stopCurrentAudio();
    setSpeakingPersona(null);
  }, [language, countryCode]);

  const playPersonaSample = useCallback(async (id: PersonaId) => {
    if (speakingPersona === id) return;
    const requestId = speakRequestRef.current + 1;
    speakRequestRef.current = requestId;
    stopCurrentAudio();
    startTransition(() => setSpeakingPersona(id));
    try {
      const { url, audioBase64 } = await fetchSample(id, language, countryCode);
      if (speakRequestRef.current !== requestId) return;
      if (url) {
        await playFromUrl(url);
      } else if (audioBase64) {
        await playBase64Mp3(audioBase64);
      }
    } catch {
      // ignore — failed silently
    } finally {
      if (speakRequestRef.current === requestId) {
        startTransition(() => {
          setSpeakingPersona((cur) => (cur === id ? null : cur));
        });
      }
    }
  }, [speakingPersona, language, countryCode]);

  const subscribed = tier !== "free";

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const canRestart = confirmText.trim().toLowerCase() === "restart";

  const [demoPickerOpen, setDemoPickerOpen] = React.useState(false);

  const [langOpen, setLangOpen] = React.useState(false);
  const [langQ, setLangQ] = React.useState("");
  const [langExpanded, setLangExpanded] = React.useState<string | null>(null);

  const [countryOpen, setCountryOpen] = React.useState(false);
  const [countryQ, setCountryQ] = React.useState("");
  const countryQuery = countryQ.trim().toLowerCase();

  const [curOpen, setCurOpen] = React.useState(false);
  const [curQ, setCurQ] = React.useState("");
  const curQuery = curQ.trim().toLowerCase();
  const curList = CURRENCIES.filter(
    (c) => !curQuery || c.cur.toLowerCase().includes(curQuery) || c.label.toLowerCase().includes(curQuery),
  );
  const countryList = COUNTRIES.filter((c) =>
    !countryQuery || c.name.toLowerCase().includes(countryQuery) || c.code.toLowerCase().includes(countryQuery)
  );

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

      {/* plan — single combined card */}
      <Pressable
        onPress={() => router.push("/plans")}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            borderWidth: 1,
            borderColor: subscribed ? mix(t.accent, t.surface2, 0.3) : t.hair,
            borderRadius: t.radius.md,
            backgroundColor: subscribed ? mix(t.accent, t.surface2, 0.14) : t.surface2,
            padding: t.space.pad,
          },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <IcoBox
          name={subscribed ? "star" : "spark"}
          size={44}
          iconSize={20}
          color={t.accent}
          borderColor={subscribed ? mix(t.accent, t.surface2, 0.4) : t.hair}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={15} weight="semibold">
            {tier === "voice" ? "Voice Ask" : tier === "chat" ? "Chat Ask" : "Ask Judith"}
          </Txt>
          <Low size={12}>
            {tier === "voice" ? (
              <>Unlimited text & voice · <Mono size={12}>{money(199)}</Mono>/mo</>
            ) : tier === "chat" ? (
              <>Unlimited text asks · <Mono size={12}>{money(99)}</Mono>/mo</>
            ) : (
              <><Mono size={12}>{asksLeft}</Mono> free asks left</>
            )}
          </Low>
          {subscribed && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
              <Dot kind="ok" />
              <Txt size={11} color={t.semantic.ok}>Active</Txt>
            </View>
          )}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: subscribed ? mix(t.accent, t.surface2, 0.22) : t.surface2,
            borderWidth: 1,
            borderColor: subscribed ? mix(t.accent, t.surface2, 0.35) : t.hair,
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
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["dark", "system", "light"] as const).map((mode) => {
          const on = theme === mode;
          const iconName = mode === "dark" ? "moon" : mode === "light" ? "sun" : "smartphone";
          const label = mode === "dark" ? "Dark" : mode === "light" ? "Light" : "System";
          return (
            <Pressable
              key={mode}
              onPress={() => setTheme(mode)}
              style={{
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 14,
                paddingHorizontal: 4,
                borderRadius: t.radius.md,
                borderWidth: 1,
                borderColor: on ? t.accent : t.hair,
                backgroundColor: on ? t.accent + "14" : t.surface2,
              }}
            >
              <Icon name={iconName} size={18} color={on ? t.accent : t.txtMid} />
              <Text style={{ fontFamily: t.fonts.semibold, fontSize: 12, color: on ? t.accent : t.txtMid }}>
                {label}
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

      {/* where you live */}
      <SettingsLabel>Where you live</SettingsLabel>
      <Pressable
        onPress={() => { setCountryQ(""); setCountryOpen(true); }}
        style={({ pressed }) => [
          { ...rowBase, borderRadius: t.radius.md },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <IcoBox name="globe" iconSize={17} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium">{country.name}</Txt>
          <Low size={12} style={{ marginTop: 1 }}>Shapes Judith's voice and cultural context</Low>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 22 }}>{country.flag}</Text>
          <Icon name="chev" size={16} color={t.txtMid} />
        </View>
      </Pressable>

      <Modal visible={countryOpen} transparent animationType="slide" onRequestClose={() => setCountryOpen(false)}>
        <Pressable onPress={() => setCountryOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: t.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: t.hair, maxHeight: "85%", paddingBottom: 34 }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.hair2, marginTop: 12, marginBottom: 14 }} />
            <View style={{ paddingHorizontal: 18 }}>
              <Txt size={18} weight="semibold" style={{ marginBottom: 12 }}>Where you live</Txt>
              <TextInput
                value={countryQ}
                onChangeText={setCountryQ}
                placeholder="Search countries…"
                placeholderTextColor={t.txtLow}
                style={{
                  borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2,
                  borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14,
                  color: t.txtHi, fontFamily: t.fonts.regular, fontSize: 14, marginBottom: 12,
                }}
              />
            </View>
            <ScrollView style={{ paddingHorizontal: 18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 12 }}>
              {countryList.map((c) => {
                const active = country.code === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => { setCountry(c.code); setCountryOpen(false); }}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", gap: 12,
                      paddingVertical: 13, paddingHorizontal: 14,
                      borderRadius: 12, borderWidth: 1,
                      borderColor: active ? t.accent : t.hair,
                      backgroundColor: active ? mix(t.accent, t.surface2, 0.12) : t.surface2,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 24 }}>{c.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Txt size={14} weight="medium">{c.name}</Txt>
                      <Low size={12} style={{ marginTop: 2 }}>{c.cur}</Low>
                    </View>
                    {active ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* currency */}
      <SettingsLabel>Currency</SettingsLabel>
      <Pressable
        onPress={() => { setCurQ(""); setCurOpen(true); }}
        style={({ pressed }) => [
          { ...rowBase, borderRadius: t.radius.md },
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
      >
        <IcoBox name="wallet" iconSize={17} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium">Currency symbol</Txt>
          <Low size={12} style={{ marginTop: 1 }}>Symbol only — amounts are not converted</Low>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt size={17} weight="semibold" style={{ color: t.accent }}>{currency}</Txt>
          <Icon name="chev" size={16} color={t.txtMid} />
        </View>
      </Pressable>

      <Modal visible={curOpen} transparent animationType="slide" onRequestClose={() => setCurOpen(false)}>
        <Pressable onPress={() => setCurOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: t.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: t.hair, maxHeight: "85%", paddingBottom: 34 }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.hair2, marginTop: 12, marginBottom: 14 }} />
            <View style={{ paddingHorizontal: 18 }}>
              <Txt size={18} weight="semibold" style={{ marginBottom: 10 }}>Currency symbol</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: mix(t.accent, t.surface2, 0.12), borderRadius: 10, paddingVertical: 10, paddingHorizontal: 13, marginBottom: 12 }}>
                <Icon name="info" size={15} color={t.accent} />
                <Txt size={12} style={{ color: t.accent, flex: 1, lineHeight: 17 }}>
                  Changing this only updates the symbol shown in the app. Your amounts stay exactly the same — nothing is converted.
                </Txt>
              </View>
              <TextInput
                value={curQ}
                onChangeText={setCurQ}
                placeholder="Search currencies…"
                placeholderTextColor={t.txtLow}
                style={{
                  borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2,
                  borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14,
                  color: t.txtHi, fontFamily: t.fonts.regular, fontSize: 14, marginBottom: 12,
                }}
              />
            </View>
            <ScrollView style={{ paddingHorizontal: 18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 12 }}>
              {curList.map((c) => {
                const active = currency === c.cur;
                return (
                  <Pressable
                    key={c.cur}
                    onPress={() => { setCurrency(c.cur); setCurOpen(false); }}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", gap: 12,
                      paddingVertical: 13, paddingHorizontal: 14,
                      borderRadius: 12, borderWidth: 1,
                      borderColor: active ? t.accent : t.hair,
                      backgroundColor: active ? mix(t.accent, t.surface2, 0.12) : t.surface2,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 24 }}>{c.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Txt size={14} weight="medium">{c.label}</Txt>
                      <Low size={12} style={{ marginTop: 2 }}>{c.cur}</Low>
                    </View>
                    {active ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* persona — horizontal slidable avatar picker */}
      <SettingsLabel>Judith's personality</SettingsLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingVertical: 2, paddingRight: 4 }}
      >
        {PERSONAS.filter(p => !p.phOnly || country.code === "PH").map((p) => {
          const on = persona === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPersona(p.id)}
              style={({ pressed }) => ({
                width: 128,
                alignItems: "center",
                paddingTop: 14,
                paddingBottom: 12,
                paddingHorizontal: 10,
                borderRadius: t.radius.md,
                borderWidth: 1,
                borderColor: on ? t.accent : t.hair,
                backgroundColor: on ? mix(t.accent, t.surface2, 0.12) : t.surface2,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View>
                <JudithAvatar persona={p.id} size={56} state="idle" />
                {on && (
                  <View
                    style={{
                      position: "absolute",
                      right: -2,
                      bottom: -2,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: t.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: on ? mix(t.accent, t.surface2, 0.12) : t.surface2,
                    }}
                  >
                    <Icon name="check" size={11} color={t.onAccent} />
                  </View>
                )}
              </View>
              <Txt size={13.5} weight="semibold" color={on ? t.txtHi : t.txtMid} style={{ marginTop: 9, textAlign: "center" }} numberOfLines={1}>
                {p.name}
              </Txt>
              <Low size={11} style={{ marginTop: 2, textAlign: "center" }} numberOfLines={1}>
                {p.vibe}
              </Low>
              {p.phOnly && (
                <View style={{
                  backgroundColor: "#f472b6",
                  borderRadius: 20,
                  paddingVertical: 2,
                  paddingHorizontal: 7,
                  marginTop: 6,
                }}>
                  <Txt size={9.5} weight="semibold" color="#fff">🇵🇭 PH only</Txt>
                </View>
              )}
              <Pressable
                onPress={(e) => { e.stopPropagation(); playPersonaSample(p.id); }}
                style={({ pressed }) => ({
                  marginTop: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingVertical: 5,
                  paddingHorizontal: 9,
                  borderRadius: 12,
                  backgroundColor: speakingPersona === p.id
                    ? t.accent
                    : on
                    ? mix(t.accent, t.surface2, 0.18)
                    : t.surface1,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Icon
                  name={speakingPersona === p.id ? "volume" : "play"}
                  size={10}
                  color={speakingPersona === p.id ? t.onAccent : t.accent}
                />
                <Txt size={10} weight="semibold" color={speakingPersona === p.id ? t.onAccent : t.accent}>
                  {speakingPersona === p.id ? "Playing…" : "Hear voice"}
                </Txt>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>

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
              title: `Test · ${persona === "funny" ? "Heads up 👀" : persona === "pro" ? "Reminder: you have bills." : persona === "mama" ? "Anak, test lang 👋" : persona === "marites" ? "Psst! Test notification 🤫" : persona === "britney" ? "You have bills. Pay them." : "Test notification"}`,
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

      {/* Load demo account — country picker */}
      <Pressable
        onPress={() => setDemoPickerOpen(true)}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
            marginTop: 28,
            paddingVertical: 14,
            paddingHorizontal: 15,
            borderWidth: 1,
            borderColor: mix(t.accent, t.surface2, 0.4),
            borderRadius: t.radius.md,
            backgroundColor: mix(t.accent, t.surface2, 0.08),
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Icon name="spark" size={18} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium" color={t.accent}>Load demo account</Txt>
          <Low size={12} style={{ marginTop: 1 }}>Try the app pre-filled with bills for any country</Low>
        </View>
        <Icon name="chev" size={16} color={t.accent} />
      </Pressable>

      <Modal visible={demoPickerOpen} transparent animationType="slide" onRequestClose={() => setDemoPickerOpen(false)}>
        <Pressable onPress={() => setDemoPickerOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: t.surface1, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 40 }}
          >
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
              <Txt size={18} weight="semibold" style={{ marginBottom: 4 }}>Load demo account</Txt>
              <Low size={13}>Replaces all current data with a pre-filled account</Low>
            </View>
            <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 10, paddingBottom: 8 }}>
              {DEMO_ACCOUNTS.map((acct) => (
                <Pressable
                  key={acct.code}
                  onPress={() => {
                    loadDemoAccount(acct.code);
                    setDemoPickerOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: t.hair,
                    backgroundColor: t.surface2,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ fontSize: 28 }}>{acct.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Txt size={15} weight="medium">{acct.label}</Txt>
                    <Low size={12} style={{ marginTop: 2 }}>{acct.subtitle}</Low>
                  </View>
                  <Icon name="chev" size={16} color={t.txtLow} />
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={{ alignItems: "center", marginTop: 22 }}>
        <Low size={12}>Judith v1.0 · Available worldwide</Low>
        <Low size={11} style={{ marginTop: 2 }}>
          {`Build ${Updates.runtimeVersion ?? "—"}${Updates.channel ? ` · ${Updates.channel}` : ""}`}
        </Low>
        <Low size={11} style={{ marginTop: 1 }}>
          {Updates.isEmbeddedLaunch
            ? "Embedded bundle · no OTA applied"
            : `OTA ${(Updates.updateId ?? "").slice(0, 8) || "—"}${
                Updates.createdAt ? ` · ${Updates.createdAt.toISOString().slice(0, 10)}` : ""
              }`}
        </Low>
        <Pressable onPress={() => setConfirmOpen(true)} style={{ marginTop: 6 }}>
          <Low size={12}>Restart from scratch</Low>
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

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <Text style={{ color: "#ea1d3b", fontSize: 16, fontWeight: "600", textAlign: "center" }}>
        Settings failed to load
      </Text>
      <Text style={{ color: "#888", fontSize: 12, textAlign: "center" }}>
        {__DEV__ ? error.message : "Please restart the app."}
      </Text>
      <Pressable onPress={retry} style={{ backgroundColor: "#29d5a5", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 }}>
        <Text style={{ color: "#000", fontWeight: "600" }}>Try Again</Text>
      </Pressable>
    </View>
  );
}
