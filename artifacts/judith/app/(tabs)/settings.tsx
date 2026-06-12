import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Dot, Low, Mono, Screen, Txt, mix } from "@/components/ui";
import { COUNTRIES, CURRENCIES, countryByCode } from "@/constants/countries";
import { formatMoney } from "@/constants/data";
import { LANGUAGES, langDesc } from "@/constants/languages";
import { PERSONAS } from "@/constants/personas";
import { useAuth } from "@/contexts/AuthContext";
import { useJudithActions, useJudithSelect, type Toggles } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { PRIVACY_URL, TERMS_URL, openLegal } from "@/constants/legal";
import { DEMO_ACCOUNTS } from "@/constants/demoAccounts";
import { getTierPackages, type TierPackages } from "@/lib/purchases";
import { requestPermission } from "@/lib/notifications";
import { getICloudInfo, isICloudAvailable } from "@/lib/icloud-backup";
import { cancelAll as cancelPersonaPreview, preview as playPersonaPreview, prefetchPreview } from "@/lib/onboardingAudio";
import type { PersonaId } from "@/constants/personas";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ────────────────────────────────────────────────────────────────────────
// iOS-style grouped-table primitives
//
// `<Section>` renders an UPPERCASE label, a rounded card with hairline-
// separated rows, and an optional plain-text footer below the card. It
// matches the layout that iOS Settings uses, which users already have
// muscle memory for. `hidden` lets the search filter remove the whole
// section when none of its rows match, without breaking margins.
// ────────────────────────────────────────────────────────────────────────

function Section({
  title,
  footer,
  children,
  hidden,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  const t = useTheme();
  if (hidden) return null;
  return (
    <View style={{ marginTop: 20 }}>
      {!!title && (
        <Text
          style={{
            fontFamily: t.fonts.semibold,
            fontSize: 11.5,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: t.txtMid,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          {title}
        </Text>
      )}
      <View
        style={{
          borderRadius: t.radius.md,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hair,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
      {!!footer && (
        <Text
          style={{
            fontFamily: t.fonts.regular,
            fontSize: 11.5,
            lineHeight: 16,
            color: t.txtLow,
            marginTop: 8,
            marginHorizontal: 4,
          }}
        >
          {footer}
        </Text>
      )}
    </View>
  );
}

function IcoBox({
  name,
  size = 30,
  iconSize = 16,
  color,
  bg,
}: {
  name: IconName;
  size?: number;
  iconSize?: number;
  color: string;
  bg?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: t.hair,
        backgroundColor: bg ?? t.surface3,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={iconSize} color={color} />
    </View>
  );
}

// Single row inside a Section card. `first` skips the top hairline.
function Row({
  icon,
  iconColor,
  iconBg,
  leadingNode,
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
  first,
  disabled,
  hidden,
  destructive,
}: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  /** Replaces the IcoBox when present — useful for avatars or emoji flags. */
  leadingNode?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  first?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  destructive?: boolean;
}) {
  const t = useTheme();
  if (hidden) return null;
  const tappable = !!(onPress || onLongPress);
  // Inline a chevron on tappable rows if the caller didn't supply a right
  // element — matches iOS Settings affordance.
  const rightNode = right ?? (tappable && <Icon name="chev" size={15} color={t.txtMid} />);
  if (!tappable) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: t.hair,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {leadingNode ?? (icon && (
          <IcoBox name={icon} color={iconColor ?? t.accent} bg={iconBg} />
        ))}
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium" color={destructive ? t.semantic.urgent : t.txtHi}>
            {title}
          </Txt>
          {subtitle && <Low size={12} style={{ marginTop: 1 }}>{subtitle}</Low>}
        </View>
        {rightNode}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.hair,
        backgroundColor: pressed ? t.surface3 : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {leadingNode ?? (icon && (
        <IcoBox name={icon} color={iconColor ?? t.accent} bg={iconBg} />
      ))}
      <View style={{ flex: 1 }}>
        <Txt size={15} weight="medium" color={destructive ? t.semantic.urgent : t.txtHi}>
          {title}
        </Txt>
        {subtitle && <Low size={12} style={{ marginTop: 1 }}>{subtitle}</Low>}
      </View>
      {rightNode}
    </Pressable>
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

interface ToggleDef {
  key: keyof Toggles;
  icon: IconName;
  t: string;
  s: string;
}

const REMINDER_TOGGLES: ToggleDef[] = [
  { key: "dueReminders", icon: "bell", t: "Due-date reminders", s: "Before every bill" },
  { key: "nudges", icon: "wallet", t: "Payment nudges", s: "Remind me to pay, not autopay" },
];
// Note: the previous "Home-screen widget" toggle was cosmetic — nothing
// read toggles.widget at runtime (lib/watch.ts unconditionally pushes
// widget payloads regardless of state). Replaced with a navigation row
// to /widget that shows the install flow (preview + step-by-step).
const DEVICE_TOGGLES: ToggleDef[] = [
  { key: "watch", icon: "watch", t: "Apple Watch", s: "Glanceable on your wrist" },
];

// Simple lowercase substring match used by the top search field.
function matches(needle: string, ...haystacks: (string | undefined)[]): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return haystacks.some((h) => !!h && h.toLowerCase().includes(n));
}

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  // Slice subscriptions — Settings only re-renders when a field it actually
  // reads here changes. Bill mutations from Home / Bills / Calendar (which
  // happen frequently) no longer cascade a re-render through this tab.
  const persona = useJudithSelect((s) => s.persona);
  const language = useJudithSelect((s) => s.language);
  const toggles = useJudithSelect((s) => s.toggles);
  const reduceMotion = useJudithSelect((s) => s.reduceMotion);
  const asksLeft = useJudithSelect((s) => s.asksLeft);
  const tier = useJudithSelect((s) => s.tier);
  const theme = useJudithSelect((s) => s.theme);
  const billsLength = useJudithSelect((s) => s.bills.length);
  const name = useJudithSelect((s) => s.name);
  const guest = useJudithSelect((s) => s.guest);
  const countryCode = useJudithSelect((s) => s.countryCode);
  const currency = useJudithSelect((s) => s.currency);
  // Derive country + money from the primitive slices above. countryByCode
  // returns a fresh object every call, so memoize keyed on countryCode to
  // keep referential stability for downstream React.memo'd children.
  const country = useMemo(() => countryByCode(countryCode), [countryCode]);
  const money = useCallback((n: number) => formatMoney(n, currency), [currency]);

  // Stable callback bag — same reference forever, methods stable too.
  // Picking only what Settings uses keeps the surface obvious.
  const {
    setPersona, setLanguage, setToggle, setReduceMotion, setTheme,
    restart, loadDemoAccount, setCountry, setCurrency, restoreFromCloud,
  } = useJudithActions();
  const { user } = useAuth();
  const email = user?.email ?? (guest ? "Guest account" : "—");

  // ── Top-level UI state ────────────────────────────────────────────────
  const [searchQ, setSearchQ] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canRestart = confirmText.trim().toLowerCase() === "restart";
  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [langQ, setLangQ] = useState("");
  const [langExpanded, setLangExpanded] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQ, setCountryQ] = useState("");
  const [curOpen, setCurOpen] = useState(false);
  const [curQ, setCurQ] = useState("");

  // ── RevenueCat dynamic pricing (Plan row) ─────────────────────────────
  const [pkgs, setPkgs] = useState<TierPackages>({ chat: null, voice: null });
  useEffect(() => {
    let cancelled = false;
    getTierPackages()
      .then((p) => { if (!cancelled) setPkgs(p); })
      .catch(() => { /* fallback to money() */ });
    return () => { cancelled = true; };
  }, []);
  const voicePrice = pkgs.voice?.product.priceString ?? money(199);
  const chatPrice  = pkgs.chat?.product.priceString  ?? money(99);

  // ── Persona voice preview — pregen sample only (see memory) ───────────
  const [speakingPersona, setSpeakingPersona] = useState<PersonaId | null>(null);
  useEffect(() => { prefetchPreview(persona, language); }, [persona, language]);
  useEffect(() => () => { cancelPersonaPreview(); }, []);

  const handlePersonaPress = (id: PersonaId) => {
    setPersona(id);
    if (speakingPersona === id) {
      cancelPersonaPreview();
      setSpeakingPersona(null);
      return;
    }
    cancelPersonaPreview();
    setSpeakingPersona(id);
    playPersonaPreview(id, language).finally(() => {
      setSpeakingPersona((cur) => (cur === id ? null : cur));
    });
  };

  // ── iCloud backup status ──────────────────────────────────────────────
  const [iCloud, setICloud] = useState<{ available: boolean; savedAt: string | null }>({ available: false, savedAt: null });
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState("");

  const refreshICloud = useCallback(async () => {
    const ok = await isICloudAvailable();
    if (!ok) { setICloud({ available: false, savedAt: null }); return; }
    if (!user?.id) { setICloud({ available: true, savedAt: null }); return; }
    const info = await getICloudInfo(user.id);
    setICloud({ available: true, savedAt: info?.savedAt ?? null });
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    refreshICloud().catch(() => { if (!cancelled) setICloud({ available: false, savedAt: null }); });
    return () => { cancelled = true; };
  }, [refreshICloud]);

  const lastBackupLabel = useMemo(() => {
    if (!iCloud.available) return "iCloud not available";
    if (!user?.id) return "Sign in to enable backup";
    if (!iCloud.savedAt) return "Not yet backed up";
    const t0 = Date.parse(iCloud.savedAt);
    if (Number.isNaN(t0)) return "Backed up";
    const secs = Math.max(0, Math.floor((Date.now() - t0) / 1000));
    if (secs < 60) return "Backed up just now";
    if (secs < 3600) return `Backed up ${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `Backed up ${Math.floor(secs / 3600)}h ago`;
    return `Backed up ${Math.floor(secs / 86400)}d ago`;
  }, [iCloud, user?.id]);

  const canRestore = iCloud.available && !!user?.id && !!iCloud.savedAt;

  const closeRestore = () => { setRestoreOpen(false); setRestoreBusy(false); setRestoreMsg(""); };
  const doRestore = async () => {
    if (!canRestore || restoreBusy) return;
    setRestoreBusy(true); setRestoreMsg("");
    try {
      const ok = await restoreFromCloud();
      if (!ok) { setRestoreMsg("No backup found for this account."); setRestoreBusy(false); return; }
      closeRestore();
      refreshICloud().catch(() => {});
    } catch {
      setRestoreMsg("Restore failed. Try again later.");
      setRestoreBusy(false);
    }
  };

  // ── Picker-modal derived state ───────────────────────────────────────
  // Memoize ALL three filtered lists. Without this, every parent render
  // (incl. every keystroke in the top Search field) iterates 50+50+30
  // items and rebuilds the arrays — wasted work because the modals are
  // closed most of the time. Now they only recompute when the search
  // query for THAT picker changes.
  const countryList = useMemo(() => {
    const q = countryQ.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countryQ]);
  const curList = useMemo(() => {
    const q = curQ.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) => c.cur.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
    );
  }, [curQ]);
  const langList = useMemo(() => {
    const q = langQ.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((l) => {
      if (l.label.toLowerCase().includes(q) || l.native.toLowerCase().includes(q)) return true;
      return (l.dialects ?? []).some(
        (d) => d.label.toLowerCase().includes(q) || d.native.toLowerCase().includes(q),
      );
    });
  }, [langQ]);

  const currentLangDisplay = useMemo(() => {
    for (const l of LANGUAGES) {
      if (l.code === language && !l.dialects?.length) return { flag: l.flag, native: l.native };
      const d = (l.dialects ?? []).find((d) => d.code === language);
      if (d) return { flag: l.flag, native: d.native };
      if (l.code === language) return { flag: l.flag, native: l.native };
    }
    return { flag: "🇬🇧", native: "English" };
  }, [language]);

  // PERSONAS is small but the `.find` runs on every render — cheap, but
  // memoizing avoids creating a new object reference when persona is the
  // same, which keeps downstream React.memo'd components from re-rendering.
  const currentPersona = useMemo(() => PERSONAS.find((p) => p.id === persona), [persona]);

  // ── Restart / share / dev tools ──────────────────────────────────────
  const closeConfirm = () => { setConfirmOpen(false); setConfirmText(""); };
  const doRestart = () => { if (!canRestart) return; closeConfirm(); restart(); };
  const handleShare = useCallback(async () => {
    await Share.share({
      title: "Track your bills with Judith",
      message:
        "Hey! I’ve been using Judith to stay on top of all my bills — it reminds me before every due date so I never miss a payment. You should try it! 📱\nhttps://judith.app",
    });
  }, []);

  const subscribed = tier !== "free";

  // ── Search visibility helpers ────────────────────────────────────────
  // Per-row predicates so a section auto-hides when none of its rows match.
  // Fast path: when the search box is empty (the 99% case), skip 15+ calls
  // to `matches()` and just hardcode everything visible. Saves real time
  // on every keystroke elsewhere AND every state-driven re-render.
  const searchActive = searchQ.trim().length > 0;
  const m = (label: string, sub?: string) => searchActive ? matches(searchQ, label, sub) : true;

  // Account/Plan
  const visAccount = !searchActive || m("Account", name || email);
  const visPlan = !searchActive || m("Plan", "Ask Judith");

  // Notifications — array predicate kept as map so the per-row `first`
  // logic can read it. When search is inactive, every row is visible.
  const visReminderRows = searchActive
    ? REMINDER_TOGGLES.map((d) => m(d.t, d.s))
    : REMINDER_TOGGLES.map(() => true);
  const visReminders = !searchActive || visReminderRows.some(Boolean);

  // Appearance
  const visTheme = !searchActive || m("Appearance theme dark light system");
  const visReduce = !searchActive || m("Reduce motion", "Calm the animations");
  const visAppearance = visTheme || visReduce;

  // Voice & persona
  const visPersona = !searchActive || m("Personality", currentPersona?.name);
  const visLang = !searchActive || m("Voice language", currentLangDisplay.native);
  const visSpeakAloud = tier === "voice" && (!searchActive || m("Speak answers aloud"));
  const visVoice = visPersona || visLang || visSpeakAloud;

  // Region
  const visCountry = !searchActive || m("Country region where you live", country.name);
  const visCurrency = !searchActive || m("Currency symbol", currency);
  const visRegion = visCountry || visCurrency;

  // Devices
  const visDeviceRows = searchActive
    ? DEVICE_TOGGLES.map((d) => m(d.t, d.s))
    : DEVICE_TOGGLES.map(() => true);
  const visWidget = !searchActive || m("Home-screen widget", "lock screen widget add to home");
  const visDevPreview = !searchActive || m("Preview on your devices");
  const visDevices = !searchActive || visDeviceRows.some(Boolean) || visWidget || visDevPreview;

  // Backup
  const visBackupRow = !searchActive || m("iCloud backup", lastBackupLabel);
  const visRestore = !searchActive || m("Restore from iCloud");
  const visBackup = visBackupRow || visRestore;

  // Legal
  const visTerms = !searchActive || m("Terms of Use");
  const visPrivacy = !searchActive || m("Privacy Policy");
  const visLegal = visTerms || visPrivacy;

  // Share
  const visShare = !searchActive || m("Share", "Tell a friend about Judith");

  return (
    <Screen contentStyle={{ paddingBottom: 28 }}>
      {/* Title */}
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

      {/* Search field — iOS Settings convention. Filters sections by label
          + subtitle match. Empty query renders everything. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: Platform.OS === "ios" ? 10 : 6,
          marginBottom: 6,
        }}
      >
        <TextInput
          value={searchQ}
          onChangeText={setSearchQ}
          placeholder="Search Settings"
          placeholderTextColor={t.txtLow}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            color: t.txtHi,
            fontFamily: t.fonts.regular,
            fontSize: 15,
            padding: 0,
          }}
        />
        {!!searchQ && (
          <Pressable onPress={() => setSearchQ("")} hitSlop={8}>
            <Icon name="x" size={14} color={t.txtMid} />
          </Pressable>
        )}
      </View>

      {/* Empty state when search query has zero hits anywhere */}
      {!!searchQ.trim() &&
        !visAccount && !visPlan && !visReminders && !visAppearance &&
        !visVoice && !visRegion && !visDevices && !visBackup &&
        !visLegal && !visShare && (
          <View style={{ alignItems: "center", marginTop: 40, paddingHorizontal: 24 }}>
            <Txt size={15} weight="semibold" style={{ marginBottom: 4 }}>No matches</Txt>
            <Low size={13} style={{ textAlign: "center" }}>
              Nothing in Settings matches "{searchQ.trim()}". Try a different keyword.
            </Low>
          </View>
        )}

      {/* ── ACCOUNT ─── */}
      <Section title="Account" hidden={!visAccount}>
        <Row
          first
          onPress={() => router.push("/account")}
          leadingNode={
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mix(t.accent, t.surface3, 0.18),
                borderWidth: 1,
                borderColor: mix(t.accent, t.surface2, 0.4),
              }}
            >
              <Text style={{ fontFamily: t.fonts.bold, fontSize: 13, color: t.accent }}>
                {initialsOf(name)}
              </Text>
            </View>
          }
          title={name || "Your account"}
          subtitle={email}
        />
      </Section>

      {/* ── PLAN ─── */}
      <Section title="Plan" hidden={!visPlan}>
        <Row
          first
          onPress={() => router.push("/plans")}
          icon={subscribed ? "star" : "spark"}
          iconColor={t.accent}
          title={tier === "voice" ? "Voice Ask" : tier === "chat" ? "Chat Ask" : "Ask Judith"}
          subtitle={
            tier === "voice" ? (
              <>Unlimited text & voice · <Mono size={12}>{voicePrice}</Mono>/mo</>
            ) : tier === "chat" ? (
              <>Unlimited text asks · <Mono size={12}>{chatPrice}</Mono>/mo</>
            ) : (
              <><Mono size={12}>{asksLeft}</Mono> free asks left</>
            )
          }
          right={
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: subscribed ? mix(t.accent, t.surface2, 0.22) : t.surface3,
                borderWidth: 1,
                borderColor: subscribed ? mix(t.accent, t.surface2, 0.35) : t.hair,
                borderRadius: 20,
                paddingVertical: 5,
                paddingHorizontal: 11,
                gap: 5,
              }}
            >
              {subscribed && <Dot kind="ok" />}
              <Text style={{ fontFamily: t.fonts.bold, fontSize: 12, color: t.accent }}>
                {tier === "voice" ? "Manage" : tier === "chat" ? "Upgrade" : "Get plan"}
              </Text>
            </View>
          }
        />
      </Section>

      {/* ── NOTIFICATIONS ─── */}
      <Section
        title="Notifications"
        footer="Judith reminds you before every bill is due so you never miss a payment."
        hidden={!visReminders}
      >
        {REMINDER_TOGGLES.filter((_, i) => visReminderRows[i]).map((d, idx) => {
          const on = toggles[d.key];
          // Turning ON Due-date reminders or Payment nudges requires
          // notification permission. We gate the setToggle behind the
          // permission prompt so the toggle never lies about its state.
          const handleToggle = async () => {
            const next = !on;
            if (next) {
              const granted = await requestPermission();
              if (!granted) return;
            }
            setToggle(d.key, next);
          };
          return (
            <Row
              key={d.key}
              first={idx === 0}
              icon={d.icon}
              iconColor={on ? t.accent : t.txtMid}
              title={d.t}
              subtitle={d.s}
              right={<Toggle on={on} onPress={handleToggle} />}
            />
          );
        })}
      </Section>

      {/* ── APPEARANCE ─── */}
      <Section title="Appearance" hidden={!visAppearance}>
        {visTheme && (
          <View
            style={{
              padding: 12,
              flexDirection: "row",
              gap: 8,
              borderTopWidth: 0,
            }}
          >
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
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: on ? t.accent : t.hair,
                    backgroundColor: on ? mix(t.accent, t.surface2, 0.18) : t.surface3,
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
        )}
        {visReduce && (
          <Row
            first={!visTheme}
            icon="sliders"
            iconColor={reduceMotion ? t.accent : t.txtMid}
            title="Reduce motion"
            subtitle="Calm the animations — instant transitions"
            right={<Toggle on={reduceMotion} onPress={() => setReduceMotion(!reduceMotion)} />}
          />
        )}
      </Section>

      {/* ── VOICE & PERSONA ─── */}
      <Section
        title="Voice & persona"
        footer="Choose Judith's personality and the language she speaks aloud."
        hidden={!visVoice}
      >
        {visPersona && (
          <Row
            first
            onPress={() => setPersonaOpen(true)}
            leadingNode={
              <View style={{ width: 30, height: 30 }}>
                <JudithAvatar persona={persona} size={30} state="idle" />
              </View>
            }
            title="Judith's personality"
            subtitle={currentPersona?.name ?? "Choose a persona"}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt size={13} color={t.txtMid}>{currentPersona?.vibe ?? ""}</Txt>
                <Icon name="chev" size={15} color={t.txtMid} />
              </View>
            }
          />
        )}
        {visLang && (
          <Row
            first={!visPersona}
            onPress={() => { setLangQ(""); setLangExpanded(null); setLangOpen(true); }}
            icon="mic"
            iconColor={t.accent}
            title="Voice language"
            subtitle="Judith's spoken language"
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 18 }}>{currentLangDisplay.flag}</Text>
                <Txt size={13} color={t.txtMid}>{currentLangDisplay.native}</Txt>
                <Icon name="chev" size={15} color={t.txtMid} />
              </View>
            }
          />
        )}
        {visSpeakAloud && (
          <Row
            first={!visPersona && !visLang}
            icon={toggles.voiceReplies ? "volume" : "volumeOff"}
            iconColor={toggles.voiceReplies ? t.accent : t.txtMid}
            title="Speak answers aloud"
            subtitle="Turn off to get text-only replies in public"
            right={
              <Toggle
                on={toggles.voiceReplies}
                onPress={() => setToggle("voiceReplies", !toggles.voiceReplies)}
              />
            }
          />
        )}
      </Section>

      {/* ── REGION ─── */}
      <Section
        title="Region"
        footer="Currency symbol only — amounts in the app are never converted."
        hidden={!visRegion}
      >
        {visCountry && (
          <Row
            first
            onPress={() => { setCountryQ(""); setCountryOpen(true); }}
            icon="globe"
            iconColor={t.accent}
            title="Where you live"
            subtitle="Shapes Judith's voice and cultural context"
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 18 }}>{country.flag}</Text>
                <Txt size={13} color={t.txtMid}>{country.name}</Txt>
                <Icon name="chev" size={15} color={t.txtMid} />
              </View>
            }
          />
        )}
        {visCurrency && (
          <Row
            first={!visCountry}
            onPress={() => { setCurQ(""); setCurOpen(true); }}
            icon="wallet"
            iconColor={t.accent}
            title="Currency symbol"
            subtitle="Symbol only — not converted"
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt size={16} weight="semibold" color={t.accent}>{currency}</Txt>
                <Icon name="chev" size={15} color={t.txtMid} />
              </View>
            }
          />
        )}
      </Section>

      {/* ── DEVICES ─── */}
      <Section title="Devices" hidden={!visDevices}>
        {visWidget && (
          <Row
            first
            onPress={() => router.push("/widget")}
            icon="grid"
            iconColor={t.accent}
            title="Home-screen widget"
            subtitle="Add Judith to your Home & Lock screens"
          />
        )}
        {DEVICE_TOGGLES.filter((_, i) => visDeviceRows[i]).map((d, idx) => {
          const on = toggles[d.key];
          return (
            <Row
              key={d.key}
              first={!visWidget && idx === 0}
              icon={d.icon}
              iconColor={on ? t.accent : t.txtMid}
              title={d.t}
              subtitle={d.s}
              right={<Toggle on={on} onPress={() => setToggle(d.key, !on)} />}
            />
          );
        })}
        {visDevPreview && (
          <Row
            first={!visWidget && !visDeviceRows.some(Boolean)}
            onPress={() => router.push("/devices")}
            icon="watch"
            iconColor={t.accent}
            title="Preview on your devices"
            subtitle="Widgets & Apple Watch concepts"
          />
        )}
      </Section>

      {/* ── BACKUP ─── */}
      <Section
        title="Backup"
        footer="Your bills and settings are mirrored to your private iCloud container — reinstall the app anytime and tap Restore to get them back."
        hidden={!visBackup}
      >
        {visBackupRow && (
          <Row
            first
            icon="globe"
            iconColor={iCloud.available ? t.accent : t.txtMid}
            title="iCloud backup"
            subtitle={lastBackupLabel}
            right={
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: iCloud.available ? mix(t.accent, t.surface2, 0.4) : t.hair,
                  backgroundColor: iCloud.available ? mix(t.accent, t.surface2, 0.14) : t.surface3,
                }}
              >
                <Txt size={11} weight="semibold" color={iCloud.available ? t.accent : t.txtMid}>
                  {iCloud.available ? (iCloud.savedAt ? "On" : "Ready") : "Off"}
                </Txt>
              </View>
            }
          />
        )}
        {visRestore && (
          <Row
            first={!visBackupRow}
            onPress={canRestore ? () => { setRestoreMsg(""); setRestoreOpen(true); } : undefined}
            disabled={!canRestore}
            icon="refresh"
            iconColor={canRestore ? t.accent : t.txtMid}
            title="Restore from iCloud"
            subtitle="Replaces local bills & settings with your backup"
          />
        )}
      </Section>

      {/* ── PRIVACY & LEGAL ─── */}
      <Section title="Privacy & Legal" hidden={!visLegal}>
        {visTerms && (
          <Row
            first
            onPress={() => openLegal(TERMS_URL)}
            icon="receipt"
            iconColor={t.txtMid}
            title="Terms of Use"
            subtitle="Including acceptable & fair use"
          />
        )}
        {visPrivacy && (
          <Row
            first={!visTerms}
            onPress={() => openLegal(PRIVACY_URL)}
            icon="lock"
            iconColor={t.txtMid}
            title="Privacy Policy"
            subtitle="How your data is handled"
          />
        )}
      </Section>

      {/* ── SHARE — accent card kept distinct from grouped table ─── */}
      {visShare && (
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            {
              marginTop: 26,
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
      )}

      {/* ── ABOUT — version stamp. Long-press opens dev tools (demo
              account loader + Restart from scratch). Hidden from casual
              users so the production Settings stays clean. */}
      <Pressable
        onLongPress={() => setDevMenuOpen(true)}
        delayLongPress={650}
        style={{ alignItems: "center", marginTop: 26 }}
      >
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
        <Low size={10} style={{ marginTop: 4, opacity: 0.5 }}>Long-press for developer tools</Low>
      </Pressable>

      {/* ─────────────────────── MODALS ─────────────────────── */}

      {/* Persona picker — replaces the old inline horizontal scroller.
          Bottom sheet with a vertical list, iOS-style. Tapping a persona
          selects it AND plays the cached preview sample (see memory:
          previews must use pregen, never live TTS). */}
      <Modal visible={personaOpen} transparent animationType="slide" onRequestClose={() => setPersonaOpen(false)}>
        {personaOpen && (
        <Pressable onPress={() => setPersonaOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: t.surface1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: t.hair, maxHeight: "85%", paddingBottom: 34 }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.hair2, marginTop: 12, marginBottom: 14 }} />
            <View style={{ paddingHorizontal: 18, marginBottom: 8 }}>
              <Txt size={18} weight="semibold">Judith's personality</Txt>
              <Low size={12} style={{ marginTop: 2 }}>Tap any persona to hear her voice.</Low>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14, gap: 10 }}>
              {PERSONAS.filter((p) => !p.phOnly || country.code === "PH").map((p) => {
                const on = persona === p.id;
                const speaking = speakingPersona === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => handlePersonaPress(p.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: on ? t.accent : t.hair,
                      backgroundColor: on ? mix(t.accent, t.surface2, 0.12) : t.surface2,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <JudithAvatar persona={p.id} size={44} state={speaking ? "speaking" : "idle"} />
                    <View style={{ flex: 1 }}>
                      <Txt size={15} weight="semibold">{p.name}</Txt>
                      <Low size={12} style={{ marginTop: 2 }}>{p.vibe}</Low>
                      {speaking && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                          <Icon name="volume" size={11} color={t.accent} />
                          <Txt size={11} weight="semibold" color={t.accent}>Playing…</Txt>
                        </View>
                      )}
                    </View>
                    {p.phOnly && (
                      <View style={{
                        backgroundColor: "#f472b6",
                        borderRadius: 20,
                        paddingVertical: 2,
                        paddingHorizontal: 7,
                        marginRight: 6,
                      }}>
                        <Txt size={9.5} weight="semibold" color="#fff">🇵🇭</Txt>
                      </View>
                    )}
                    {on ? <Icon name="check" size={18} color={t.accent} /> : <View style={{ width: 18 }} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
        )}
      </Modal>

      {/* Voice language picker (unchanged behavior, gated body) */}
      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        {langOpen && (
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
        )}
      </Modal>

      {/* Country picker */}
      <Modal visible={countryOpen} transparent animationType="slide" onRequestClose={() => setCountryOpen(false)}>
        {countryOpen && (
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
        )}
      </Modal>

      {/* Currency picker */}
      <Modal visible={curOpen} transparent animationType="slide" onRequestClose={() => setCurOpen(false)}>
        {curOpen && (
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
                <Icon name="lock" size={15} color={t.accent} />
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
        )}
      </Modal>

      {/* iCloud restore confirm */}
      <Modal visible={restoreOpen} transparent animationType="fade" onRequestClose={closeRestore} statusBarTranslucent>
        {restoreOpen && (
        <Pressable
          onPress={restoreBusy ? undefined : closeRestore}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 26 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, borderRadius: 18, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, padding: 22 }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: mix(t.accent, t.surface2, 0.16), borderWidth: 1, borderColor: mix(t.accent, t.surface2, 0.4), marginBottom: 14 }}>
              <Icon name="globe" size={22} color={t.accent} />
            </View>
            <Text style={{ fontFamily: t.fonts.semibold, fontSize: 19, color: t.txtHi, letterSpacing: -0.3, marginBottom: 8 }}>
              Restore from iCloud?
            </Text>
            <Low size={13} style={{ lineHeight: 19 }}>
              Replaces your{" "}
              <Low size={13} weight="medium" color={t.txtHi}>current {billsLength} bills & settings</Low>{" "}
              with the iCloud backup{iCloud.savedAt ? ` from ${lastBackupLabel.toLowerCase()}` : ""}. This can&rsquo;t be undone.
            </Low>
            {!!restoreMsg && (
              <Text style={{ marginTop: 12, fontSize: 13, color: t.semantic.urgent, fontFamily: t.fonts.regular }}>{restoreMsg}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={closeRestore}
                disabled={restoreBusy}
                style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 11, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface3, opacity: restoreBusy ? 0.5 : 1 }}
              >
                <Txt size={14} weight="medium">Cancel</Txt>
              </Pressable>
              <Pressable
                onPress={doRestore}
                disabled={restoreBusy}
                style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 11, backgroundColor: t.accent, opacity: restoreBusy ? 0.7 : 1 }}
              >
                <Txt size={14} weight="semibold" color={t.onAccent}>{restoreBusy ? "Restoring…" : "Restore"}</Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
        )}
      </Modal>

      {/* Dev menu — surfaced via long-press on the version stamp. Kept
          out of the main UI so production users don't see "Load demo"
          and "Restart from scratch" by default. */}
      <Modal visible={devMenuOpen} transparent animationType="slide" onRequestClose={() => setDevMenuOpen(false)}>
        {devMenuOpen && (
        <Pressable onPress={() => setDevMenuOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: t.surface1, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 40, borderWidth: 1, borderColor: t.hair }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.hair2, marginTop: 12, marginBottom: 14 }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
              <Txt size={18} weight="semibold" style={{ marginBottom: 4 }}>Developer tools</Txt>
              <Low size={13}>Internal-only. Not visible to regular users.</Low>
            </View>
            <View style={{ paddingHorizontal: 18, gap: 10 }}>
              <Pressable
                onPress={() => { setDevMenuOpen(false); setDemoPickerOpen(true); }}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: mix(t.accent, t.surface2, 0.4), borderRadius: t.radius.md, backgroundColor: mix(t.accent, t.surface2, 0.08) },
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
              <Pressable
                onPress={() => { setDevMenuOpen(false); setConfirmOpen(true); }}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: mix("#ff645f", t.surface2, 0.4), borderRadius: t.radius.md, backgroundColor: mix("#ff645f", t.surface2, 0.1) },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Icon name="refresh" size={18} color="#ff645f" />
                <View style={{ flex: 1 }}>
                  <Txt size={15} weight="medium" color="#ff645f">Restart from scratch</Txt>
                  <Low size={12} style={{ marginTop: 1 }}>Wipes local bills & settings — requires "restart" confirmation</Low>
                </View>
                <Icon name="chev" size={16} color="#ff645f" />
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
        )}
      </Modal>

      {/* Demo-account picker (opened from dev menu) */}
      <Modal visible={demoPickerOpen} transparent animationType="slide" onRequestClose={() => setDemoPickerOpen(false)}>
        {demoPickerOpen && (
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
                  onPress={() => { loadDemoAccount(acct.code); setDemoPickerOpen(false); }}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 14,
                    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
                    borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2,
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
        )}
      </Modal>

      {/* Restart-from-scratch confirm */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={closeConfirm} statusBarTranslucent>
        <Pressable
          onPress={closeConfirm}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 26 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, borderRadius: 18, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, padding: 22 }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: mix("#ff645f", t.surface2, 0.16), borderWidth: 1, borderColor: mix("#ff645f", t.surface2, 0.4), marginBottom: 14 }}>
              <Icon name="bell" size={22} color="#ff645f" />
            </View>
            <Text style={{ fontFamily: t.fonts.semibold, fontSize: 19, color: t.txtHi, letterSpacing: -0.3, marginBottom: 8 }}>
              Restart from scratch?
            </Text>
            <Low size={13} style={{ lineHeight: 19 }}>
              This permanently deletes{" "}
              <Low size={13} weight="medium" color={t.txtHi}>all {billsLength} of your bill records</Low>{" "}
              and resets every setting, so you can start a brand-new onboarding. This can&rsquo;t be undone.
            </Low>
            <Low size={12} style={{ marginTop: 16, marginBottom: 7 }}>
              Type <Low size={12} weight="medium" color={t.txtHi}>restart</Low> to confirm
            </Low>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="restart"
              placeholderTextColor={t.txtLow}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                fontFamily: t.fonts.medium, fontSize: 15, color: t.txtHi,
                borderWidth: 1, borderColor: canRestart ? "#ff645f" : t.hair,
                backgroundColor: t.surface3, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={closeConfirm}
                style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 11, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface3 }}
              >
                <Txt size={14} weight="medium">Cancel</Txt>
              </Pressable>
              <Pressable
                onPress={doRestart}
                disabled={!canRestart}
                style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 11, backgroundColor: canRestart ? "#ff645f" : mix("#ff645f", t.surface2, 0.3), opacity: canRestart ? 1 : 0.5 }}
              >
                <Txt size={14} weight="semibold" color="#ffffff">Delete & restart</Txt>
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
