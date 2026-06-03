import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn, Card, Low, mix, Mono, Txt } from "@/components/ui";
import {
  COUNTRIES,
  countryFood,
  type Country,
} from "@/constants/countries";
import { HOUSES, type Bill } from "@/constants/data";
import {
  getSamples, getCardTemplates, getLoanTemplates,
  getDLocal, getProviderPlaceholder, getQuickAsks,
} from "@/constants/providers";
import { LANGUAGES, langSample, langDesc, isFilipino, sttHint } from "@/constants/languages";
import { PERSONAS, type PersonaId } from "@/constants/personas";
import { JUDITH_VOICE } from "@/constants/voiceLines";
import { LinearGradient } from "expo-linear-gradient";
import { useJudith } from "@/contexts/JudithStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/lib/haptics";
import { fileToBase64, playBase64Mp3, stopCurrentAudio } from "@/lib/audio";
import { transcribeOnboarding, synthOnboarding, fetchSampleOnboarding, parseBillOnboarding, parseSubscriptionScreenshot, askOnboarding } from "@/lib/proxy";
import type { Theme } from "@/constants/theme";

/* ------------------------------------------------------------------ */
/* i18n strings (English only — shipped variant)                       */
/* ------------------------------------------------------------------ */

const STR: Record<string, string> = {
  getstarted: "Let’s begin",
  continue: "Continue",
  next: "Next",
  skip: "Skip",
  finish: "Enter Judith",
  countryT: "Where do you live?",
  countryL: "So Judith uses your currency, due-date norms, and providers.",
  countrySearch: "Search country",
  personaT: "Who should Judith be?",
  personaL: "Pick a personality — you can change it anytime.",
  play: "Play voice",
  listening: "Listening…",
  tapInstead: "Type instead",
  confirmQ: "Did I get that right?",
  yes: "Yes, that’s right",
  edit: "Let me fix it",
  congratsT: "All set.",
  congratsL: "Judith now watches every due date for you.",
  summaryT: "Your money, this month",
  perMonth: "due per month",
  billsCount: "bills tracked",
  insBiggest: "Biggest bill",
  insNext: "Next due",
  insSaved: "Late fees avoided",
};
const PERS_LINES = [
  "Reading your bills…",
  "Setting smart reminders…",
  "Tuning Judith’s voice…",
  "Almost ready…",
];
const T = (k: string): string => STR[k] ?? k;


/* ------------------------------------------------------------------ */
/* voice flow data                                                     */
/* ------------------------------------------------------------------ */

interface Sample {
  group: number;
  provider: string;
  cat: string;
  icon: string;
  amount: number;
  due: string;
  dueDays: number;
  subtype?: string;
  utter: string;
  toks: string[];
}


interface CardLoanTpl {
  provider: string;
  amount: number;
  due: string;
  dueDays: number;
  utter: string;
  toks: string[];
}

interface VGroup {
  label: string;
  done: string;
  note: string;
  askTitle?: string;
  askSub?: string;
  addLabel?: string;
}
const VGROUPS: VGroup[] = [
  { label: "The essentials", done: "Your essentials are in.", note: "Power, water, internet — the must-pays. Take a breath; this is saved.", askTitle: "Any other utilities?", askSub: "Another meter, association dues, garbage, gas?", addLabel: "Add a utility" },
  { label: "Subscriptions", done: "Subscriptions, logged.", note: "Phone, streaming, apps — the silent drainers. Saved and safe.", askTitle: "Any other subscriptions?", askSub: "Gaming, news, cloud storage, that free trial that wasn’t?", addLabel: "Add a subscription" },
  { label: "Cards & loans", done: "", note: "" },
];

const VLOCAL = {
  gotit: "Got it! Here’s what I heard:",
  lblP: "Provider",
  lblA: "Amount",
  lblD: "Due",
  lblC: "Category",
  monthly: "monthly",
  annually: "annually",
};

const MANUAL_CATS: { cat: string; icon: string }[] = [
  { cat: "Rent / Mortgage", icon: "home" },
  { cat: "Electricity", icon: "zap" },
  { cat: "Water", icon: "droplet" },
  { cat: "Internet", icon: "wifi" },
  { cat: "Mobile", icon: "smartphone" },
  { cat: "TV / Streaming", icon: "spark" },
  { cat: "Credit card", icon: "card" },
  { cat: "Personal loan", icon: "wallet" },
  { cat: "Other", icon: "plus" },
];

/* Voice lines live in constants/voiceLines.ts — edit them there. */

/**
 * Tagalog/Taglish equivalents for every canned onboarding voice line.
 * Keyed by the English source string. Used by useOnbVoice when isFilipino(language).
 */
const VOICE_LINES_FIL: Record<string, string> = {
  /* Screen 1 — Welcome */
  "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?":
    "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?",
  /* Screen 2 — Name */
  "One more thing \u2014 what should I call you?":
    "Hi! Can I get your name po?",
  /* Screen 4 — Language */
  "Take control of your bills, take control of your life.":
    "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?",
  /* Screen 6 — LateFee */
  "We\u2019ve all been there. Missed a payment, surprise fee. I\u2019m here so that never happens again.":
    "Naranasan mo na ba yung late fee? Nakakainis. Ako na bahala para \u2019di na maulit.",
  /* Screen 7 — Problem */
  "Honestly, most people don\u2019t. Let\u2019s change that.":
    "Ako nga din, hindi ko alam. Tara ayusin nga natin!",
  /* Screen 8 — Stakes */
  "Let\u2019s change this \u2014 right now.":
    "Baguhin na natin! Now na!",
  /* Screen 11 — Personalizing */
  "Give me just a second \u2014 I\u2019m putting your dashboard together right now.":
    "Wait lang ha, bawal mainipin.",
  /* Feature screens (13–15) */
  "Go ahead \u2014 tap the mic and just talk to me. Ask anything. I'm listening.":
    "Try mo kong tanungin ng kahit ano tungkol sa bills mo.",
  "Try asking 'what\u2019s due this week?' I'll tell you everything, right now.":
    "Isa pa \u2014 check natin kung masasagot ko tanong mo.",
  "Ask me if it\u2019s safe to spend before payday. I'll check what\u2019s coming and give you a straight answer.":
    "Ano? Bilib ka na ba? Isa pa \u2014 baka chamba lang.",
  /* Screen 16 — Paywall */
  "You\u2019ve got eight free asks to start. Want to keep the conversation going? Pick a plan that fits and I\u2019m all yours.":
    "Salamat sa pag-suporta sa amin ni Judith. Baka gusto mo pa kaming kausapin ng mas matagal \u2014 pwede naman!",
};

/**
 * Plays a short supplementary voice line once when an onboarding screen mounts.
 * Stops any in-progress audio when the screen unmounts so voices never overlap.
 * Safe with React Compiler (no runtime require).
 */
function useOnbVoice(line: string, persona: PersonaId, language = "en") {
  const played = useRef(false);
  // Stop whatever is playing when the screen leaves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopCurrentAudio(); }, []);
  // Fire the TTS exactly once per mount, in the chosen language.
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    let cancelled = false;
    const utterance = (isFilipino(language) ? VOICE_LINES_FIL[line] : undefined) ?? line;
    if (!utterance) return; // empty string = voice suppressed for this screen
    synthOnboarding(utterance, persona, language)
      .then(({ audioBase64 }) => {
        if (!cancelled) playBase64Mp3(audioBase64).catch(() => {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  });
}



const VARIABLE_CATS = ["Electricity", "Water", "Mobile", "Credit card"];
const kindFor = (cat: string): "Fixed" | "Variable" =>
  VARIABLE_CATS.indexOf(cat) >= 0 ? "Variable" : "Fixed";

interface OnbBill {
  provider: string;
  cat: string;
  icon: string;
  amount: number;
  due: string;
  dueDays: number;
  kind: "Fixed" | "Variable";
  frequency?: "monthly" | "annual";
  subtype?: string;
  house?: string;
}

const fmtNum = (n: number): string => n.toLocaleString("en-US");
const dueClass = (d: number): "overdue" | "urgent" | "near" | "ok" =>
  d < 0 ? "overdue" : d <= 3 ? "urgent" : d <= 7 ? "near" : "ok";

/* ------------------------------------------------------------------ */
/* color helper — accent / semantic over transparent                   */
/* ------------------------------------------------------------------ */

function withAlpha(hex: string, a: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------------------------------------------ */
/* shared layout primitives                                            */
/* ------------------------------------------------------------------ */

function Scroll({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.canvas }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 22,
        paddingTop: 14,
        paddingBottom: 26,
        ...(center
          ? { justifyContent: "center", alignItems: "center" }
          : {}),
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function CtaBar({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: 20 + insets.bottom,
        gap: 9,
        backgroundColor: t.canvas,
      }}
    >
      {children}
    </View>
  );
}

function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Txt
      size={12}
      weight="semibold"
      color={t.accent}
      style={[{ letterSpacing: 1.9, textTransform: "uppercase", marginBottom: 8 }, style]}
    >
      {children}
    </Txt>
  );
}

function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Txt size={27} weight="semibold" style={[{ letterSpacing: -0.4, lineHeight: 30 }, style]}>
      {children}
    </Txt>
  );
}

function Lede({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Txt size={15} color={t.txtMid} style={[{ lineHeight: 21, marginTop: 10 }, style]}>
      {children}
    </Txt>
  );
}

function JudithLine({
  children,
  hint,
  style,
}: {
  children: React.ReactNode;
  hint?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          maxWidth: "88%",
          backgroundColor: hint ? t.surface1 : mix(t.accent, t.surface2, 0.14),
          borderWidth: 1,
          borderColor: hint ? t.hair2 : withAlpha(t.accent, 0.3),
          borderRadius: 18,
          borderBottomLeftRadius: 5,
          paddingVertical: 12,
          paddingHorizontal: 15,
        },
        style,
      ]}
    >
      <Txt size={15} color={hint ? t.txtLow : t.txtHi} style={{ lineHeight: 20 }}>
        {children}
      </Txt>
    </View>
  );
}

function Transcript({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          alignSelf: "flex-end",
          maxWidth: "84%",
          backgroundColor: t.surface3,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: 18,
          borderBottomRightRadius: 5,
          paddingVertical: 12,
          paddingHorizontal: 15,
        },
        style,
      ]}
    >
      <Txt size={15} style={{ lineHeight: 20 }}>
        {children}
      </Txt>
    </View>
  );
}

function Flag({ children }: { children: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: t.surface3,
        borderWidth: 1,
        borderColor: t.hair,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt size={26}>{children}</Txt>
    </View>
  );
}

function IcoBox({ name, color, size = 34 }: { name: string; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: t.hair,
        backgroundColor: t.surface3,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name as IconName} size={Math.round(size * 0.45)} color={color ?? t.txtMid} />
    </View>
  );
}

function RowCard({
  selected,
  onPress,
  children,
  showCheck,
}: {
  selected?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  showCheck?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          borderWidth: 1,
          borderColor: selected ? withAlpha(t.accent, 0.6) : t.hair,
          borderRadius: t.radius.md,
          backgroundColor: selected ? mix(t.accent, t.surface2, 0.14) : t.surface2,
          paddingVertical: 14,
          paddingHorizontal: 15,
        },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      {children}
      {showCheck && (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1.5,
            borderColor: selected ? t.accent : t.hair,
            backgroundColor: selected ? t.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && <Icon name="check" size={13} color={t.onAccent} />}
        </View>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* shared screen context                                               */
/* ------------------------------------------------------------------ */

interface Ctx {
  t: Theme;
  persona: PersonaId;
  setPersona: (p: PersonaId) => void;
  country: Country;
  setCountry: (code: string) => void;
  language: string;
  setLanguage: (code: string) => void;
  name: string;
  setName: (name: string) => void;
  bills: OnbBill[];
  addBill: (b: OnbBill) => void;
  next: () => void;
}

/* ------------------------------------------------------------------ */
/* Shared animation helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns true when the STT transcription is purely background-noise annotations
 * and contains no real speech. Strips parenthetical/bracketed sound descriptions
 * like "(beep)", "(footsteps thudding)", "[laughter]", etc., then checks whether
 * any letter/digit characters remain. Discarding these prevents noise from being
 * parsed as a bill entry or sent to Judith.
 */
function isNoiseTranscript(text: string): boolean {
  const stripped = text.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
  return (stripped.match(/[\p{L}\p{N}]/gu) ?? []).length < 2;
}

/**
 * Animated voice equaliser bars — prototype `.vo-wave.on i` / `voBar` keyframe.
 * Each bar loops height 7px → 24px → 7px (700ms), staggered by 100ms per bar.
 */
function VoiceBars({ accent, on = true }: { accent: string; on?: boolean }) {
  const heights = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(7)),
  ).current;

  useEffect(() => {
    if (!on) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const anims: Animated.CompositeAnimation[] = [];
    heights.forEach((h, i) => {
      const tid = setTimeout(() => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(h, {
              toValue: 24,
              duration: 350,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(h, {
              toValue: 7,
              duration: 350,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ]),
        );
        anims.push(loop);
        loop.start();
      }, i * 100);
      timers.push(tid);
    });
    return () => {
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.stop());
    };
  }, [on]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 26 }}>
      {heights.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            height: h,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome-word map (country code → native greeting for stamp screen) */
/* ------------------------------------------------------------------ */
const WELCOME_WORDS: Record<string, string> = {
  PH: "Mabuhay",        ID: "Selamat Datang",  MY: "Selamat Datang",
  SG: "Welcome",        TH: "ยินดีต้อนรับ",      VN: "Xin Chào",
  JP: "ようこそ",          KR: "환영합니다",         CN: "欢迎",
  HK: "歡迎",            TW: "歡迎",             IN: "स्वागत है",
  US: "Welcome",        CA: "Welcome",          MX: "Bienvenido",
  BR: "Bem-vindo",      AR: "Bienvenido",       CO: "Bienvenido",
  CL: "Bienvenido",     GB: "Welcome",          IE: "Welcome",
  ES: "Bienvenido",     PT: "Bem-vindo",        FR: "Bienvenue",
  DE: "Willkommen",     IT: "Benvenuto",        NL: "Welkom",
  BE: "Welkom",         SE: "Välkommen",        DK: "Velkommen",
  NO: "Velkommen",      FI: "Tervetuloa",       PL: "Witaj",
  CZ: "Vítejte",        SK: "Vitajte",          RO: "Bun venit",
  BG: "Добре дошли",    HR: "Dobrodošli",       GR: "Καλώς ήρθατε",
  HU: "Üdvözöljük",    UA: "Ласкаво просимо",  RU: "Добро пожаловать",
  TR: "Hoş geldiniz",   SA: "أهلاً وسهلاً",     AE: "أهلاً وسهلاً",
  EG: "أهلاً وسهلاً",   NG: "Ẹ Káàbọ̀",         ZA: "Welcome",
  AU: "Welcome",        NZ: "Welcome",
};

/* Per-country setup subtitle — avoids repeating "welcome" under the greeting. */
const WELCOME_SUBS: Record<string, string> = {
  PH: "Handa na kaming tumulong sa’yo.",
  ID: "Kami siap membantu kamu.",
  MY: "Kami sedia membantu anda.",
  VN: "Chúng tôi sẵn sàng giúp bạn.",
  TH: "เราพร้อมช่วยคุณแล้ว",
  SG: "Let’s sort your bills together.",
  IN: "We’re here to help you.",
  JP: "一緒に始めましょう。",
  KR: "함께 시작해 봅시다.",
  CN: "让我们一起开始吧。",
  HK: "一齊開始吧。",
  TW: "讓我們一起開始。",
  US: "Let’s sort your bills together.",
  CA: "Let’s sort your bills together.",
  GB: "Let’s sort your bills together.",
  AU: "Let’s sort your bills together.",
  NZ: "Let’s sort your bills together.",
};
const DEFAULT_WELCOME_SUB = "Let’s get you set up.";

/**
 * WordTransitionOverlay — country flag + welcome word stamps in.
 * Prototype: `.word-stamp` / `wordStamp` + `wordUp` keyframes.
 * Auto-dismisses after ~1.9s total.
 */
function WordTransitionOverlay({
  country,
  onDone,
  name,
  persona,
  language,
}: {
  country: Country;
  onDone: () => void;
  name: string;
  persona: PersonaId;
  language: string;
}) {
  const t    = useTheme();
  const word = WELCOME_WORDS[country.code] ?? "Welcome";
  const sub  = WELCOME_SUBS[country.code] ?? DEFAULT_WELCOME_SUB;

  useEffect(() => {
    const line = name ? `${word} ${name}` : word;
    synthOnboarding(line, persona, language)
      .then(({ audioBase64 }) => playBase64Mp3(audioBase64).catch(() => {}))
      .catch(() => {});
  }, []);

  const flagScale   = useRef(new Animated.Value(2.0)).current;
  const flagOpacity = useRef(new Animated.Value(0)).current;
  const wordScale   = useRef(new Animated.Value(2.0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wrapOpacity = useRef(new Animated.Value(1)).current;
  const shakeX      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const doShake = () =>
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 1,   duration: 40, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -1,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0.5, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0,   duration: 60, useNativeDriver: true }),
      ]).start();
    /* haptic + shake synced to each stamp impact */
    const h1 = setTimeout(() => { haptics.medium(); doShake(); }, 230);
    const h2 = setTimeout(() => { haptics.heavy(); doShake(); }, 560);
    /* flag stamp — 750ms spring, cubic-bezier(0.2, 1.6, 0.4, 1) */
    Animated.parallel([
      Animated.timing(flagOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(flagScale, {
        toValue: 1, duration: 750,
        easing: Easing.bezier(0.2, 1.6, 0.4, 1), useNativeDriver: true,
      }),
    ]).start();

    /* word stamp — 750ms spring, delay 300ms */
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(wordScale, {
          toValue: 1, duration: 750,
          easing: Easing.bezier(0.2, 1.6, 0.4, 1), useNativeDriver: true,
        }),
      ]),
    ]).start();

    /* hold for 2.8s total, then fade out */
    const timer = setTimeout(() => {
      Animated.timing(wrapOpacity, { toValue: 0, duration: 500, useNativeDriver: true })
        .start(({ finished }) => { if (finished) onDone(); });
    }, 2800);
    return () => { clearTimeout(timer); clearTimeout(h1); clearTimeout(h2); };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60,
        opacity: wrapOpacity, backgroundColor: t.canvas,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Animated.View style={{ alignItems: "center", gap: 6, transform: [{ translateX: shakeX.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }] }}>
        <Animated.Text
          style={{ fontSize: 44, opacity: flagOpacity, transform: [{ scale: flagScale }] }}
        >
          {country.flag}
        </Animated.Text>
        <Animated.Text
          style={{
            fontSize: 58, fontFamily: t.fonts.display, letterSpacing: -0.5,
            color: t.accent, opacity: wordOpacity, transform: [{ scale: wordScale }],
          }}
        >
          {word}!
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Question-mark transition (after late-fee hook, before problem)      */
/* ------------------------------------------------------------------ */
const QM_MARKS = [
  { leftPct: 0.12, fontSize: 64, duration: 1100, delay:   0, angle: -8 },
  { leftPct: 0.38, fontSize: 96, duration: 1300, delay: 120, angle:  5 },
  { leftPct: 0.65, fontSize: 48, duration:  950, delay: 250, angle: -12 },
  { leftPct: 0.22, fontSize: 40, duration: 1050, delay: 180, angle: 10 },
  { leftPct: 0.78, fontSize: 56, duration: 1200, delay:  80, angle: -5 },
  { leftPct: 0.50, fontSize: 32, duration:  800, delay: 330, angle:  8 },
];

/**
 * QuestionTransitionOverlay — ? marks bubble up from below.
 * Prototype: `.qm-wrap` / `.qmRise` / `.qmVeil` keyframes.
 */
function QuestionTransitionOverlay({ onDone }: { onDone: () => void }) {
  const t               = useTheme();
  const { width, height } = useWindowDimensions();
  const veilOpacity  = useRef(new Animated.Value(0)).current;
  const translations = useRef(QM_MARKS.map(() => new Animated.Value(0))).current;
  const opacities    = useRef(QM_MARKS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    /* veil: 0 → 0.92 (25%) | hold | 0.92 → 0 (last 25%) over 1250ms */
    Animated.sequence([
      Animated.timing(veilOpacity, { toValue: 0.92, duration: 312, useNativeDriver: true }),
      Animated.timing(veilOpacity, { toValue: 0.92, duration: 626, useNativeDriver: true }),
      Animated.timing(veilOpacity, { toValue: 0,    duration: 312, useNativeDriver: true }),
    ]).start();

    QM_MARKS.forEach((qm, i) => {
      const rise = -(height * 1.15);
      Animated.sequence([
        Animated.delay(qm.delay),
        Animated.parallel([
          Animated.timing(translations[i], {
            toValue: rise, duration: qm.duration,
            easing: Easing.bezier(0.4, 0, 0.4, 1), useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacities[i], { toValue: 1, duration: Math.round(qm.duration * 0.20), useNativeDriver: true }),
            Animated.timing(opacities[i], { toValue: 1, duration: Math.round(qm.duration * 0.70), useNativeDriver: true }),
            Animated.timing(opacities[i], { toValue: 0, duration: Math.round(qm.duration * 0.10), useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });

    const timer = setTimeout(onDone, 1400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, overflow: "hidden" }}
    >
      <Animated.View
        style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: t.canvas, opacity: veilOpacity,
        }}
      />
      {QM_MARKS.map((qm, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            top: height + 20,
            left: Math.round(qm.leftPct * width),
            fontSize: qm.fontSize,
            fontFamily: t.fonts.bold,
            color: t.accent,
            opacity: opacities[i],
            transform: [
              { translateY: translations[i] },
              { rotate: `${qm.angle}deg` },
            ],
            textShadowColor: t.accent,
            textShadowRadius: 18,
            textShadowOffset: { width: 0, height: 0 },
          }}
        >
          ?
        </Animated.Text>
      ))}
    </View>
  );
}

/* ================================================================== */
/* 1. Welcome                                                          */
/* ================================================================== */

function ScreenWelcome({ ctx }: { ctx: Ctx }) {
  useOnbVoice("Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?", ctx.persona, ctx.language);
  const popScale   = useRef(new Animated.Value(0.8)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(popOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(popScale,   { toValue: 1, duration: 500, easing: Easing.bezier(0.2, 0.9, 0.3, 1.2), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <>
      <Scroll center>
        <View style={{ alignItems: "center" }}>
          <JudithAvatar persona={ctx.persona} size={140} state="listening" />
        </View>
        <Kicker style={{ marginTop: 30, textAlign: "center" }}>Meet Judith</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>
          Your bills, handled — before they’re ever late.
        </Title>

      </Scroll>
      <CtaBar>
        <Animated.View style={{ opacity: popOpacity, transform: [{ scale: popScale }] }}>
          <Btn label={T("getstarted")} onPress={ctx.next} />
        </Animated.View>
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* 2. Country                                                          */
/* ================================================================== */

function ScreenCountry({ ctx }: { ctx: Ctx }) {
  const { t, country, setCountry, next, name, persona, language } = ctx;
  const [q, setQ] = useState("");
  const list = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Scroll>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Icon name="globe" size={13} color={t.accent} />
          <Kicker style={{ marginBottom: 0, marginLeft: 6 }}>Step 1</Kicker>
        </View>
        <Title>{T("countryT")}</Title>
        <Lede style={{ marginBottom: 16 }}>{T("countryL")}</Lede>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={T("countrySearch")}
          placeholderTextColor={t.txtLow}
          style={{
            width: "100%",
            borderWidth: 1,
            borderColor: t.hair,
            backgroundColor: t.surface1,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            color: t.txtHi,
            fontFamily: t.fonts.regular,
            fontSize: 15,
            marginBottom: 14,
          }}
        />
        <View style={{ gap: 9 }}>
          {list.map((c) => {
            const on = country.code === c.code;
            return (
              <RowCard key={c.code} selected={on} onPress={() => setCountry(c.code)} showCheck>
                <Flag>{c.flag}</Flag>
                <View style={{ flex: 1 }}>
                  <Txt size={14} weight="medium">{c.name}</Txt>
                  <Mono size={12} weight="medium" color={t.txtLow} style={{ marginTop: 2 }}>
                    {c.cur} · {c.code}
                  </Mono>
                </View>
              </RowCard>
            );
          })}
        </View>
      </Scroll>
      <CtaBar>
        <Btn label={T("continue")} onPress={next} style={{ opacity: country ? 1 : 0.4 }} />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* 3. Language (spoken voice language)                                 */
/* ================================================================== */

function ScreenLanguage({ ctx }: { ctx: Ctx }) {
  const { t, persona, next, language, setLanguage, name } = ctx;
  useOnbVoice("Take control of your bills, take control of your life.", persona, language);
  const [voiceLang, setVoiceLang] = useState(language || "en");
  const [speaking, setSpeaking] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const langReqId = useRef(0);

  const filSample = (code: string) => {
    if (isFilipino(code)) {
      return `Tara! Ayusin natin ang mga bills mo${name ? ` ${name}` : ""}.`;
    }
    return langSample(code);
  };

  const playSample = async (code: string) => {
    haptics.light();
    const id = ++langReqId.current;
    setVoiceLang(code);
    setLanguage(code);
    setSpeaking(true);
    try {
      const { audioBase64 } = await synthOnboarding(filSample(code), persona, code);
      if (id !== langReqId.current) return;
      await playBase64Mp3(audioBase64);
    } catch {
      /* silently skip if TTS unavailable */
    } finally {
      if (id === langReqId.current) setSpeaking(false);
    }
  };

  const query = q.trim().toLowerCase();
  const list = LANGUAGES.filter((l) => {
    if (!query) return true;
    if (
      l.label.toLowerCase().includes(query) ||
      l.native.toLowerCase().includes(query)
    )
      return true;
    return (l.dialects ?? []).some(
      (d) =>
        d.label.toLowerCase().includes(query) ||
        d.native.toLowerCase().includes(query),
    );
  });

  const playDot = (active: boolean) => (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: withAlpha(t.accent, 0.45),
        backgroundColor: mix(t.accent, t.surface1, 0.14),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {active && speaking && <PulseRing color={t.accent} />}
      <Icon name={active && speaking ? "spark" : "play"} size={15} color={t.accent} />
    </View>
  );

  return (
    <>
      <Scroll>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Icon name="mic" size={13} color={t.accent} />
          <Kicker style={{ marginBottom: 0, marginLeft: 6 }}>Step 2</Kicker>
        </View>
        <Title>What language should Judith speak?</Title>
        <Lede style={{ marginBottom: 16 }}>
          Her reminders, in a language that feels like home. The app itself stays in English.
        </Lede>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <JudithAvatar persona={persona} size={56} state={speaking ? "speaking" : "idle"} />
          <JudithLine hint={!speaking} style={{ flex: 1 }}>
            {speaking ? filSample(voiceLang) : "Tap ▸ to hear me in any language or dialect."}
          </JudithLine>
        </View>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search 30+ languages"
          placeholderTextColor={t.txtLow}
          style={{
            width: "100%",
            borderWidth: 1,
            borderColor: t.hair,
            backgroundColor: t.surface1,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            color: t.txtHi,
            fontFamily: t.fonts.regular,
            fontSize: 15,
            marginBottom: 14,
          }}
        />

        <View style={{ gap: 9 }}>
          {list.map((l) => {
            const hasDialects = !!l.dialects && l.dialects.length > 0;
            const dialectCode = (l.dialects ?? []).some((d) => d.code === voiceLang);
            const on = voiceLang === l.code || dialectCode;
            const isOpen = expanded === l.code || (hasDialects && dialectCode);
            return (
              <View key={l.code} style={{ gap: 9 }}>
                <RowCard
                  selected={on}
                  showCheck={!hasDialects}
                  onPress={() => {
                    if (hasDialects) {
                      setExpanded(isOpen ? null : l.code);
                      void playSample(l.code);
                    } else {
                      void playSample(l.code);
                    }
                  }}
                >
                  {playDot(voiceLang === l.code)}
                  <Flag>{l.flag}</Flag>
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="medium">{l.native}</Txt>
                    <Low size={12} style={{ marginTop: 2 }}>
                      {hasDialects ? `${l.dialects!.length} dialects · ${langDesc(l.code)}` : langDesc(l.code)}
                    </Low>
                  </View>
                  {hasDialects && (
                    <View style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}>
                      <Icon name="chev" size={16} color={t.txtLow} />
                    </View>
                  )}
                </RowCard>

                {hasDialects && isOpen && (
                  <View style={{ gap: 9, marginLeft: 20 }}>
                    {l.dialects!.map((d) => {
                      const don = voiceLang === d.code;
                      return (
                        <RowCard key={d.code} selected={don} onPress={() => playDialect(d.code)} showCheck>
                          {playDot(don)}
                          <View style={{ flex: 1 }}>
                            <Txt size={13.5} weight="medium">{d.label}</Txt>
                            <Low size={12} style={{ marginTop: 2 }}>{d.native} · {d.desc}</Low>
                          </View>
                        </RowCard>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Scroll>
      <CtaBar>
        <Btn label={T("continue")} onPress={() => { setLanguage(voiceLang); next(); }} />
      </CtaBar>
    </>
  );

  function playDialect(code: string) {
    void playSample(code);
  }
}

/* ================================================================== */
/* 4. Persona                                                          */
/* ================================================================== */

/** Filipino persona sample lines (spoken on tap). Professional and mom use the user's name. */
const PERSONA_FIL_SAMPLES: Record<PersonaId, (name: string) => string> = {
  pro: (n) => `Hi ${n || ""}${n ? "," : ""} i'm happy to help you po sa mga bayarin mo.`.trim(),
  funny: () => "Adulting na tayo talaga friendship! Bayad bayad din pag may time!",
  sib: () => "Luh??!!? Totoo ba yan?! Nag babayad ka na ng bills?",
  mama: (n) => `${n ? `${n}, ` : ""}wag kalimutan ang mga bills. Be responsible! Wag din kalimutang mag pahinga.`,
  marites: (n) => `${n ? `Uy ${n},` : "Uy,"} may chismis ako sa'yo — lahat ng bills mo, alam ko na! Grabe, 'di ba? Judith na 'to!`,
};

function ScreenPersona({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, name, setPersona, next } = ctx;
  const [speakId, setSpeakId] = useState<PersonaId | null>(null);
  const visiblePersonas = PERSONAS.filter(p => !p.phOnly || ctx.country.code === "PH");
  const selected = visiblePersonas.find((p) => p.id === persona);
  const personaReqId = useRef(0);

  // Prefetch visible persona samples the moment this screen mounts so
  // "Play voice" taps are instant (hits the in-memory cache, no network round-trip).
  useEffect(() => {
    if (!isFilipino(language)) {
      visiblePersonas.forEach((p) => { fetchSampleOnboarding(p.id, language).catch(() => {}); });
    }
  }, []);

  const playLine = async (id: PersonaId) => {
    haptics.light();
    const reqId = ++personaReqId.current;
    setPersona(id);
    setSpeakId(id);
    try {
      let audioBase64: string;
      if (isFilipino(language)) {
        const text = PERSONA_FIL_SAMPLES[id](name);
        ({ audioBase64 } = await synthOnboarding(text, id, language));
      } else {
        ({ audioBase64 } = await fetchSampleOnboarding(id, language));
      }
      if (reqId !== personaReqId.current) return;
      await playBase64Mp3(audioBase64);
    } catch {
      /* silently skip if TTS unavailable */
    } finally {
      if (reqId === personaReqId.current) setSpeakId(null);
    }
  };

  return (
    <>
      <Scroll>
        <Kicker>Step 3</Kicker>
        <Title>{T("personaT")}</Title>
        <Lede style={{ marginBottom: 16 }}>{T("personaL")}</Lede>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.gap }}>
          {visiblePersonas.map((p) => {
            const on = persona === p.id;
            const isFullRow = !!p.phOnly;
            return (
              <Pressable
                key={p.id}
                onPress={() => playLine(p.id)}
                style={{
                  width: isFullRow ? "100%" : `${(100 - 4) / 2}%` as `${number}%`,
                  flexDirection: isFullRow ? "row" : "column",
                  alignItems: isFullRow ? "center" : "flex-start",
                  borderWidth: 1,
                  borderColor: on ? withAlpha(t.accent, 0.6) : t.hair,
                  borderRadius: t.radius.md,
                  backgroundColor: t.surface2,
                  padding: 15,
                  gap: 10,
                  transform: [{ translateY: on ? -2 : 0 }],
                  shadowColor: t.accent,
                  shadowOpacity: on ? 0.34 : 0,
                  shadowRadius: on ? 14 : 0,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: on ? 6 : 0,
                }}
              >
                <JudithAvatar persona={p.id} size={52} state={speakId === p.id ? "speaking" : "idle"} />
                <View style={isFullRow ? { flex: 1 } : undefined}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Txt size={15} weight="semibold">{p.name}</Txt>
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
                  <Low size={12} style={{ marginTop: 2 }}>{p.vibe}</Low>
                </View>
                <View
                  style={{
                    alignSelf: isFullRow ? "center" : "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    borderWidth: 1,
                    borderColor: on ? t.accent : t.hair,
                    borderRadius: 22,
                    paddingVertical: 6,
                    paddingHorizontal: 11,
                  }}
                >
                  <Icon name="mic" size={13} color={on ? t.accent : t.txtMid} />
                  <Txt size={12} color={on ? t.accent : t.txtMid}>{T("play")}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
        {selected && (
          <JudithLine style={{ marginTop: 16, alignSelf: "stretch", maxWidth: "100%" }}>
            {selected.line}
          </JudithLine>
        )}
      </Scroll>
      <CtaBar>
        <Btn label={T("continue")} onPress={next} style={{ opacity: persona ? 1 : 0.4 }} />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* 4b. Name                                                            */
/* ================================================================== */

function ScreenName({ ctx }: { ctx: Ctx }) {
  const { t, persona, name, setName, next } = ctx;
  useOnbVoice("One more thing — what should I call you?", persona, ctx.language);
  const [val, setVal] = useState(name);
  const trimmed = val.trim();
  const submit = () => {
    setName(trimmed);
    next();
  };
  return (
    <>
      <Scroll center>
        <View style={{ alignItems: "center" }}>
          <JudithAvatar persona={persona} size={96} state="listening" />
        </View>
        <Kicker style={{ marginTop: 22, textAlign: "center" }}>Nice to meet you</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>
          What should I call you?
        </Title>
        <Lede style={{ maxWidth: 280, textAlign: "center" }}>
          I’ll use your name to keep things personal — never shared with anyone.
        </Lede>
        <TextInput
          value={val}
          onChangeText={setVal}
          placeholder="Your name"
          placeholderTextColor={t.txtLow}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
          maxLength={24}
          returnKeyType="done"
          onSubmitEditing={() => { if (trimmed) submit(); }}
          style={{
            width: "100%",
            maxWidth: 320,
            marginTop: 22,
            borderWidth: 1,
            borderColor: trimmed ? t.accent : t.hair,
            backgroundColor: t.surface1,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
            color: t.txtHi,
            fontFamily: t.fonts.medium,
            fontSize: 17,
            textAlign: "center",
          }}
        />
      </Scroll>
      <CtaBar>
        <Btn
          label={T("continue")}
          onPress={() => { if (trimmed) submit(); }}
          style={{ opacity: trimmed ? 1 : 0.4 }}
        />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* 5. Late fee (alert variant, persona=pro)                            */
/* ================================================================== */

function ScreenLateFee({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, next } = ctx;
  const cur = ctx.country.cur;
  const latefeeIsFil = isFilipino(language);
  useOnbVoice(JUDITH_VOICE.lateFee[persona][latefeeIsFil ? "fil" : "en"], persona, language);
  // lockDrop: notification slides down from above on mount (prototype lockDrop keyframe)
  const dropOpacity = useRef(new Animated.Value(0)).current;
  const dropY       = useRef(new Animated.Value(-12)).current;
  const dropScale   = useRef(new Animated.Value(0.97)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(dropOpacity, { toValue: 1, duration: 550, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }),
      Animated.timing(dropY,       { toValue: 0, duration: 550, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }),
      Animated.timing(dropScale,   { toValue: 1, duration: 550, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <>
      <Scroll center>
        <Animated.View
          style={{
            opacity: dropOpacity,
            transform: [{ translateY: dropY }, { scale: dropScale }],
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
            width: "100%",
            maxWidth: 300,
            paddingVertical: 13,
            paddingHorizontal: 15,
            borderRadius: 16,
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hair,
            marginBottom: 22,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(t.semantic.urgent, 0.18),
              borderWidth: 1,
              borderColor: withAlpha(t.semantic.urgent, 0.4),
            }}
          >
            <Icon name="card" size={18} color={t.semantic.urgent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={13} weight="semibold">Late payment fee</Txt>
            <Low size={11}>Posted to your account</Low>
          </View>
          <Mono size={15} weight="bold" color={t.semantic.urgent}>−{cur}500</Mono>
        </Animated.View>
        <JudithAvatar persona={persona} size={84} state="speaking" />
        <Title style={{ maxWidth: 300, marginTop: 16, textAlign: "center" }}>
          Missed a bill — and{" "}
          <Txt size={27} weight="semibold" color={t.semantic.urgent} style={{ textDecorationLine: "underline" }}>
            paid
          </Txt>{" "}
          for it?
        </Title>
      </Scroll>
      <CtaBar>
        <Btn label="Keep me on time" onPress={next} />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* 6. Problem                                                          */
/* ================================================================== */

function ScreenProblem({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, next } = ctx;
  const problemIsFil = isFilipino(language);
  useOnbVoice(JUDITH_VOICE.problem[persona][problemIsFil ? "fil" : "en"], persona, language);
  const cur = ctx.country.cur;
  const [answered, setAnswered] = useState<boolean | null>(null);
  const rows = [
    { icon: "zap", cat: "Electricity" },
    { icon: "droplet", cat: "Water" },
    { icon: "wifi", cat: "Internet" },
    { icon: "smartphone", cat: "Mobile" },
    { icon: "card", cat: "Credit card" },
    { icon: "spark", cat: "Netflix" },
    { icon: "spark", cat: "Spotify" },
    { icon: "spark", cat: "iCloud+" },
  ];

  /* fault animation refs */
  const shakeX        = useRef(new Animated.Value(0)).current;
  const flashOpa      = useRef(new Animated.Value(0)).current;
  const barScaleX     = useRef(new Animated.Value(0)).current;
  const barOpa        = useRef(new Animated.Value(0)).current;

  const choose = (knows: boolean) => {
    if (answered !== null) return;
    setAnswered(knows);
    if (knows) { haptics.light(); setTimeout(next, 480); return; }

    haptics.error();
    /* faultShake × 2 + faultFlash + faultBar, then advance */
    const oneShake = Animated.sequence([
      Animated.timing(shakeX, { toValue: -9, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  8, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  4, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  0, duration: 150, useNativeDriver: true }),
    ]);
    const flash = Animated.sequence([
      Animated.timing(flashOpa, { toValue: 1,    duration: 150, useNativeDriver: true }),
      Animated.timing(flashOpa, { toValue: 0.55, duration: 125, useNativeDriver: true }),
      Animated.timing(flashOpa, { toValue: 0.95, duration: 125, useNativeDriver: true }),
      Animated.timing(flashOpa, { toValue: 0.9,  duration: 287, useNativeDriver: true }),
      Animated.timing(flashOpa, { toValue: 0,    duration: 563, useNativeDriver: true }),
    ]);
    const bar = Animated.sequence([
      Animated.parallel([
        Animated.timing(barScaleX, { toValue: 1,    duration: 175, useNativeDriver: true }),
        Animated.timing(barOpa,    { toValue: 1,    duration: 175, useNativeDriver: true }),
      ]),
      Animated.delay(512),
      Animated.parallel([
        Animated.timing(barScaleX, { toValue: 1.04, duration: 563, useNativeDriver: true }),
        Animated.timing(barOpa,    { toValue: 0,    duration: 563, useNativeDriver: true }),
      ]),
    ]);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -9, duration: 50,  useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  8, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -6, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  4, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  0, duration: 150, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -9, duration: 50,  useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  8, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -6, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  4, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  0, duration: 150, useNativeDriver: true }),
      ]),
      flash,
      bar,
    ]).start(() => setTimeout(next, 350));
  };
  return (
    <>
      <Scroll center>
        <JudithAvatar persona={persona} size={64} state="idle" />
        <Kicker style={{ textAlign: "center", marginTop: 14 }}>Quick question</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>
          Do you know your total bills due next month?
        </Title>
        <Animated.View style={{ transform: [{ translateX: shakeX }], width: "100%" }}>
          <Card style={{ width: "100%", maxWidth: 300, marginVertical: 22, alignItems: "center", paddingVertical: 22, paddingHorizontal: 18, alignSelf: "center" }}>
            <Low size={12}>Due next month</Low>
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
              <Mono size={46} weight="bold">{cur}</Mono>
              <Mono size={46} weight="bold" color={t.txtLow}>?,???</Mono>
            </View>
            <View style={{ width: "100%", gap: 10, marginTop: 18 }}>
              {rows.map((r, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon name={r.icon as IconName} size={13} color={t.txtMid} />
                  <Txt size={13} style={{ flex: 1 }}>{r.cat}</Txt>
                  <Mono size={13} color={t.txtLow}>{cur}•••</Mono>
                </View>
              ))}
              <Low size={12} style={{ textAlign: "center" }}>
                + every other subscription you forgot
              </Low>
            </View>
          </Card>
        </Animated.View>
      </Scroll>
      <CtaBar>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn label="Yes, roughly" variant="soft" onPress={() => choose(true)} style={{ flex: 1 }} />
          <Btn label="Honestly, no" onPress={() => choose(false)} style={{ flex: 1 }} />
        </View>
      </CtaBar>
      {/* faultFlash overlay */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          opacity: flashOpa,
          backgroundColor: withAlpha(t.semantic.urgent, 0.22),
          zIndex: 20,
        }}
      />
      {/* faultBar — horizontal scan line at vertical centre */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", left: 0, right: 0,
          top: "50%",
          height: 2,
          backgroundColor: t.semantic.urgent,
          shadowColor: t.semantic.urgent,
          shadowOpacity: 0.8,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 0 },
          opacity: barOpa,
          transform: [{ scaleX: barScaleX }],
          zIndex: 21,
        }}
      />
    </>
  );
}

/* ================================================================== */
/* 7. Stakes (the fork)                                                */
/* ================================================================== */

function ScreenStakes({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, next } = ctx;
  const cur = ctx.country.cur;
  const stakesIsFil = isFilipino(language);
  useOnbVoice(JUDITH_VOICE.stakes[persona][stakesIsFil ? "fil" : "en"], persona, language);
  const [committed, setCommitted] = useState(false);

  /* commit animation values — mirrors prototype `.commit-*` keyframes */
  const boxScale    = useRef(new Animated.Value(0.25)).current;
  const boxOpacity  = useRef(new Animated.Value(0)).current;
  const youScale    = useRef(new Animated.Value(0)).current;
  const youOpacity  = useRef(new Animated.Value(0)).current;
  const youRotate   = useRef(new Animated.Value(-6)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;
  const lineY       = useRef(new Animated.Value(12)).current;
  const ctrlOpacity = useRef(new Animated.Value(0)).current;
  const ctrlY       = useRef(new Animated.Value(14)).current;
  const todayOpacity = useRef(new Animated.Value(0)).current;
  const todayY       = useRef(new Animated.Value(12)).current;
  const ulineScale   = useRef(new Animated.Value(0)).current;

  const commit = () => {
    setCommitted(true);
    haptics.medium();
    setTimeout(() => haptics.light(), 1500);
    setTimeout(() => haptics.heavy(), 5500);
    const fadeUp = (opacity: Animated.Value, y: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 500, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true }),
          Animated.timing(y,       { toValue: 0, duration: 500, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true }),
        ]),
      ]);
    Animated.parallel([
      /* commitBoxIn: scale 0.25 → 1.08 → 1, opacity 0 → 1 (0.8s), then fade OUT at 1.1s */
      Animated.sequence([
        Animated.parallel([
          Animated.timing(boxOpacity, { toValue: 1,    duration: 440, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(boxScale, { toValue: 1.08, duration: 624, easing: Easing.bezier(0.2, 0.9, 0.3, 1.15), useNativeDriver: true }),
            Animated.timing(boxScale, { toValue: 1,    duration: 176, useNativeDriver: true }),
          ]),
        ]),
        /* hold briefly then fade the card away so Phase 2 text has a clean canvas */
        Animated.delay(250),
        Animated.timing(boxOpacity, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      /* "You" — commitYouIn: stamp from scale 0, rotate −6°→0, delay 1.5s (after box fade-out) */
      Animated.sequence([
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(youOpacity, { toValue: 1,    duration: 350, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(youScale, { toValue: 1.25, duration: 385, easing: Easing.bezier(0.2, 0.9, 0.3, 1.3), useNativeDriver: true }),
            Animated.timing(youScale, { toValue: 1,    duration: 315, useNativeDriver: true }),
          ]),
          Animated.timing(youRotate, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      ]),
      /* "will start taking" — commitFadeUp at 2.7s */
      fadeUp(lineOpacity, lineY, 2700),
      /* "control" — commitCtrlIn at 3.3s */
      fadeUp(ctrlOpacity, ctrlY, 3300),
      /* "today" — commitFadeUp at 4.9s */
      fadeUp(todayOpacity, todayY, 4900),
      /* underline scaleX 0→1 at 5.5s (commitUline) */
      Animated.sequence([
        Animated.delay(5500),
        Animated.timing(ulineScale, { toValue: 1, duration: 600, easing: Easing.bezier(0.6, 0, 0.3, 1), useNativeDriver: true }),
      ]),
    ]).start(() => setTimeout(next, 2000));
  };

  return (
    <>
      <Scroll center>
        <JudithAvatar persona={persona} size={64} state="idle" />
        <Kicker style={{ textAlign: "center", marginTop: 14 }}>The fork</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>
          Let’s avoid late fees and start taking control
        </Title>
        <View style={{ flexDirection: "row", alignItems: "stretch", width: "100%", maxWidth: 320, marginVertical: 26 }}>
          <View
            style={{
              flex: 1,
              alignItems: "center",
              gap: 7,
              paddingVertical: 18,
              paddingHorizontal: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: withAlpha(t.semantic.urgent, 0.35),
              backgroundColor: mix(t.semantic.urgent, t.surface2, 0.1),
            }}
          >
            <Txt size={12} weight="semibold" color={t.txtMid} style={{ letterSpacing: 0.4, textTransform: "uppercase" }}>Keep going</Txt>
            <View style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: withAlpha(t.semantic.urgent, 0.4), alignItems: "center", justifyContent: "center" }}>
              <Icon name="trenddown" size={20} color={t.semantic.urgent} />
            </View>
            <Mono size={22} weight="bold" color={t.semantic.urgent}>−{cur}4,800+</Mono>
            <Low size={11}>more fees, every year</Low>
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.hair2, alignItems: "center" }}>
              <Icon name="faceAnxious" size={30} color={t.semantic.urgent} />
            </View>
            <Txt size={11} color={t.txtMid} style={{ marginTop: 5, textAlign: "center" }}>Anxious, always behind</Txt>
          </View>
          <View style={{ alignSelf: "center", paddingHorizontal: 10 }}>
            <Txt size={12} color={t.txtLow} style={{ fontStyle: "italic" }}>or</Txt>
          </View>
          <View
            style={{
              flex: 1,
              alignItems: "center",
              gap: 7,
              paddingVertical: 18,
              paddingHorizontal: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: withAlpha(t.semantic.ok, 0.38),
              backgroundColor: mix(t.semantic.ok, t.surface2, 0.1),
            }}
          >
            <Txt size={12} weight="semibold" color={t.txtMid} style={{ letterSpacing: 0.4, textTransform: "uppercase" }}>Start today</Txt>
            <View style={{ width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: withAlpha(t.semantic.ok, 0.4), alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={20} color={t.semantic.ok} />
            </View>
            <Mono size={22} weight="bold" color={t.semantic.ok}>{cur}0</Mono>
            <Low size={11}>in late fees</Low>
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.hair2, alignItems: "center" }}>
              <Icon name="faceCalm" size={30} color={t.semantic.ok} />
            </View>
            <Txt size={11} color={t.txtMid} style={{ marginTop: 5, textAlign: "center" }}>Calm, in control</Txt>
          </View>
        </View>
      </Scroll>
      <CtaBar>
        <Btn label="Shall we?" onPress={commit} />
      </CtaBar>

      {/* CommitTransition overlay — `.commit-wrap` / `.commit-card` from prototype */}
      {committed && (
        <View
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
            justifyContent: "center", alignItems: "center",
            backgroundColor: t.canvas,
          }}
        >
          {/* radial accent glow behind card */}
          <View
            style={{
              position: "absolute", width: "140%", height: "55%", left: "-20%", top: "22%",
              backgroundColor: withAlpha(t.accent, 0.07), borderRadius: 999,
              transform: [{ scaleY: 0.4 }],
            }}
          />

          {/* Phase 1: green "Start today" box zooms in (.commit-box / commitBoxIn) */}
          <Animated.View
            style={{
              position: "absolute",
              opacity: boxOpacity,
              transform: [{ scale: boxScale }],
              width: 190, paddingVertical: 26, paddingHorizontal: 18, borderRadius: 22,
              borderWidth: 1, borderColor: withAlpha(t.semantic.ok, 0.45),
              backgroundColor: mix(t.semantic.ok, t.surface2, 0.12),
              alignItems: "center", gap: 8,
              shadowColor: t.semantic.ok, shadowOpacity: 0.7, shadowRadius: 60, shadowOffset: { width: 0, height: 24 },
            }}
          >
            <Txt size={12} weight="semibold" color={t.txtMid} style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>Start today</Txt>
            <View style={{ width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: withAlpha(t.semantic.ok, 0.4), alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={22} color={t.semantic.ok} />
            </View>
            <Mono size={30} weight="bold" color={t.semantic.ok}>{cur}0</Mono>
            <Low size={12}>in late fees</Low>
          </Animated.View>

          {/* Phase 2: commit-card text ("You will start taking control today") */}
          <View style={{ alignItems: "center", gap: 0 }}>
            {/* "You" — Playfair Display italic, green, commitYouIn stamp */}
            <Animated.Text
              style={{
                fontFamily: t.fonts.display,
                fontSize: 64, lineHeight: 68,
                color: t.semantic.ok,
                textShadowColor: withAlpha(t.semantic.ok, 0.5),
                textShadowRadius: 34,
                textShadowOffset: { width: 0, height: 0 },
                opacity: youOpacity,
                transform: [
                  { scale: youScale },
                  { rotate: youRotate.interpolate({ inputRange: [-6, 0], outputRange: ["-6deg", "0deg"] }) },
                ],
              }}
            >
              You
            </Animated.Text>

            {/* "will start taking" — commitFadeUp at 1.7s */}
            <Animated.Text
              style={{
                fontFamily: t.fonts.medium,
                fontSize: 20, color: t.txtMid,
                opacity: lineOpacity,
                transform: [{ translateY: lineY }],
              }}
            >
              will start taking
            </Animated.Text>

            {/* "control" — Playfair Display italic, commitCtrlIn at 2.3s */}
            <Animated.Text
              style={{
                fontFamily: t.fonts.display,
                fontSize: 60, lineHeight: 66,
                color: t.txtHi,
                textShadowColor: withAlpha(t.accent, 0.45),
                textShadowRadius: 32,
                textShadowOffset: { width: 0, height: 0 },
                opacity: ctrlOpacity,
                transform: [{ translateY: ctrlY }],
              }}
            >
              control
            </Animated.Text>

            {/* "today" + animated underline — commitFadeUp at 3.9s */}
            <Animated.View
              style={{
                alignItems: "center",
                opacity: todayOpacity,
                transform: [{ translateY: todayY }],
                marginTop: 4,
              }}
            >
              <Txt size={32} weight="bold" color={t.accent} style={{ letterSpacing: -0.3 }}>
                today
              </Txt>
              {/* commitUline: scaleX 0→1 at 4.5s */}
              <Animated.View
                style={{
                  height: 3, width: 110, borderRadius: 3,
                  backgroundColor: t.accent,
                  shadowColor: t.accent, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
                  transform: [{ scaleX: ulineScale }],
                  transformOrigin: "left",
                  marginTop: -2,
                }}
              />
            </Animated.View>
          </View>
        </View>
      )}
    </>
  );
}

/* ================================================================== */
/* 8. Intro                                                            */
/* ================================================================== */


function ScreenIntro({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, next } = ctx;
  const isFil = isFilipino(language);
  useOnbVoice(JUDITH_VOICE.intro[persona][isFil ? "fil" : "en"], persona, language);
  return (
    <>
      <Scroll center>
        <JudithAvatar persona={persona} size={76} state="speaking" />
        <View style={{ marginTop: 12 }}>
          <VoiceBars accent={t.accent} />
        </View>
        <Kicker style={{ marginTop: 14, textAlign: "center" }}>Before we start</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>
          Do you have 5–7 minutes now to map your whole bill picture?
        </Title>
        <Lede style={{ maxWidth: 290, textAlign: "center" }}>
          More bills than most? It may take a little longer — worth it.
        </Lede>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 22,
            maxWidth: 300,
            paddingVertical: 9,
            paddingHorizontal: 13,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: withAlpha(t.semantic.ok, 0.32),
            backgroundColor: mix(t.semantic.ok, t.canvas, 0.11),
          }}
        >
          <Icon name="check" size={14} color={t.semantic.ok} />
          <Txt size={12.5} color={t.semantic.ok} style={{ flex: 1, lineHeight: 17 }}>
            Saved as you go — close anytime and you’ll pick up right here.
          </Txt>
        </View>
      </Scroll>
      <CtaBar>
        <Btn label="I’ve got time — let’s go" onPress={next} />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* 9. Voice add-bill (§6)                                              */
/* ================================================================== */

type VMode =
  | "prompt"
  | "listening"
  | "transcribing"
  | "parsed"
  | "manualCats"
  | "manualForm"
  | "breather"
  | "more"
  | "count"
  | "done";

function highlight(text: string, toks: string[], accent: string): React.ReactNode {
  const valid = (toks || []).filter(Boolean);
  if (!valid.length) return text;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(" + valid.map(esc).join("|") + ")", "gi");
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Txt key={k++} size={15} weight="semibold" color={accent} style={{ backgroundColor: withAlpha(accent, 0.18) }}>
        {m[0]}
      </Txt>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function ScreenVoiceAdd({ ctx }: { ctx: Ctx }) {
  const SAMPLES        = getSamples(ctx.country.code);
  const CARD_TEMPLATES = getCardTemplates(ctx.country.code);
  const LOAN_TEMPLATES = getLoanTemplates(ctx.country.code);
  const { t, persona, bills, addBill, next, language } = ctx;
  const { saveBill } = useJudith();
  const cur = ctx.country.cur;
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  // ── Voice Activity Detection refs ─────────────────────────────────
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; hasSpeech: boolean }>({ timer: null, hasSpeech: false });
  const clearVad = () => {
    if (vadIntervalRef.current !== null) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
  };

  const [mode, setMode] = useState<VMode>("prompt");
  const [idx, setIdx] = useState(0);
  const [heardText, setHeardText] = useState("");
  const [err, setErr] = useState("");
  const [parsedBill, setParsedBill] = useState<{
    provider: string | null;
    amount: number | null;
    dueDay: number | null;
    kind: "Fixed" | "Variable";
    frequency?: "monthly" | "annual";
    skip?: boolean;
  } | null>(null);
  const [formCat, setFormCat] = useState<{ cat: string; icon: string } | null>(null);
  const [manualReturn, setManualReturn] = useState<VMode>("prompt");
  const [form, setForm] = useState<{ provider: string; amount: string; due: string; kind: "Fixed" | "Variable"; subtype?: string; house?: string }>({ provider: "", amount: "", due: "", kind: "Fixed", house: HOUSES[0] });
  const [phase, setPhase] = useState<"scripted" | "cards" | "loans">("scripted");
  const [breatherGroup, setBreatherGroup] = useState(0);
  const [cardN, setCardN] = useState(0);
  const [cardDone, setCardDone] = useState(0);
  const [loanN, setLoanN] = useState(0);
  const [loanDone, setLoanDone] = useState(0);
  const [screenshotStatus, setScreenshotStatus] = useState<"idle" | "loading" | "editing">("idle");
  const [screenshotBills, setScreenshotBills] = useState<{ provider: string; amount: number | null; dueDay: number | null }[]>([]);
  type DraftSub = { id: number; provider: string; amount: string; dueDay: string; frequency: "monthly" | "annual" };
  const [draftSubs, setDraftSubs] = useState<DraftSub[]>([]);
  const [parsedEditing, setParsedEditing] = useState(false);
  const [parsedEdits, setParsedEdits] = useState<{ provider: string; amount: string; dueDay: string; kind: "Fixed" | "Variable"; frequency: "monthly" | "annual" }>({ provider: "", amount: "", dueDay: "", kind: "Fixed", frequency: "monthly" });

  const scriptedItem = SAMPLES[Math.min(idx, SAMPLES.length - 1)]!;
  const sample: Sample =
    phase === "cards"
      ? { ...CARD_TEMPLATES[cardDone % CARD_TEMPLATES.length]!, cat: "Credit card", icon: "card", group: 2 }
      : phase === "loans"
        ? { ...LOAN_TEMPLATES[loanDone % LOAN_TEMPLATES.length]!, cat: "Personal loan", icon: "wallet", group: 3 }
        : scriptedItem;

  const done = mode === "done";

  const advanceAfterItem = () => {
    setHeardText("");
    setParsedBill(null);
    setParsedEditing(false);
    setScreenshotStatus("idle");
    setScreenshotBills([]);
    setDraftSubs([]);
    if (phase === "cards") {
      const d = cardDone + 1;
      setCardDone(d);
      if (d >= cardN) startLoans();
      else setMode("prompt");
      return;
    }
    if (phase === "loans") {
      const d = loanDone + 1;
      setLoanDone(d);
      if (d >= loanN) setMode("more");
      else setMode("prompt");
      return;
    }
    const n = idx + 1;
    setIdx(n);
    if (n >= SAMPLES.length) {
      setBreatherGroup(sample.group);
      setMode("breather");
      return;
    }
    if (SAMPLES[n]!.group !== sample.group) {
      setBreatherGroup(sample.group);
      setMode("breather");
      return;
    }
    setMode("prompt");
  };

  const confirm = () => {
    const b: OnbBill = {
      provider: parsedBill?.provider || sample.provider,
      cat: sample.cat,
      icon: sample.icon,
      amount: parsedBill?.amount ?? sample.amount,
      due: parsedBill?.dueDay != null ? ordinal(parsedBill.dueDay) : sample.due,
      dueDays: parsedBill?.dueDay ?? sample.dueDays,
      kind: parsedBill?.kind ?? kindFor(sample.cat),
      frequency: parsedBill?.frequency ?? "monthly",
      subtype: sample.subtype,
      house: HOUSES[0],
    };
    addBill(b);
    saveBill(onbBillToStoreBill(b));
    advanceAfterItem();
  };
  const skipOne = () => advanceAfterItem();
  const startCards = () => { setPhase("cards"); setCardDone(0); setMode("count"); };
  const startLoans = () => { setPhase("loans"); setLoanDone(0); setMode("count"); };
  const chooseCount = (k: number) => {
    if (phase === "cards") {
      setCardN(k);
      if (k === 0) startLoans();
      else { setCardDone(0); setMode("prompt"); }
    } else {
      setLoanN(k);
      if (k === 0) setMode("more");
      else { setLoanDone(0); setMode("prompt"); }
    }
  };
  const openForm = (c: { cat: string; icon: string }) => {
    const presets: Record<string, string> = { "Rent / Mortgage": "18000", Electricity: "3450", Water: "890", Internet: "1699", Mobile: "999", "TV / Streaming": "549", "Credit card": "5200" };
    setFormCat(c);
    setForm({ provider: "", amount: presets[c.cat] || "", due: "", kind: kindFor(c.cat), subtype: c.cat === "Rent / Mortgage" ? "Rent" : undefined, house: HOUSES[0] });
    setMode("manualForm");
  };
  const saveForm = () => {
    if (!formCat) return;
    const b: OnbBill = {
      provider: form.provider || formCat.cat,
      cat: formCat.cat,
      icon: formCat.icon,
      amount: parseFloat(form.amount) || 0,
      due: form.due || "—",
      dueDays: 20,
      kind: form.kind || kindFor(formCat.cat),
      subtype: form.subtype,
      house: form.house,
    };
    addBill(b);
    saveBill(onbBillToStoreBill(b));
    // "Type instead" replaces the voice step for that slot — advance exactly
    // like voice confirmation does (next item / breather / cards).
    // "Add bill" from breather or "more" is an add-extra flow — return there.
    if (manualReturn === "prompt") {
      advanceAfterItem();
    } else {
      setMode(manualReturn);
    }
  };

  /* Screenshot upload — encouraged for Phone subscription category */
  const handleUploadScreenshot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr(isFilipino(language)
        ? "Kailangan ng pahintulot para ma-access ang iyong photos."
        : "Photo library permission is needed to upload a screenshot.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0]!;
    const base64 = asset.base64!;
    setScreenshotStatus("loading");
    setErr("");
    try {
      const { subscriptions } = await parseSubscriptionScreenshot(
        base64,
        asset.mimeType || "image/jpeg",
      );
      setScreenshotBills(subscriptions);
      setDraftSubs(subscriptions.map((sub, i) => ({
        id: i,
        provider: sub.provider,
        amount: sub.amount != null ? String(sub.amount) : "",
        dueDay: sub.dueDay != null ? String(sub.dueDay) : "",
        frequency: (sub.frequency === "annual" ? "annual" : "monthly") as "monthly" | "annual",
      })));
      setScreenshotStatus("editing");
    } catch {
      setErr(isFilipino(language)
        ? "Hindi nabasa ang screenshot. Subukan muli o magsalita na lang."
        : "Couldn't read that screenshot. Try a clearer image or speak instead.");
      setScreenshotStatus("idle");
    }
  };

  /* Confirm scanned subscriptions — save all drafts then jump to breather */
  const confirmScan = () => {
    for (const sub of draftSubs) {
      if (!sub.provider.trim()) continue;
      const amount = parseFloat(sub.amount.replace(/,/g, "")) || 0;
      const dueDay = parseInt(sub.dueDay) || 20;
      const b: OnbBill = {
        provider: sub.provider.trim(),
        cat: "Phone subscription",
        icon: "spark",
        amount,
        due: sub.frequency === "annual" ? "annual" : ordinal(dueDay),
        dueDays: dueDay,
        kind: "Fixed",
        frequency: sub.frequency,
      };
      addBill(b);
      saveBill(onbBillToStoreBill(b));
    }
    setDraftSubs([]);
    setScreenshotBills([]);
    setScreenshotStatus("idle");
    // Skip remaining group-1 scripted prompts (TV/Streaming, Web app) — jump straight to breather
    const lastGroup1Idx = SAMPLES.reduce((acc, s, i) => s.group === 1 ? i : acc, 0);
    setIdx(lastGroup1Idx);
    setBreatherGroup(1);
    setMode("breather");
  };

  /* real capture + transcription */
  const startListening = async () => {
    setErr("");
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErr("Microphone permission is needed to listen. You can type instead.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMode("listening");
      // ── Start silence detection (VAD) ─────────────────────────────────
      clearVad();
      silenceRef.current = { timer: null, hasSpeech: false };
      const vadStart = Date.now();
      const VAD_MIN_MS = 800;         // settling period — sample ambient noise
      const VAD_SILENCE_MS = 3000;    // trailing silence AFTER speech → auto-stop
      const VAD_NO_SPEECH_MS = 12000; // grace window to start talking before giving up
      const VAD_MAX_MS = 45000;       // hard ceiling — never record more than 45 s
      let adaptiveThreshold = -50;    // updated after settling
      let settlingComplete = false;
      const ambientReadings: number[] = [];
      vadIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - vadStart;
        const db = recorder.getStatus().metering;
        // Hard ceiling — safety net for edge cases
        if (elapsed >= VAD_MIN_MS + VAD_MAX_MS) {
          clearVad();
          void stopListeningRef.current();
          return;
        }
        // Settling phase — collect ambient samples to calibrate threshold
        if (elapsed < VAD_MIN_MS) {
          if (db != null) ambientReadings.push(db);
          return;
        }
        // First tick past settling — lock adaptive threshold (ambient + 6 dBFS)
        if (!settlingComplete) {
          settlingComplete = true;
          if (ambientReadings.length > 0) {
            adaptiveThreshold = Math.max(...ambientReadings) + 6;
          }
        }
        // Metering unavailable on this device — fall back to a generous elapsed gate
        if (db == null) {
          if (elapsed >= VAD_MIN_MS + VAD_NO_SPEECH_MS) {
            clearVad();
            void stopListeningRef.current();
          }
          return;
        }
        if (db > adaptiveThreshold) {
          // Active speech — mark it and cancel any pending silence timer
          silenceRef.current.hasSpeech = true;
          if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
        } else if (silenceRef.current.hasSpeech) {
          // Trailing silence AFTER the user has spoken — wait VAD_SILENCE_MS so
          // natural mid-sentence pauses (recalling amounts, due dates) don't cut off.
          if (silenceRef.current.timer === null) {
            silenceRef.current.timer = setTimeout(() => {
              clearVad();
              void stopListeningRef.current();
            }, VAD_SILENCE_MS);
          }
        } else if (elapsed >= VAD_MIN_MS + VAD_NO_SPEECH_MS) {
          // Pre-speech silence — give the user a long grace window to start
          // talking. Only give up if no speech is detected at all.
          clearVad();
          void stopListeningRef.current();
        }
      }, 100);
    } catch (e) {
      setErr(`Couldn’t start recording: ${String((e as Error)?.message ?? e)}`);
    }
  };

  const stopListening = async () => {
    const hadSpeech = silenceRef.current.hasSpeech;
    clearVad();
    // VAD detected no real speech above threshold — stop silently without transcribing.
    if (!hadSpeech) {
      await recorder.stop().catch(() => {});
      setMode("prompt");
      return;
    }
    setMode("transcribing");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio captured");
      const base64 = await fileToBase64(uri);
      const { text } = await transcribeOnboarding(base64, "audio/m4a", sttHint(language));
      // Discard if transcription is only background-noise annotations
      if (!text?.trim() || isNoiseTranscript(text)) {
        setMode("prompt");
        return;
      }
      setHeardText(text);
      /* Parse transcribed text into structured bill fields */
      try {
        const parsed = await parseBillOnboarding(text, sample.cat);
        if (parsed.skip) {
          // User owns their home / has no payment for this category — skip it silently.
          setParsedBill(null);
          advanceAfterItem();
          return;
        }
        setParsedBill(parsed);
        // Provider unknown — open edit mode so the user can name it rather than assuming.
        if (!parsed.provider) {
          setParsedEditing(true);
          setParsedEdits({
            provider: sample.provider,
            amount: String(parsed.amount ?? sample.amount),
            dueDay: String(parsed.dueDay ?? sample.dueDays),
            kind: parsed.kind ?? kindFor(sample.cat),
            frequency: parsed.frequency ?? "monthly",
          });
        }
      } catch {
        setParsedBill(null); /* falls back to sample data in PCells */
      }
      setMode("parsed");
    } catch (e) {
      setErr(`Couldn’t transcribe that: ${String((e as Error)?.message ?? e)}`);
      setMode("prompt");
    }
  };
  // Ref so the VAD interval always calls the latest stopListening closure
  const stopListeningRef = useRef(stopListening);
  useEffect(() => { stopListeningRef.current = stopListening; });

  const isFil = isFilipino(language);
  const promptText =
    phase === "cards"
      ? isFil
        ? `Card ${cardDone + 1} ng ${cardN} — anong bangko, magkano ang due, at kailan?`
        : `Card ${cardDone + 1} of ${cardN} — which bank, the amount due, and the date?`
      : phase === "loans"
        ? isFil
          ? `Loan ${loanDone + 1} ng ${loanN} — sinong nagpahiram, magkano monthly, at kailan due?`
          : `Loan ${loanDone + 1} of ${loanN} — lender, the monthly amount, and the due date?`
        : JUDITH_VOICE.billTextPrompts[sample.cat]?.[isFil ? "fil" : "en"] ?? (isFil ? "Sabihin mo ang tungkol sa bill na ito." : "Tell me about this bill.");

  // Voice line — intentionally different from promptText so Judith isn't
  // just reading the screen aloud. Canned, shorter, more natural.
  // Also covers breather / count / more transitions so Judith speaks on every new screen.
  const bv = JUDITH_VOICE.billFlow[persona];
  const l = isFil ? "fil" : "en";
  const voiceText =
    mode === "breather"
      ? (breatherGroup === 0 ? bv.breather0 : bv.breather1)[l]
    : mode === "count"
      ? (phase === "cards" ? bv.countCards : bv.countLoans)[l]
    : mode === "more"
      ? bv.more[l](bills.length)
    : phase === "cards"
      ? cardDone === 0 ? bv.cardFirst[l] : bv.cardNext[l](cardDone + 1)
    : phase === "loans"
      ? loanDone === 0 ? bv.loanFirst[l] : bv.loanNext[l](loanDone + 1)
    : JUDITH_VOICE.billVoice[persona][l][sample.cat] ?? (isFil ? "Ano pa?" : "Go ahead.");

  /* Auto-play Judith's line aloud each time a new screen/state appears. */
  const lastPlayedPromptKey = useRef("");
  useEffect(() => {
    if (mode !== "prompt" && mode !== "breather" && mode !== "count" && mode !== "more") return;
    const key =
      mode === "breather" ? `breather-${breatherGroup}` :
      mode === "count"    ? `count-${phase}` :
      mode === "more"     ? "more" :
                            `prompt-${phase}-${idx}-${cardDone}-${loanDone}`;
    if (key === lastPlayedPromptKey.current) return;
    lastPlayedPromptKey.current = key;
    if (!voiceText) return;
    let cancelled = false;
    synthOnboarding(voiceText, persona, language)
      .then(({ audioBase64 }) => {
        if (!cancelled) return playBase64Mp3(audioBase64);
      })
      .catch(() => { /* silently skip if TTS unavailable */ });
    return () => {
      cancelled = true;
      stopCurrentAudio();
    };
  }, [mode, phase, idx, cardDone, loanDone, breatherGroup, voiceText, persona, language]);

  const progress = Math.min(idx + (mode === "done" ? 0 : 1), SAMPLES.length);
  const showConvo = mode === "prompt" || mode === "listening" || mode === "transcribing" || mode === "parsed";
  const isPhoneSub = phase === "scripted" && sample.cat === "Phone subscription";

  return (
    <>
      <Scroll>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt size={22} weight="semibold" style={{ letterSpacing: -0.3 }}>
            {done ? "All set" : "Tell Judith your bills"}
          </Txt>
          {bills.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hair, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Icon name="check" size={13} color={t.txtMid} />
              <Txt size={13} color={t.txtMid}>
                <Txt size={13} weight="bold" color={t.accent}>{bills.length}</Txt> {T("billsCount")}
              </Txt>
            </View>
          )}
        </View>

        {phase === "scripted" && !done && mode !== "manualCats" && mode !== "manualForm" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}>
            {SAMPLES.map((_, i) => (
              <View key={i} style={{ width: 22, height: 4, borderRadius: 3, backgroundColor: i < idx ? t.semantic.ok : i === idx ? t.accent : t.surface3 }} />
            ))}
            <Low size={11} style={{ marginLeft: 6 }}>Bill {progress} of {SAMPLES.length}</Low>
          </View>
        )}
        {(phase === "cards" || phase === "loans") && showConvo && (
          <View style={{ marginTop: 10 }}>
            <Low size={11}>
              {phase === "cards" ? `Card ${cardDone + 1} of ${cardN}` : `Loan ${loanDone + 1} of ${loanN}`}
            </Low>
          </View>
        )}

        {/* conversation area */}
        <View style={{ gap: 11, marginTop: 14, minHeight: 210 }}>
          {showConvo && !done && (!isPhoneSub || screenshotStatus === "idle") && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <JudithAvatar persona={persona} size={44} state={mode === "listening" ? "listening" : "speaking"} />
              <JudithLine style={{ flex: 1 }}>{promptText}</JudithLine>
            </View>
          )}
          {mode === "prompt" && !done && isPhoneSub && screenshotStatus === "loading" && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <JudithAvatar persona={persona} size={44} state="speaking" />
              <JudithLine style={{ flex: 1 }}>
                {isFil ? "Binabasa ko ang iyong screenshot…" : "Reading your screenshot…"}
              </JudithLine>
            </View>
          )}
          {mode === "prompt" && !done && isPhoneSub && screenshotStatus === "editing" && (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <JudithAvatar persona={persona} size={44} state="speaking" />
                <JudithLine style={{ flex: 1 }}>
                  {isFil
                    ? `${draftSubs.length} subscription ang nakita ko. I-check at i-edit kung may mali.`
                    : `Found ${draftSubs.length} subscription${draftSubs.length !== 1 ? "s" : ""}. Review and fix anything that looks off, then confirm.`}
                </JudithLine>
              </View>
              <View style={{ gap: 9, marginTop: 6 }}>
                {draftSubs.map((sub, i) => (
                  <View key={sub.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, overflow: "hidden" }}>
                    {/* Provider row */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8 }}>
                      <Icon name="spark" size={13} color={t.accent} />
                      <TextInput
                        value={sub.provider}
                        onChangeText={(v) => setDraftSubs((ds) => ds.map((d, j) => j === i ? { ...d, provider: v } : d))}
                        style={{ flex: 1, color: t.txtHi, fontSize: 14, fontWeight: "600" }}
                        placeholder="Provider name"
                        placeholderTextColor={t.txtLow}
                        returnKeyType="done"
                      />
                      <Pressable
                        onPress={() => setDraftSubs((ds) => ds.filter((_, j) => j !== i))}
                        hitSlop={10}
                      >
                        <Icon name="x" size={15} color={t.txtLow} />
                      </Pressable>
                    </View>
                    {/* Amount + due row */}
                    <View style={{ flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: t.hair }}>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 13, paddingVertical: 9 }}>
                        <Mono size={13} color={t.accent}>{cur}</Mono>
                        <TextInput
                          value={sub.amount}
                          onChangeText={(v) => setDraftSubs((ds) => ds.map((d, j) => j === i ? { ...d, amount: v } : d))}
                          keyboardType="numeric"
                          style={{ color: t.txtHi, fontSize: 14, minWidth: 60 }}
                          placeholder="0"
                          placeholderTextColor={t.txtLow}
                          returnKeyType="done"
                        />
                      </View>
                      <View style={{ width: 1, height: 30, backgroundColor: t.hair }} />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 9 }}>
                        <Low size={12}>due</Low>
                        <TextInput
                          value={sub.dueDay}
                          onChangeText={(v) => setDraftSubs((ds) => ds.map((d, j) => j === i ? { ...d, dueDay: v } : d))}
                          keyboardType="numeric"
                          style={{ color: t.txtHi, fontSize: 13, width: 28, textAlign: "center" }}
                          placeholder="1"
                          placeholderTextColor={t.txtLow}
                          maxLength={2}
                          returnKeyType="done"
                        />
                        <Low size={12}>· {sub.frequency === "annual" ? "annual" : "monthly"}</Low>
                      </View>
                    </View>
                  </View>
                ))}
                <Pressable
                  onPress={() => setDraftSubs((ds) => [...ds, { id: Date.now(), provider: "", amount: "", dueDay: "", frequency: "monthly" }])}
                  style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 6, paddingHorizontal: 2 }}
                >
                  <Icon name="plus" size={14} color={t.txtMid} />
                  <Txt size={13} color={t.txtMid}>{isFil ? "Dagdagan" : "Add another"}</Txt>
                </Pressable>
              </View>
            </>
          )}

          {mode === "count" && (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <JudithAvatar persona={persona} size={44} state="speaking" />
                <JudithLine style={{ flex: 1 }}>
                  {phase === "cards"
                    ? "Now the heavy hitters. How many credit cards do you have? I’ll take them one at a time."
                    : "And loans — personal, car, housing, anything. How many?"}
                </JudithLine>
              </View>
              {/* Card recap — shown when moving to the loans phase */}
              {phase === "loans" && bills.filter((b) => b.cat === "Credit card").length > 0 && (() => {
                const cards = bills.filter((b) => b.cat === "Credit card");
                const cardTotal = cards.reduce((s, b) => s + b.amount, 0);
                return (
                  <View style={{ alignSelf: "stretch", marginTop: 14 }}>
                    <Low size={11} style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Cards logged · {cur}{fmtNum(cardTotal)}/mo</Low>
                    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: t.hair, overflow: "hidden" }}>
                      {cards.map((b, i) => (
                        <View
                          key={`card-${i}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderBottomWidth: i < cards.length - 1 ? 1 : 0,
                            borderBottomColor: t.hair,
                            backgroundColor: t.surface2,
                          }}
                        >
                          <Icon name="card" size={13} color={t.accent} />
                          <Txt size={13} weight="medium" style={{ flex: 1 }} numberOfLines={1}>{b.provider}</Txt>
                          <Low size={11} style={{ marginRight: 6 }}>{b.due}</Low>
                          <Mono size={13} weight="semibold">{cur}{fmtNum(b.amount)}</Mono>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 16 }}>
                {[0, 1, 2, 3, 4, 5].map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => chooseCount(k)}
                    style={{ width: `${(100 - 18) / 3}%` as `${number}%`, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, alignItems: "center" }}
                  >
                    <Txt size={18} weight="semibold">{k === 0 ? "None" : k === 5 ? "5+" : k}</Txt>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {(mode === "listening" || mode === "transcribing" || mode === "parsed") && (
            <Transcript>
              {mode === "parsed"
                ? (heardText ? heardText : highlight(sample.utter, sample.toks, t.accent))
                : mode === "transcribing"
                  ? "…"
                  : "Listening…"}
            </Transcript>
          )}

          {mode === "parsed" && !parsedEditing && (
            <>
              <JudithLine>{VLOCAL.gotit}</JudithLine>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                <PCell full label={VLOCAL.lblP} delay={0}>
                  <Txt size={17} weight="semibold" color={t.txtHi}>
                    {parsedBill?.provider || sample.provider}
                  </Txt>
                </PCell>
                <PCell label={VLOCAL.lblA} delay={80}>
                  <Mono size={17} weight="bold">
                    <Mono size={17} weight="bold" color={t.accent}>{cur}</Mono>
                    {fmtNum(parsedBill?.amount ?? sample.amount)}
                  </Mono>
                </PCell>
                <PCell label={VLOCAL.lblD} delay={160}>
                  <Txt size={17} weight="semibold">
                    {parsedBill?.frequency === "annual"
                      ? (parsedBill.dueDay != null ? ordinal(parsedBill.dueDay) + " · " : "") + VLOCAL.annually
                      : (parsedBill?.dueDay != null ? ordinal(parsedBill.dueDay) : sample.due) + " · " + VLOCAL.monthly}
                  </Txt>
                </PCell>
                <PCell label="Type" delay={240}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (parsedBill?.kind ?? kindFor(sample.cat)) === "Variable" ? t.semantic.near : t.semantic.ok }} />
                    <Txt size={17} weight="semibold">{parsedBill?.kind ?? kindFor(sample.cat)}</Txt>
                  </View>
                </PCell>
                <PCell label={VLOCAL.lblC} delay={320}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Icon name={sample.icon as IconName} size={14} color={t.accent} />
                    <Txt size={14}>{sample.subtype || sample.cat}</Txt>
                  </View>
                </PCell>
              </View>
            </>
          )}
          {mode === "parsed" && parsedEditing && (
            <View style={{ alignSelf: "stretch", marginTop: 4 }}>
              <JudithLine>Got it — fix anything that looks off:</JudithLine>
              <View style={{ marginTop: 12 }}>
                <FieldLabel>Provider</FieldLabel>
                <Input
                  value={parsedEdits.provider}
                  onChangeText={(v) => setParsedEdits({ ...parsedEdits, provider: v })}
                  placeholder="Provider name"
                />
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Amount</FieldLabel>
                  <Input
                    value={parsedEdits.amount}
                    onChangeText={(v) => setParsedEdits({ ...parsedEdits, amount: v.replace(/[^0-9.]/g, "") })}
                    placeholder={cur + " 0"}
                    keyboardType="numeric"
                    mono
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Due day (1–31)</FieldLabel>
                  <Input
                    value={parsedEdits.dueDay}
                    onChangeText={(v) => setParsedEdits({ ...parsedEdits, dueDay: v.replace(/[^0-9]/g, "") })}
                    placeholder="e.g. 15"
                    keyboardType="numeric"
                    mono
                  />
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <FieldLabel>Billing</FieldLabel>
                <Seg
                  options={["Monthly", "Annual"]}
                  value={parsedEdits.frequency === "annual" ? "Annual" : "Monthly"}
                  onChange={(v) => setParsedEdits({ ...parsedEdits, frequency: v === "Annual" ? "annual" : "monthly" })}
                />
              </View>
              <View style={{ marginTop: 10 }}>
                <FieldLabel>Type</FieldLabel>
                <Seg
                  options={["Fixed", "Variable"]}
                  value={parsedEdits.kind}
                  onChange={(v) => setParsedEdits({ ...parsedEdits, kind: v as "Fixed" | "Variable" })}
                />
              </View>
            </View>
          )}

          {err !== "" && showConvo && (
            <Txt size={13} color={t.semantic.urgent} style={{ textAlign: "center" }}>{err}</Txt>
          )}

          {done && (
            <View style={{ alignItems: "center" }}>
              <JudithAvatar persona={persona} size={72} state="idle" />
              <JudithLine style={{ marginTop: 12 }}>
                That’s everything — utilities, subscriptions, cards and loans. Now you can see the whole picture.
              </JudithLine>
              <View style={{ gap: 8, marginTop: 14, alignSelf: "stretch" }}>
                {bills.slice(0, 12).map((b, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 1, borderColor: t.hair, borderRadius: t.radius.md, backgroundColor: t.surface2, paddingVertical: 13, paddingHorizontal: 14 }}>
                    <IcoBox name={b.icon} color={t.accent} size={30} />
                    <View style={{ flex: 1 }}>
                      <Txt size={14} weight="medium">{b.provider}</Txt>
                      <Low size={12}>{b.cat} · {b.due}</Low>
                    </View>
                    <Mono size={14}>{cur}{fmtNum(b.amount)}</Mono>
                  </View>
                ))}
              </View>
            </View>
          )}

          {mode === "breather" && (() => {
            const g = VGROUPS[breatherGroup] || VGROUPS[0]!;
            const total = bills.reduce((s, b) => s + (b.amount || 0), 0);
            return (
              <View style={{ alignItems: "center" }}>
                <JudithAvatar persona={persona} size={68} state="speaking" />
                <Kicker style={{ marginTop: 12, textAlign: "center" }}>{g.label} ✓</Kicker>
                <Txt size={22} weight="semibold" style={{ marginTop: 2 }}>{g.done}</Txt>
                <View style={{ alignItems: "center", marginTop: 14 }}>
                  <Low size={12}>Logged so far · {bills.length} bills</Low>
                  <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                    <Mono size={30} weight="bold">{cur}{fmtNum(total)}</Mono>
                    <Low size={13}>/mo</Low>
                  </View>
                </View>
                {bills.length > 0 && (
                  <View style={{ alignSelf: "stretch", marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: t.hair, overflow: "hidden" }}>
                    {bills.map((b, i) => (
                      <View
                        key={`${b.provider}-${i}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderBottomWidth: i < bills.length - 1 ? 1 : 0,
                          borderBottomColor: t.hair,
                          backgroundColor: t.surface2,
                        }}
                      >
                        <Icon name={b.icon as IconName} size={13} color={t.accent} />
                        <Txt size={13} weight="medium" style={{ flex: 1 }} numberOfLines={1}>{b.provider}</Txt>
                        <Low size={11} style={{ marginRight: 6 }}>{b.cat}</Low>
                        <Mono size={13} weight="semibold">{cur}{fmtNum(b.amount)}</Mono>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })()}

          {mode === "more" && (() => {
            const total = bills.reduce((s, b) => s + (b.amount || 0), 0);
            const moreSections = [
              { label: "Essentials", filter: (b: OnbBill) => ["Rent / Mortgage","Electricity","Water","Internet"].includes(b.cat) },
              { label: "Subscriptions", filter: (b: OnbBill) => ["Mobile","Phone subscription","TV / Streaming","Web app"].includes(b.cat) },
              { label: "Cards", filter: (b: OnbBill) => b.cat === "Credit card" },
              { label: "Loans", filter: (b: OnbBill) => b.cat === "Personal loan" },
              { label: "Other", filter: (b: OnbBill) => !["Rent / Mortgage","Electricity","Water","Internet","Mobile","Phone subscription","TV / Streaming","Web app","Credit card","Personal loan"].includes(b.cat) },
            ].map(s => ({ ...s, items: bills.filter(s.filter) })).filter(s => s.items.length > 0);
            return (
              <View style={{ alignItems: "center" }}>
                <Txt size={30} weight="bold" style={{ textAlign: "center", lineHeight: 36, marginBottom: 4 }}>
                  {"Did we get\neverything?"}
                </Txt>
                <Low size={13} style={{ textAlign: "center", marginBottom: 16 }}>
                  Last chance before we build your bill picture.
                </Low>
                <JudithAvatar persona={persona} size={68} state="speaking" />
                <JudithLine style={{ marginTop: 12 }}>
                  That’s {bills.length} so far — {cur}{fmtNum(total)}/mo. Any more cards, loans, or anything else? Gym, insurance, tuition? Let’s not miss any.
                </JudithLine>
                {moreSections.length > 0 && (
                  <View style={{ alignSelf: "stretch", marginTop: 14, gap: 12 }}>
                    {moreSections.map((sec) => (
                      <View key={sec.label}>
                        <Low size={11} style={{ marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {sec.label} · {cur}{fmtNum(sec.items.reduce((s, b) => s + b.amount, 0))}/mo
                        </Low>
                        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: t.hair, overflow: "hidden" }}>
                          {sec.items.map((b, i) => (
                            <View
                              key={`more-${sec.label}-${i}`}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                paddingVertical: 10,
                                paddingHorizontal: 14,
                                borderBottomWidth: i < sec.items.length - 1 ? 1 : 0,
                                borderBottomColor: t.hair,
                                backgroundColor: t.surface2,
                              }}
                            >
                              <Icon name={b.icon as IconName} size={13} color={t.accent} />
                              <Txt size={13} weight="medium" style={{ flex: 1 }} numberOfLines={1}>{b.provider}</Txt>
                              <Mono size={13} weight="semibold">{cur}{fmtNum(b.amount)}</Mono>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })()}

          {mode === "manualCats" && (
            <View style={{ alignSelf: "stretch", marginTop: 4 }}>
              <Lede style={{ marginTop: 0 }}>Pick a category to log.</Lede>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 10 }}>
                {MANUAL_CATS.map((c) => (
                  <Pressable
                    key={c.cat}
                    onPress={() => openForm(c)}
                    style={{ width: `${(100 - 18) / 3}%` as `${number}%`, padding: 12, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, alignItems: "center", gap: 7 }}
                  >
                    <Icon name={c.icon as IconName} size={17} color={t.accent} />
                    <Txt size={12} style={{ textAlign: "center" }}>{c.cat}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {mode === "manualForm" && formCat && (
            <View style={{ alignSelf: "stretch", marginTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <IcoBox name={formCat.icon} color={t.accent} size={34} />
                <View>
                  <Txt size={15} weight="semibold">Log a {formCat.cat.toLowerCase()} bill</Txt>
                  <Low size={12}>{formCat.cat}</Low>
                </View>
              </View>
              <View style={{ marginTop: 14 }}>
                <FieldLabel>Provider</FieldLabel>
                <Input
                  value={form.provider}
                  onChangeText={(v) => setForm({ ...form, provider: v })}
                  placeholder={getProviderPlaceholder(ctx.country.code, formCat.cat)}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Amount</FieldLabel>
                  <Input
                    value={form.amount}
                    onChangeText={(v) => setForm({ ...form, amount: v.replace(/[^0-9.]/g, "") })}
                    placeholder={cur + " 0"}
                    keyboardType="numeric"
                    mono
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Due date</FieldLabel>
                  <Input
                    value={form.due}
                    onChangeText={(v) => setForm({ ...form, due: v })}
                    placeholder="e.g. 15th"
                  />
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <FieldLabel>Type</FieldLabel>
                <Seg
                  options={["Fixed", "Variable"]}
                  value={form.kind}
                  onChange={(v) => setForm({ ...form, kind: v as "Fixed" | "Variable" })}
                />
              </View>
              {formCat.cat === "Rent / Mortgage" && (
                <View style={{ marginTop: 10 }}>
                  <FieldLabel>Rent or mortgage?</FieldLabel>
                  <Seg
                    options={["Rent", "Mortgage"]}
                    value={form.subtype || "Rent"}
                    onChange={(v) => setForm({ ...form, subtype: v })}
                  />
                </View>
              )}
              {HOUSES.length > 1 && (
                <View style={{ marginTop: 10 }}>
                  <FieldLabel>Which home?</FieldLabel>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {HOUSES.map((h) => {
                      const on = form.house === h;
                      return (
                        <Pressable
                          key={h}
                          onPress={() => setForm({ ...form, house: h })}
                          style={{ borderWidth: 1, borderColor: on ? t.accent : t.hair, borderRadius: 22, paddingVertical: 9, paddingHorizontal: 15, backgroundColor: on ? mix(t.accent, t.surface2, 0.16) : t.surface2 }}
                        >
                          <Txt size={14} color={on ? t.txtHi : t.txtMid}>{h}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {mode === "listening" && (
          <View style={{ alignItems: "center", paddingTop: 6 }}>
            <Txt size={15} color={t.accent} style={{ textAlign: "center" }}>{T("listening")}</Txt>
            <ScanSweep accent={t.accent} />
          </View>
        )}
      </Scroll>

      {/* CTA zone */}
      <CtaBar>
        {mode === "prompt" && (
          <>
            {/* Phone subscription: screenshot upload is the primary encouraged path */}
            {isPhoneSub && screenshotStatus === "idle" && (
              <>
                <Pressable
                  onPress={handleUploadScreenshot}
                  style={{ borderWidth: 1.5, borderColor: t.accent, borderRadius: 16, backgroundColor: mix(t.accent, t.surface2, 0.1), padding: 16 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: mix(t.accent, t.canvas, 0.18), alignItems: "center", justifyContent: "center" }}>
                      <Icon name="camera" size={20} color={t.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt size={15} weight="semibold">Upload a screenshot</Txt>
                      <Low size={12}>
                        {Platform.OS === "ios"
                          ? "Settings → [Your Name] → Subscriptions"
                          : "Play Store → Profile → Payments & subscriptions"}
                      </Low>
                    </View>
                    <Icon name="chevron" size={16} color={t.accent} />
                  </View>
                </Pressable>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 2 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
                  <Low size={12}>or speak</Low>
                  <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
                </View>
              </>
            )}
            {isPhoneSub && screenshotStatus === "loading" && (
              <View style={{ alignItems: "center", paddingVertical: 8 }}>
                <Low size={13}>{isFil ? "Isang sandali…" : "One moment…"}</Low>
              </View>
            )}
            {isPhoneSub && screenshotStatus === "editing" && (
              <Btn
                label={isFil ? `I-confirm ang ${draftSubs.length} →` : `Confirm ${draftSubs.length} →`}
                onPress={confirmScan}
              />
            )}
            {screenshotStatus !== "editing" && screenshotStatus !== "loading" && (
              <>
                <MicBtn onPress={startListening} />
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 2 }}>
                  <Pressable onPress={() => { setManualReturn("prompt"); setMode("manualCats"); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name="keyboard" size={15} color={t.txtMid} />
                    <Txt size={14} color={t.txtMid}>{T("tapInstead")}</Txt>
                  </Pressable>
                  <Pressable onPress={skipOne}>
                    <Txt size={14} color={t.txtMid}>I don’t have this →</Txt>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}
        {mode === "listening" && <MicBtn live onPress={stopListening} />}
        {mode === "transcribing" && <MicBtn live />}
        {mode === "parsed" && !parsedEditing && (
          <>
            <Txt size={14} color={t.txtMid} style={{ textAlign: "center", marginBottom: 2 }}>{T("confirmQ")}</Txt>
            <Btn label={T("yes")} onPress={confirm} />
            <Btn label={T("edit")} variant="soft" onPress={() => {
              setParsedEditing(true);
              setParsedEdits({
                provider: parsedBill?.provider ?? "",
                amount: String(parsedBill?.amount ?? sample.amount),
                dueDay: String(parsedBill?.dueDay ?? sample.dueDays),
                kind: parsedBill?.kind ?? kindFor(sample.cat),
                frequency: parsedBill?.frequency ?? "monthly",
              });
            }} />
          </>
        )}
        {mode === "parsed" && parsedEditing && (
          <>
            <Btn label="Save changes" onPress={() => {
              const d = parseInt(parsedEdits.dueDay, 10);
              setParsedBill({
                provider: parsedEdits.provider.trim() || null,
                amount: parseFloat(parsedEdits.amount) || null,
                dueDay: Number.isFinite(d) && d >= 1 && d <= 31 ? d : null,
                kind: parsedEdits.kind,
                frequency: parsedEdits.frequency,
              });
              setParsedEditing(false);
            }} />
            <Btn label="Cancel" variant="ghost" onPress={() => setParsedEditing(false)} />
          </>
        )}
        {mode === "manualCats" && (
          <Btn label="← Back" variant="ghost" onPress={() => setMode(manualReturn)} />
        )}
        {mode === "manualForm" && (
          <>
            <Btn label="Log this bill" onPress={saveForm} />
            <Btn label="← Categories" variant="ghost" onPress={() => setMode("manualCats")} />
          </>
        )}
        {mode === "breather" && (() => {
          const g = VGROUPS[breatherGroup] || VGROUPS[0]!;
          return (
            <>
              <Btn label={g.addLabel} icon="plus" variant="soft" onPress={() => { setManualReturn("breather"); setMode("manualCats"); }} />
              <Btn label="Are there MORE?" onPress={() => { if (breatherGroup === 1) startCards(); else setMode("prompt"); }} />
            </>
          );
        })()}
        {mode === "more" && (
          <>
            <Btn label="Yes, add another" icon="plus" onPress={() => { setManualReturn("more"); setMode("manualCats"); }} />
            <Btn label="No, that’s everything" variant="soft" onPress={() => setMode("done")} />
          </>
        )}
        {mode === "done" && (
          <Btn label="See my bill picture →" onPress={next} />
        )}
        {mode === "count" && <View />}
      </CtaBar>
    </>
  );
}

function PCell({ label, full, delay = 0, children }: { label: string; full?: boolean; delay?: number; children: React.ReactNode }) {
  const t    = useTheme();
  const opa  = useRef(new Animated.Value(0)).current;
  const tY   = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    const anim = Animated.sequence([
      ...(delay > 0 ? [Animated.delay(delay)] : []),
      Animated.parallel([
        Animated.timing(opa, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(tY,  { toValue: 0, duration: 320, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: opa,
        transform: [{ translateY: tY }],
        width: full ? "100%" : `${(100 - 9 * 0.5) / 2}%` as `${number}%`,
        borderWidth: 1,
        borderColor: t.hair,
        borderRadius: 12,
        paddingVertical: 11,
        paddingHorizontal: 13,
        backgroundColor: t.surface1,
      }}
    >
      <Txt size={11} color={t.txtLow} style={{ letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</Txt>
      <View style={{ marginTop: 3 }}>{children}</View>
    </Animated.View>
  );
}

/* Animated scan sweep line — shown in listening mode */
function ScanSweep({ accent }: { accent: string }) {
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <View style={{ width: "84%", height: 180, marginTop: 10, overflow: "hidden", position: "relative" }}>
      <Animated.View
        style={{
          position: "absolute",
          left: 0, right: 0, height: 3, borderRadius: 3,
          backgroundColor: accent,
          shadowColor: accent, shadowOpacity: 0.75, shadowRadius: 9,
          shadowOffset: { width: 0, height: 0 },
          transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }) }],
        }}
      />
    </View>
  );
}

function MicBtn({ live, onPress }: { live?: boolean; onPress?: () => void }) {
  const t     = useTheme();
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!live) { ring1.setValue(0); ring2.setValue(0); return; }
    const makeLoop = (val: Animated.Value, startDelay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(startDelay),
          Animated.timing(val, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const a1 = makeLoop(ring1, 0);
    const a2 = makeLoop(ring2, 750);
    a1.start(); a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, [live]);

  const ringStyle = (val: Animated.Value) => ({
    position: "absolute" as const,
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 1.5, borderColor: t.accent,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  });

  return (
    <View style={{ alignSelf: "center", alignItems: "center", justifyContent: "center", width: 76, height: 76 }}>
      {live && <Animated.View style={ringStyle(ring1)} />}
      {live && <Animated.View style={ringStyle(ring2)} />}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: t.accent,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: t.accent,
            shadowOpacity: live ? 0.8 : 0.5,
            shadowRadius: live ? 20 : 14,
            shadowOffset: { width: 0, height: 0 },
          },
          pressed && { transform: [{ scale: 0.93 }] },
        ]}
      >
        <Icon name="mic" size={28} color={t.onAccent} />
      </Pressable>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Txt size={12} color={t.txtMid} style={{ marginBottom: 6 }}>{children}</Txt>;
}

function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  mono,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  mono?: boolean;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.txtLow}
      keyboardType={keyboardType ?? "default"}
      style={{
        width: "100%",
        borderWidth: 1,
        borderColor: t.hair,
        backgroundColor: t.surface1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        color: t.txtHi,
        fontFamily: mono ? t.fonts.mono : t.fonts.regular,
        fontSize: 15,
      }}
    />
  );
}

function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hair, borderRadius: 11, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{ flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: on ? t.accent : "transparent", alignItems: "center" }}
          >
            <Txt size={13} weight="semibold" color={on ? t.onAccent : t.txtMid}>{o}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ================================================================== */
/* 10. Congrats                                                        */
/* ================================================================== */

/** Convert an onboarding-local OnbBill into a store Bill so it persists immediately. */
function onbBillToStoreBill(b: OnbBill): Bill {
  const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const today = new Date();
  const parsedDay = parseInt(b.due, 10); // "1st"→1, "15th"→15; NaN for "annual"/"—"
  const dueDate = !isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31 ? parsedDay : 1;
  const todayDay = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInCurrent = new Date(year, month + 1, 0).getDate();
  const clamped = Math.min(dueDate, daysInCurrent);
  let dueDays = clamped - todayDay;
  let labelMonth = month;
  if (dueDays <= 0) {
    const nm = (month + 1) % 12;
    const ny = month === 11 ? year + 1 : year;
    const daysInNext = new Date(ny, nm + 1, 0).getDate();
    dueDays = daysInCurrent - todayDay + Math.min(dueDate, daysInNext);
    labelMonth = nm;
  }
  return {
    id: `onb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    provider: b.provider,
    cat: b.cat,
    icon: b.icon,
    amount: b.amount,
    dueDays: Math.max(0, dueDays),
    dueDate: clamped,
    dueLabel: `${MONTHS_S[labelMonth]!} ${clamped}`,
    status: "due",
    house: b.house,
    kind: b.kind,
    subtype: b.subtype as "Rent" | "Mortgage" | undefined,
    frequency: b.frequency,
  };
}

function billData(
  onbBills: OnbBill[],
  storeBills: Bill[] = [],
): { amount: number; provider: string; cat: string; dueDays: number }[] {
  if (onbBills.length > 0) return onbBills;
  return storeBills.map((b) => ({ amount: b.amount, provider: b.provider, cat: b.cat, dueDays: b.dueDays }));
}

function ScreenCongrats({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, bills, next } = ctx;
  const { bills: storeBills } = useJudith();
  const cur = ctx.country.cur;
  const data = billData(bills, storeBills);
  const total = data.reduce((s, b) => s + b.amount, 0);
  // Dynamic voice — speaks the real bill count + total so the user hears their actual numbers.
  useEffect(() => {
    let cancelled = false;
    const n = data.length;
    const line = isFilipino(language)
      ? "Yan na yung total mo. Check mo."
      : `You\u2019ve got ${n} bills \u2014 ${cur}${fmtNum(total)} a month. All set. Let me show you what I see.`;
    synthOnboarding(line, persona, language)
      .then(({ audioBase64 }) => { if (!cancelled) playBase64Mp3(audioBase64).catch(() => {}); })
      .catch(() => {});
    return () => { cancelled = true; stopCurrentAudio(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <Scroll center>
        <JudithAvatar persona={persona} size={140} state="idle" mood="joy" />
        <Txt size={32} weight="semibold" style={{ marginTop: 30, letterSpacing: -0.5, textAlign: "center" }}>{T("congratsT")}</Txt>
        <Lede style={{ maxWidth: 270, textAlign: "center" }}>{T("congratsL")}</Lede>
        <Card style={{ marginTop: 22, flexDirection: "row", alignSelf: "stretch", padding: 0, overflow: "hidden" }}>
          <View style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 12 }}>
            <Mono size={30} weight="bold">{data.length}</Mono>
            <Low size={12}>{T("billsCount")}</Low>
          </View>
          <View style={{ width: 1, backgroundColor: t.hair }} />
          <View style={{ flex: 1.4, paddingVertical: 16, paddingHorizontal: 12 }}>
            <Mono size={30} weight="bold">{cur}{fmtNum(total)}</Mono>
            <Low size={12}>{T("perMonth")}</Low>
          </View>
        </Card>
      </Scroll>
      <CtaBar>
        <Btn label={T("continue")} onPress={next} />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* 11. Personalizing (loader)                                          */
/* ================================================================== */

function ScreenPersonalizing({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, next } = ctx;
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  // Coordinate voice + progress bar: only advance when BOTH are done.
  const voiceDone = useRef(false);
  const timerDone = useRef(false);
  const advanced = useRef(false);
  const tryAdvance = useRef(() => {
    if (voiceDone.current && timerDone.current && !advanced.current) {
      advanced.current = true;
      next();
    }
  });
  // Voice: synthesize once, mark voiceDone when playback finishes.
  useEffect(() => {
    let cancelled = false;
    const utterance = JUDITH_VOICE.personalizing[persona];
    synthOnboarding(utterance, persona, language)
      .then(({ audioBase64 }) => {
        if (cancelled) return Promise.resolve();
        return playBase64Mp3(audioBase64);
      })
      .then(() => { if (!cancelled) { voiceDone.current = true; tryAdvance.current(); } })
      .catch(() => { if (!cancelled) { voiceDone.current = true; tryAdvance.current(); } });
    return () => { cancelled = true; stopCurrentAudio(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Progress bar timer: marks timerDone when animation completes.
  useEffect(() => {
    const dur = 3400;
    const per = dur / PERS_LINES.length;
    const li = setInterval(() => setStep((s) => Math.min(s + 1, PERS_LINES.length - 1)), per);
    const start = Date.now();
    const pi = setInterval(() => setPct(Math.min(100, ((Date.now() - start) / dur) * 100)), 40);
    const doneT = setTimeout(() => {
      clearInterval(li); clearInterval(pi);
      timerDone.current = true;
      tryAdvance.current();
    }, dur + 250);
    return () => { clearInterval(li); clearInterval(pi); clearTimeout(doneT); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Scroll center>
      <JudithAvatar persona={persona} size={130} state="speaking" mood="warm" />
      <View style={{ marginTop: 34, height: 24 }}>
        <Txt size={16} style={{ textAlign: "center" }}>{PERS_LINES[step]}</Txt>
      </View>
      <View style={{ width: 200, height: 5, borderRadius: 5, backgroundColor: t.surface3, marginTop: 22, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: t.accent }} />
      </View>
      <Mono size={13} color={t.txtLow} style={{ marginTop: 10 }}>{Math.round(pct)}%</Mono>
    </Scroll>
  );
}

/* ================================================================== */
/* 12. Summary                                                         */
/* ================================================================== */

function ScreenSummary({ ctx }: { ctx: Ctx }) {
  const { t, bills, next } = ctx;
  const { bills: storeBills } = useJudith();
  const cur = ctx.country.cur;
  const data = billData(bills, storeBills);

  // Dynamic voice: speaks real insights from the user's actual bill data.
  useEffect(() => {
    if (data.length === 0) return;
    let cancelled = false;
    stopCurrentAudio();
    const n = data.length;
    const total = data.reduce((s, b) => s + b.amount, 0);
    const biggest = data.reduce((a, b) => (b.amount > a.amount ? b : a), data[0]!);
    const nextDue = data.reduce((a, b) => (b.dueDays < a.dueDays ? b : a), data[0]!);
    const savings =
      total > 5000
        ? `Tracking this could save you ${cur}450 or more in late fees a year.`
        : "I'll keep you on top of every due date.";
    const line = isFilipino(ctx.language)
      ? `May total kang ${cur}${fmtNum(total)} this month for your bills. Ang pinaka malaking mong bill, obviously ay, ${biggest.provider} — ${cur}${fmtNum(biggest.amount)}. Yung pinaka malapit na due mo ay ${nextDue.provider} — ${cur}${fmtNum(nextDue.amount)}, ${nextDue.dueDays} araw na lang. Ayos ba yung pagkaka lista natin ng bills mo?`
      : `Okay — ${n} bill${n === 1 ? "" : "s"}, ${cur}${fmtNum(total)} a month. ${biggest.provider}'s the big one at ${cur}${fmtNum(biggest.amount)}. First up is ${nextDue.provider} — due in ${nextDue.dueDays} day${nextDue.dueDays === 1 ? "" : "s"}. ${savings}`;
    synthOnboarding(line, ctx.persona, ctx.language)
      .then(({ audioBase64 }) => {
        if (!cancelled) playBase64Mp3(audioBase64).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopCurrentAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (data.length === 0) {
    return (
      <>
        <Scroll center>
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Icon name="chart" size={44} color={t.txtLow} />
            <Txt size={22} weight="semibold" style={{ textAlign: "center", marginTop: 20, marginBottom: 8 }}>No bills added yet</Txt>
            <Low size={14} style={{ textAlign: "center", maxWidth: 270 }}>You can add bills from the home screen after setup.</Low>
          </View>
        </Scroll>
        <CtaBar>
          <Btn label={T("continue")} onPress={next} />
        </CtaBar>
      </>
    );
  }

  const total = data.reduce((s, b) => s + b.amount, 0);
  const maxA = Math.max(...data.map((b) => b.amount));
  const biggest = data.reduce((a, b) => (b.amount > a.amount ? b : a), data[0]!);
  const nextDue = data.reduce((a, b) => (b.dueDays < a.dueDays ? b : a), data[0]!);
  const catTotals: Record<string, number> = {};
  data.forEach((b) => { catTotals[b.cat] = (catTotals[b.cat] || 0) + b.amount; });
  const bigCatName = Object.keys(catTotals).reduce((a, b) => (catTotals[b]! > catTotals[a]! ? b : a), Object.keys(catTotals)[0]!);
  const bigCatAmt = catTotals[bigCatName] || 0;
  const bigCatPct = total > 0 ? Math.round((bigCatAmt / total) * 100) : 0;
  const ndCls = dueClass(nextDue.dueDays);

  return (
    <>
      <Scroll>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Icon name="chart" size={13} color={t.accent} />
          <Kicker style={{ marginBottom: 0, marginLeft: 6 }}>{T("summaryT")}</Kicker>
        </View>
        <Mono size={40} weight="bold" style={{ letterSpacing: -0.8 }}>{cur}{fmtNum(total)}</Mono>
        <Low size={13} style={{ marginBottom: 6 }}>{T("perMonth")} · {data.length} {T("billsCount")}</Low>

        <Card style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height: 130, paddingTop: 10 }}>
            {data.map((b, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 7, height: "100%" }}>
                <Mono size={9.5} weight="bold" color={t.txtMid}>{cur}{(b.amount / 1000).toFixed(b.amount % 1000 === 0 ? 0 : 1)}k</Mono>
                <View style={{ width: "100%", height: `${Math.max(12, (b.amount / maxA) * 100)}%`, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: b === nextDue ? t.semantic.near : t.accent }} />
                <Low size={10}>{b.provider.split(" ")[0]}</Low>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ gap: 9, marginTop: 14 }}>
          <Insight icon="zap" iconColor={t.accent} label={T("insBiggest")} value={biggest.provider} right={`${cur}${fmtNum(biggest.amount)}`} />
          <Insight icon="layers" iconColor={t.accent} label="Biggest category" value={`${bigCatName} · ${bigCatPct}%`} right={`${cur}${fmtNum(bigCatAmt)}`} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: t.hair, borderRadius: 14, backgroundColor: t.surface1 }}>
            <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: t.semantic[ndCls] }} />
            <View style={{ flex: 1 }}>
              <Low size={12}>{T("insNext")}</Low>
              <Txt size={14} weight="semibold">{nextDue.provider}</Txt>
            </View>
            <Mono size={14} weight="bold" color={t.semantic[ndCls]}>{nextDue.dueDays}d</Mono>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: t.hair, borderRadius: 14, backgroundColor: t.surface1 }}>
            <Icon name="check" size={16} color={t.semantic.ok} />
            <View style={{ flex: 1 }}>
              <Low size={12}>{T("insSaved")}</Low>
              <Txt size={14} weight="semibold">~ {cur}450+ / mo</Txt>
            </View>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.semantic.ok }} />
          </View>
        </View>
      </Scroll>
      <CtaBar>
        <Btn label={T("continue")} onPress={next} />
      </CtaBar>
    </>
  );
}

function Insight({ icon, iconColor, label, value, right }: { icon: IconName; iconColor: string; label: string; value: string; right: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: t.hair, borderRadius: 14, backgroundColor: t.surface1 }}>
      <Icon name={icon} size={16} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Low size={12}>{label}</Low>
        <Txt size={14} weight="semibold">{value}</Txt>
      </View>
      <Mono size={14} weight="bold">{right}</Mono>
    </View>
  );
}

/* ================================================================== */
/* 13–15. Feature → Benefit x3                                         */
/* ================================================================== */

interface FeatureMsg {
  role: "user" | "judith";
  text: string;
}
type AskMode = "idle" | "listening" | "thinking" | "speaking";

function FeatureShell({
  ctx,
  dotIdx,
  kicker,
  title,
  lede,
  q,
  a,
  mood,
  variant,
}: {
  ctx: Ctx;
  dotIdx: number;
  kicker: string;
  title: string;
  lede: string;
  q: string;
  a: string;
  mood: "warm" | "proud" | "joy";
  variant: 1 | 2 | 3;
}) {
  const { t, persona, language, next, bills } = ctx;
  const isFil = isFilipino(language);
  const voiceLine = JUDITH_VOICE.features[persona][isFil ? "fil" : "en"][dotIdx];
  useOnbVoice(voiceLine, persona, language);

  /* ── demo float animation (shown before first real ask) ── */
  const floatY  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -13, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0,   duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  /* ── staggered bubble-in for demo Q&A ── */
  const tOpacity = useRef(new Animated.Value(0)).current;
  const tY       = useRef(new Animated.Value(8)).current;
  const tScale   = useRef(new Animated.Value(0.97)).current;
  const rOpacity = useRef(new Animated.Value(0)).current;
  const rY       = useRef(new Animated.Value(8)).current;
  const rScale   = useRef(new Animated.Value(0.97)).current;
  useEffect(() => {
    const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
    const dur  = 400;
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(tOpacity, { toValue: 1, duration: dur, easing: ease, useNativeDriver: true }),
        Animated.timing(tY,       { toValue: 0, duration: dur, easing: ease, useNativeDriver: true }),
        Animated.timing(tScale,   { toValue: 1, duration: dur, easing: ease, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(rOpacity, { toValue: 1, duration: dur, easing: ease, useNativeDriver: true }),
        Animated.timing(rY,       { toValue: 0, duration: dur, easing: ease, useNativeDriver: true }),
        Animated.timing(rScale,   { toValue: 1, duration: dur, easing: ease, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  /* ── interactive ask state ── */
  const [messages,  setMessages]  = useState<FeatureMsg[]>([]);
  const [askMode,   setAskMode]   = useState<AskMode>("idle");
  const [askErr,    setAskErr]    = useState("");
  const recorder   = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const scrollRef  = useRef<ScrollView>(null);

  const started = messages.length > 0 || askMode !== "idle";

  /* bills context for the AI (from onboarding store) */
  const billsCtx = useMemo(
    () =>
      bills.map((b) => ({
        provider: b.provider,
        cat:      b.cat,
        amount:   b.amount,
        dueDays:  b.dueDays,
        dueLabel: b.due,
        status:   "unpaid",
      })),
    [bills],
  );

  const doAsk = async (text: string) => {
    const q2 = text.trim();
    if (!q2 || askMode === "thinking") return;
    setAskErr("");
    setMessages((m) => [...m, { role: "user", text: q2 }]);
    setAskMode("thinking");
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      const { reply, audioBase64 } = await askOnboarding(q2, billsCtx, persona, language);
      const finalReply = reply?.trim() || "Hmm, I couldn\u2019t answer that just now.";
      setMessages((m) => [...m, { role: "judith", text: finalReply }]);
      setAskMode("speaking");
      if (audioBase64) await playBase64Mp3(audioBase64).catch(() => {});
    } catch {
      setMessages((m) => [
        ...m,
        { role: "judith", text: "Sorry, I couldn\u2019t connect right now. Try again in a moment." },
      ]);
    } finally {
      setAskMode("idle");
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const startRec = async () => {
    if (askMode !== "idle") return;
    setAskErr("");
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setAskErr("Microphone permission needed to ask by voice.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setAskMode("listening");
    } catch (e) {
      setAskErr(String((e as Error)?.message ?? e));
    }
  };

  const stopRec = async () => {
    setAskMode("thinking");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio captured");
      const base64 = await fileToBase64(uri);
      const { text } = await transcribeOnboarding(base64, "audio/m4a", sttHint(language));
      if (text?.trim()) {
        await doAsk(text);
      } else {
        setAskMode("idle");
      }
    } catch (e) {
      setAskErr(String((e as Error)?.message ?? e));
      setAskMode("idle");
    }
  };

  const busy        = askMode === "thinking" || askMode === "speaking";
  const listening   = askMode === "listening";
  const avatarState = listening ? "listening" : busy ? "speaking" : started ? "idle" : "speaking";

  return (
    <>
      <Scroll>
        {/* ── dot pagination ── */}
        <View style={{ flexDirection: "row", gap: 7, justifyContent: "center", marginBottom: 22 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: i === dotIdx ? 20 : 7,
                height: 7,
                borderRadius: i === dotIdx ? 4 : 3.5,
                backgroundColor: i === dotIdx ? t.accent : t.surface3,
              }}
            />
          ))}
        </View>

        {/* ── hero section — each variant has a distinct layout ── */}
        {!started ? (
          variant === 1 ? (
            /* Variant 1: Large avatar with glow rings + floating demo Q&A */
            <Animated.View
              style={{
                alignSelf: "stretch",
                minHeight: 220,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ translateY: floatY }],
              }}
            >
              <View style={{ gap: 11, width: "100%", alignItems: "center" }}>
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  <View style={{ position: "absolute", width: 138, height: 138, borderRadius: 69, backgroundColor: t.accent, opacity: 0.10 }} />
                  <View style={{ position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: t.accent, opacity: 0.10 }} />
                  <JudithAvatar persona={persona} size={88} state="speaking" mood={mood} />
                </View>
                <Animated.View style={{ alignSelf: "flex-end", opacity: tOpacity, transform: [{ translateY: tY }, { scale: tScale }] }}>
                  <Transcript>{q}</Transcript>
                </Animated.View>
                <Animated.View style={{ opacity: rOpacity, transform: [{ translateY: rY }, { scale: rScale }] }}>
                  <JudithLine>{a}</JudithLine>
                </Animated.View>
              </View>
            </Animated.View>
          ) : variant === 2 ? (
            /* Variant 2: Avatar inline with tappable quick-ask chips as the demo */
            <View style={{ minHeight: 220, justifyContent: "center", gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <JudithAvatar persona={persona} size={56} state="speaking" mood={mood} />
                <View style={{ flex: 1, gap: 8 }}>
                  {getQuickAsks(ctx.country.code).slice(0, 3).map((qa, i) => (
                    <Pressable
                      key={i}
                      onPress={() => doAsk(qa)}
                      disabled={busy || listening}
                      style={{
                        borderWidth: 1,
                        borderColor: t.hair,
                        borderRadius: 20,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        backgroundColor: t.surface2,
                        opacity: busy || listening ? 0.4 : 1,
                      }}
                    >
                      <Txt size={13}>{qa}</Txt>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Animated.View style={{ alignSelf: "flex-end", opacity: tOpacity, transform: [{ translateY: tY }, { scale: tScale }] }}>
                <Transcript>{q}</Transcript>
              </Animated.View>
              <Animated.View style={{ opacity: rOpacity, transform: [{ translateY: rY }, { scale: rScale }] }}>
                <JudithLine>{a}</JudithLine>
              </Animated.View>
            </View>
          ) : (
            /* Variant 3: Real bill insight card — shows the user's actual total + next due */
            (() => {
              const total   = bills.reduce((s, b) => s + b.amount, 0);
              const nextDue = bills.length > 0
                ? bills.reduce((a2, b) => (b.dueDays < a2.dueDays ? b : a2), bills[0]!)
                : null;
              return (
                <View style={{ minHeight: 220, justifyContent: "center", gap: 14 }}>
                  <View style={{ alignItems: "center" }}>
                    <JudithAvatar persona={persona} size={64} state={avatarState} mood={mood} />
                  </View>
                  <View style={{ backgroundColor: t.surface2, borderRadius: 18, padding: 20, gap: 4 }}>
                    <Txt size={12} color={t.txtLow} style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                      {isFil ? "Monthly total mo" : "Your monthly total"}
                    </Txt>
                    <Txt size={30} style={{ fontWeight: "700" }}>
                      {ctx.country.cur}{total > 0 ? total.toLocaleString() : "—"}
                    </Txt>
                    {nextDue && (
                      <Txt size={14} color={t.txtMid} style={{ marginTop: 6 }}>
                        {isFil
                          ? `Susunod: ${nextDue.provider} sa ${nextDue.dueDays} araw`
                          : `Next up: ${nextDue.provider} in ${nextDue.dueDays} day${nextDue.dueDays !== 1 ? "s" : ""}`}
                      </Txt>
                    )}
                  </View>
                </View>
              );
            })()
          )
        ) : (
          <View style={{ minHeight: 220 }}>
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <JudithAvatar persona={persona} size={60} state={avatarState} />
            </View>
            <ScrollView
              ref={scrollRef}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <View key={i} style={{ alignSelf: "flex-end" }}>
                    <Transcript>{m.text}</Transcript>
                  </View>
                ) : (
                  <JudithLine key={i}>{m.text}</JudithLine>
                ),
              )}
              {askMode === "thinking" && (
                <JudithLine>
                  <Low size={14}>Judith is thinking\u2026</Low>
                </JudithLine>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── listening indicator ── */}
        {listening && (
          <View style={{ alignItems: "center", marginTop: 6, gap: 4 }}>
            <VoiceBars accent={t.accent} />
            <Low size={12}>Listening\u2026</Low>
          </View>
        )}

        {/* ── error ── */}
        {!!askErr && (
          <Txt
            size={12}
            color={t.semantic.urgent}
            style={{ textAlign: "center", marginTop: 6, paddingHorizontal: 8 }}
          >
            {askErr}
          </Txt>
        )}

        {/* ── copy block ── */}
        <Kicker style={{ marginTop: 28, textAlign: "center" }}>{kicker}</Kicker>
        <Title style={{ textAlign: "center", maxWidth: 290 }}>{title}</Title>
        <Lede style={{ textAlign: "center", maxWidth: 285 }}>{lede}</Lede>

        {/* ── quick-ask chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
          style={{ marginTop: 6 }}
        >
          {getQuickAsks(ctx.country.code).slice(0, 4).map((qa, i) => (
            <Pressable
              key={i}
              onPress={() => doAsk(qa)}
              disabled={busy || listening}
              style={{
                borderWidth: 1,
                borderColor: t.hair,
                borderRadius: 20,
                paddingVertical: 7,
                paddingHorizontal: 13,
                backgroundColor: t.surface2,
                opacity: busy || listening ? 0.4 : 1,
              }}
            >
              <Txt size={13}>{qa}</Txt>
            </Pressable>
          ))}
        </ScrollView>
      </Scroll>

      <CtaBar>
        {/* ── mic row ── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Pressable
            onPress={listening ? stopRec : busy ? undefined : startRec}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: listening ? t.semantic.urgent : t.hair,
              borderRadius: 14,
              paddingVertical: 13,
              paddingHorizontal: 14,
              backgroundColor: listening
                ? mix(t.semantic.urgent, t.canvas, 0.12)
                : t.surface1,
            }}
          >
            <Icon
              name="mic"
              size={16}
              color={listening ? t.semantic.urgent : busy ? t.txtLow : t.txtMid}
            />
            <Txt size={14} color={listening ? t.semantic.urgent : t.txtLow}>
              {listening
                ? "Tap to send\u2026"
                : askMode === "thinking"
                  ? "Judith is thinking\u2026"
                  : askMode === "speaking"
                    ? "Judith is speaking\u2026"
                    : "Tap mic to ask Judith"}
            </Txt>
          </Pressable>

          <Pressable
            onPress={listening ? stopRec : busy ? undefined : startRec}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: listening ? t.semantic.urgent : busy ? t.surface2 : t.accent,
            }}
          >
            <Icon
              name="mic"
              size={22}
              color={listening ? "#fff" : busy ? t.txtLow : t.onAccent}
            />
          </Pressable>
        </View>

        <Btn label={dotIdx === 2 ? T("finish") : T("continue")} onPress={next} />
      </CtaBar>
    </>
  );
}

function ScreenFeature1({ ctx }: { ctx: Ctx }) {
  return (
    <FeatureShell
      ctx={ctx}
      dotIdx={0}
      variant={1}
      kicker="Ask anything"
      title="Just ask Judith."
      lede="Ask anything — she totals it across every card and bill, out loud, hands free."
      q={getDLocal(ctx.country.cur, ctx.country.code).askQ}
      a={getDLocal(ctx.country.cur, ctx.country.code).askA}
      mood="warm"
    />
  );
}
function ScreenFeature2({ ctx }: { ctx: Ctx }) {
  return (
    <FeatureShell
      ctx={ctx}
      dotIdx={1}
      variant={2}
      kicker="Always ready"
      title="Ask about anything."
      lede="Due dates, what’s coming up, what you owe — just talk, she answers."
      q={getDLocal(ctx.country.cur, ctx.country.code).askQ2}
      a={getDLocal(ctx.country.cur, ctx.country.code).askA2}
      mood="proud"
    />
  );
}
function ScreenFeature3({ ctx }: { ctx: Ctx }) {
  return (
    <FeatureShell
      ctx={ctx}
      dotIdx={2}
      variant={3}
      kicker="Full picture"
      title="She does the math."
      lede="Judith weighs what’s due before you spend — so you decide with the full picture."
      q={getDLocal(ctx.country.cur, ctx.country.code).askQ3}
      a={getDLocal(ctx.country.cur, ctx.country.code).askA3}
      mood="joy"
    />
  );
}

/* ================================================================== */
/* 16. Ask paywall                                                     */
/* ================================================================== */

function ScreenAskPaywall({ ctx }: { ctx: Ctx }) {
  const { t, persona, language, next } = ctx;
  const cur = ctx.country.cur;
  const paywallIsFil = isFilipino(language);
  useOnbVoice(JUDITH_VOICE.paywall[persona][paywallIsFil ? "fil" : "en"], persona, language);
  const [pick, setPick] = useState("chat");
  const tiers = [
    { id: "chat", name: "Chat Ask", price: 99, asks: "Unlimited text asks", sub: "Type anything, anytime", tag: undefined as string | undefined },
    { id: "voice", name: "Voice Ask", price: 199, asks: "Unlimited text + voice asks", sub: "Speak and listen — hands-free", tag: "Includes Chat" },
  ];
  const sel = tiers.find((x) => x.id === pick) || tiers[0]!;
  return (
    <>
      <Scroll center>
        <JudithAvatar persona={persona} size={72} state="speaking" mood="proud" />
        <Kicker style={{ marginTop: 16, textAlign: "center" }}>Ask Judith</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>You’ve got 8 free asks to start</Title>
        <Lede style={{ maxWidth: 290, textAlign: "center" }}>
          Try her free. Bills and reminders stay free forever. Upgrade when you’re ready for unlimited asks.
        </Lede>

        <View style={{ gap: 10, width: "100%", marginTop: 20 }}>
          {tiers.map((tier) => {
            const on = pick === tier.id;
            return (
              <Pressable
                key={tier.id}
                onPress={() => setPick(tier.id)}
                style={{ padding: 15, borderRadius: t.radius.md, borderWidth: 1, borderColor: on ? t.accent : t.hair, backgroundColor: on ? mix(t.accent, t.surface2, 0.1) : t.surface2 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? t.accent : t.hair, alignItems: "center", justifyContent: "center" }}>
                    {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Txt size={16} weight="semibold">{tier.name}</Txt>
                      {tier.tag && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: t.accent, borderRadius: 22, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: mix(t.accent, t.surface2, 0.16) }}>
                          <Icon name="star" size={10} color={t.txtHi} />
                          <Txt size={10} color={t.txtHi}>{tier.tag}</Txt>
                        </View>
                      )}
                    </View>
                    <Low size={12.5} style={{ marginTop: 2 }}>{tier.asks}</Low>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Mono size={20} weight="bold">{cur}{tier.price}</Mono>
                    <Low size={10}>/mo</Low>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Low size={11} style={{ marginTop: 12, textAlign: "center" }}>Cancel anytime · managed by App Store / Google Play</Low>
      </Scroll>
      <CtaBar>
        <Btn label={`Subscribe · ${cur}${sel.price}/mo`} onPress={next} />
        <Btn label="Start with 8 free asks" variant="ghost" onPress={next} />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* flow controller                                                    */
/* ================================================================== */

/** Concentric ring that expands and fades, looping — "tap to hear me" affordance. */
function PulseRing({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(p, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, p]);
  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 2,
        borderColor: color,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
      }}
    />
  );
}

/** Light diagonal accent sweep that wipes across when leaving the welcome screen. */
function SweepOverlay({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(-width * 1.4)).current;
  useEffect(() => {
    haptics.light();
    if (reduce) { onDone(); return; }
    Animated.timing(x, {
      toValue: width * 1.4,
      duration: 620,
      easing: Easing.bezier(0.6, 0, 0.3, 1),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onDone(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, overflow: "hidden" }}>
      <Animated.View
        style={{
          position: "absolute",
          top: -120,
          bottom: -120,
          width: width * 0.9,
          transform: [{ translateX: x }, { rotate: "12deg" }],
        }}
      >
        <LinearGradient
          colors={[withAlpha(t.accent, 0), withAlpha(t.accent, 0.5), withAlpha(t.accent, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

const FLOW: { id: string; C: (p: { ctx: Ctx }) => React.ReactElement }[] = [
  { id: "welcome", C: ScreenWelcome },
  { id: "name", C: ScreenName },
  { id: "country", C: ScreenCountry },
  { id: "language", C: ScreenLanguage },
  { id: "persona", C: ScreenPersona },
  { id: "latefee", C: ScreenLateFee },
  { id: "problem", C: ScreenProblem },
  { id: "stakes", C: ScreenStakes },
  { id: "intro", C: ScreenIntro },
  { id: "voice", C: ScreenVoiceAdd },
  { id: "congrats", C: ScreenCongrats },
  { id: "personalizing", C: ScreenPersonalizing },
  { id: "summary", C: ScreenSummary },
  { id: "feature1", C: ScreenFeature1 },
  { id: "feature2", C: ScreenFeature2 },
  { id: "feature3", C: ScreenFeature3 },
  { id: "askpaywall", C: ScreenAskPaywall },
];
const SETUP = ["name", "country", "language", "persona", "problem", "stakes", "intro", "voice", "congrats", "summary"];
const NO_BACK = ["welcome", "personalizing"];
const SKIPPABLE = ["country", "persona"];
const SAVE_FROM = FLOW.findIndex((f) => f.id === "voice");

export default function OnboardingScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const {
    persona,
    setPersona,
    country,
    setCountry,
    language,
    setLanguage,
    name,
    setName,
    onbIdx,
    setOnbIdx,
    setOnboarded,
  } = useJudith();

  const [idx, setIdx] = useState(() =>
    onbIdx >= SAVE_FROM && onbIdx < FLOW.length ? onbIdx : 0,
  );
  const [bills, setBills] = useState<OnbBill[]>([]);

  // vIn: screen entrance — opacity 0→1 + translateY 8→0 (400ms, prototype vIn keyframe)
  const vInOpacity = useRef(new Animated.Value(0)).current;
  const vInY      = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (idx >= SAVE_FROM) setOnbIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    vInOpacity.setValue(0);
    vInY.setValue(8);
    Animated.parallel([
      Animated.timing(vInOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.bezier(0.2, 0.7, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(vInY, {
        toValue: 0,
        duration: 400,
        easing: Easing.bezier(0.2, 0.7, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const screen = FLOW[idx]!;

  const [trans, setTrans] = useState<"word" | "question" | "sweep" | null>(null);

  const advance = (toIdx: number) => {
    if (toIdx >= FLOW.length) {
      setOnboarded(true);
      return;
    }
    setIdx(toIdx);
  };
  const finishTrans = () => { setTrans(null); advance(idx + 1); };
  const next = () => {
    if (screen.id === "welcome")  { setTrans("sweep");    return; }
    if (screen.id === "country")  { setTrans("word");     return; }
    if (screen.id === "latefee")  { setTrans("question"); return; }
    advance(idx + 1);
  };
  const back = () => setIdx((i) => Math.max(i - 1, 0));
  const addBill = (b: OnbBill) => setBills((arr) => [...arr, b]);

  const ctx = useMemo<Ctx>(
    () => ({ t, persona, setPersona, country, setCountry, language, setLanguage, name, setName, bills, addBill, next }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, persona, language, country, name, bills, idx],
  );

  const showProgress = SETUP.includes(screen.id);
  const showBack = !NO_BACK.includes(screen.id);
  const showSkip = SKIPPABLE.includes(screen.id);
  const myPos = SETUP.indexOf(screen.id);
  const Comp = screen.C;

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top }}>
      {/* nav */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 2, minHeight: 42 }}>
        {showBack ? (
          <Pressable
            onPress={back}
            style={({ pressed }) => [
              { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" },
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
          >
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <Icon name="chev" size={17} color={t.txtMid} />
            </View>
          </Pressable>
        ) : (
          <View style={{ width: 34 }} />
        )}
        {showProgress ? (
          <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
            {SETUP.map((s, i) => (
              <View
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 4,
                  backgroundColor: i < myPos ? t.txtLow : i === myPos ? t.accent : t.surface3,
                }}
              />
            ))}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {showSkip ? (
          <Pressable onPress={next}>
            <Txt size={14} color={t.txtLow}>{T("skip")}</Txt>
          </Pressable>
        ) : (
          <View style={{ width: 30 }} />
        )}
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: vInOpacity,
          transform: [{ translateY: vInY }],
        }}
      >
        <Comp ctx={ctx} key={screen.id + idx} />
      </Animated.View>

      {/* WordTransition — stamp overlay after country selection */}
      {trans === "word" && (
        <WordTransitionOverlay country={country} onDone={finishTrans} name={name} persona={persona} language={language} />
      )}

      {/* QuestionTransition — ? marks bubbling up after late-fee hook */}
      {trans === "question" && (
        <QuestionTransitionOverlay onDone={finishTrans} />
      )}

      {/* Sweep — light accent wipe leaving the welcome screen */}
      {trans === "sweep" && <SweepOverlay onDone={finishTrans} />}
    </View>
  );
}
