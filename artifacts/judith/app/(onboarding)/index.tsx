import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { HOUSES, QUICK_ASKS, type Bill } from "@/constants/data";
import { LANGUAGES, langSample, langDesc, isFilipino, sttHint } from "@/constants/languages";
import { PERSONAS, type PersonaId } from "@/constants/personas";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
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

const SAMPLES: Sample[] = [
  { group: 0, provider: "Ayala Land", cat: "Rent / Mortgage", subtype: "Rent", icon: "home", amount: 18000, due: "1st", dueDays: 1, utter: "My rent, eighteen thousand, due every 1st.", toks: ["rent", "eighteen thousand", "1st"] },
  { group: 0, provider: "Meralco", cat: "Electricity", icon: "zap", amount: 3450, due: "15th", dueDays: 6, utter: "My Meralco, around three thousand four fifty, due every 15th.", toks: ["Meralco", "three thousand four fifty", "15th"] },
  { group: 0, provider: "Maynilad", cat: "Water", icon: "droplet", amount: 890, due: "22nd", dueDays: 13, utter: "Then Maynilad water, about eight ninety, every 22nd.", toks: ["Maynilad", "eight ninety", "22nd"] },
  { group: 0, provider: "PLDT Home", cat: "Internet", icon: "wifi", amount: 1699, due: "5th", dueDays: 25, utter: "My PLDT internet, 1,699, on the 5th.", toks: ["PLDT", "1,699", "5th"] },
  { group: 1, provider: "Globe Postpaid", cat: "Mobile", icon: "smartphone", amount: 1299, due: "18th", dueDays: 8, utter: "My Globe phone plan, 1,299, every 18th.", toks: ["Globe", "1,299", "18th"] },
  { group: 1, provider: "iCloud+", cat: "Phone subscription", icon: "spark", amount: 149, due: "1st", dueDays: 14, utter: "iCloud storage, 149, on the 1st.", toks: ["iCloud", "149", "1st"] },
  { group: 1, provider: "Spotify", cat: "Phone subscription", icon: "spark", amount: 194, due: "7th", dueDays: 20, utter: "Spotify Premium, 194, every 7th.", toks: ["Spotify", "194", "7th"] },
  { group: 1, provider: "Netflix", cat: "TV / Streaming", icon: "spark", amount: 549, due: "28th", dueDays: 11, utter: "Netflix, 549, on the 28th.", toks: ["Netflix", "549", "28th"] },
  { group: 1, provider: "Disney+", cat: "TV / Streaming", icon: "spark", amount: 369, due: "12th", dueDays: 2, utter: "Disney Plus, 369, the 12th.", toks: ["Disney", "369", "12th"] },
  { group: 1, provider: "Canva Pro", cat: "Web app", icon: "spark", amount: 199, due: "9th", dueDays: 22, utter: "Canva Pro, 199, every 9th.", toks: ["Canva", "199", "9th"] },
];

interface CardLoanTpl {
  provider: string;
  amount: number;
  due: string;
  dueDays: number;
  utter: string;
  toks: string[];
}
const CARD_TEMPLATES: CardLoanTpl[] = [
  { provider: "BPI Mastercard", amount: 5200, due: "20th", dueDays: 4, utter: "My BPI Mastercard, 5,200 due, on the 20th.", toks: ["BPI", "5,200", "20th"] },
  { provider: "BDO Visa", amount: 3100, due: "25th", dueDays: 9, utter: "BDO Visa, around 3,100, the 25th.", toks: ["BDO", "3,100", "25th"] },
  { provider: "Metrobank", amount: 2800, due: "10th", dueDays: 23, utter: "Metrobank card, about 2,800, the 10th.", toks: ["Metrobank", "2,800", "10th"] },
  { provider: "UnionBank", amount: 1950, due: "15th", dueDays: 6, utter: "UnionBank, 1,950, every 15th.", toks: ["UnionBank", "1,950", "15th"] },
];
const LOAN_TEMPLATES: CardLoanTpl[] = [
  { provider: "Home Credit", amount: 2400, due: "3rd", dueDays: 16, utter: "Home Credit loan, 2,400 a month, on the 3rd.", toks: ["Home Credit", "2,400", "3rd"] },
  { provider: "Pag-IBIG", amount: 1800, due: "7th", dueDays: 20, utter: "Pag-IBIG housing loan, 1,800, the 7th.", toks: ["Pag-IBIG", "1,800", "7th"] },
  { provider: "Car loan · BPI", amount: 12500, due: "12th", dueDays: 2, utter: "Car loan with BPI, 12,500, the 12th.", toks: ["BPI", "12,500", "12th"] },
];

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

const PROMPTS: Record<string, string> = {
  "Rent / Mortgage": "Let’s start with the big one — rent or mortgage. How much, and when’s it due?",
  Electricity: "Now your electricity. Who’s the provider, how much, and when’s it due?",
  Water: "Next, your water. Provider, amount, and the due date?",
  Internet: "And your internet. Provider, amount, due date?",
  Mobile: "Now your phone plan — which carrier, how much, and when’s it due?",
  "Phone subscription": "The fastest way is to screenshot your Subscriptions list in Settings, then upload it. Or tell me each one — iCloud, Spotify, Apple Music.",
  "TV / Streaming": "Streaming — Netflix, Disney+, HBO? Which one, how much, when?",
  "Web app": "Any web apps? Canva, Notion, ChatGPT… name it, the cost, the date.",
  "Credit card": "Now the heavy ones. A credit card — which bank, the amount due, and the date?",
  "Personal loan": "Any loans? Lender, the monthly amount, and the due date.",
};

/** Tagalog/Taglish bill prompts — used when the user selected Filipino voice. */
const PROMPTS_FIL: Record<string, string> = {
  "Rent / Mortgage": "Simula tayo sa pinakamalaki — renta o mortgage. Magkano at kailan due?",
  Electricity: "Yung kuryente — sino ang provider, magkano, at kailan due?",
  Water: "Tubig naman — provider, halaga, at petsa ng due?",
  Internet: "Internet mo — provider, bayad, at due date?",
  Mobile: "Phone plan — anong network, magkano, at kailan bayaran?",
  "Phone subscription": "Pinaka-mabilis: mag-screenshot ng iyong Subscriptions sa Settings tapos i-upload. O sabihin mo sa akin isa-isa — iCloud, Spotify, at iba pa.",
  "TV / Streaming": "Streaming — Netflix, Disney+? Alin, magkano, kelan?",
  "Web app": "Mga web apps — Canva, Notion, ChatGPT? Pangalan, bayad, petsa.",
  "Credit card": "Yung credit cards — anong bangko, magkano ang due, at kailan?",
  "Personal loan": "Mga loans — sinong nagpahiram, magkano monthly, at kailan due?",
};

/** Supplementary voice lines for each Feature screen — not reading the UI, just personality. */
const FEATURE_VOICES = [
  "Try it — ask me anything about your bills. Just tap the mic and talk.",
  "Ask me which bills are due this week. I know all your due dates.",
  "I can even tell you if it\u2019s safe to spend before a big due date. Ask me anything.",
];

/**
 * Tagalog/Taglish equivalents for every canned onboarding voice line.
 * Keyed by the English source string. Used by useOnbVoice when isFilipino(language).
 */
const VOICE_LINES_FIL: Record<string, string> = {
  "Hi \u2014 I\u2019m Judith. I keep your bills organised and make sure you\u2019re never caught off guard by a due date. Let\u2019s get you set up.":
    "Hi — ako si Judith. Bantayan ko ang lahat ng iyong bills para hindi ka na mahuli sa due date. Tara, simulan na natin.",
  "I\u2019ll use your location to show the right currency and format your dates the way you\u2019d expect. Just tap your country.":
    "Gagamitin ko ang iyong lokasyon para sa tamang currency at format ng petsa. I-tap lang ang iyong bansa.",
  "These are real numbers. A missed payment hits your credit, your wallet, and your peace of mind. I\u2019m here to make sure it never gets to that.":
    "Tunay na numero ito. Ang isang napalampas na bayad ay nakakaapekto sa iyong credit, pitaka, at kapayapaan ng isip. Nandito ako para hindi na mangyari iyon.",
  "Alright \u2014 I\u2019ll ask about your bills one by one. Just speak naturally. Tell me the name, the amount, and when it\u2019s due. That\u2019s it.":
    "Sige — itatanong ko ang bawat bill isa-isa. Magsalita lang nang natural. Sabihin mo ang pangalan, halaga, at kailan due. Iyon lang.",
  "You\u2019re done. All your bills are in \u2014 you\u2019re already ahead of most people. Let me show you what I\u2019ve got.":
    "Tapos ka na. Nandito na ang lahat ng bills mo — mas maaga ka na kaysa sa karamihan. Ipapakita ko sa\u2019yo ang resulta.",
  "Give me just a second \u2014 I\u2019m putting your dashboard together right now.":
    "Sandali lang — ginagawa ko na ang iyong dashboard ngayon.",
  "Here\u2019s everything I know about your bills. Take a look \u2014 you can always adjust anything later.":
    "Ito ang lahat ng alam ko sa iyong mga bills. Tingnan mo — maaari mong baguhin kahit anong oras.",
  "Try it \u2014 ask me anything about your bills. Just tap the mic and talk.":
    "Subukan mo — tanungin mo ako tungkol sa iyong mga bills. I-tap lang ang mic at magsalita.",
  "Ask me which bills are due this week. I know all your due dates.":
    "Tanungin mo kung aling bills ang due ngayong linggo. Alam ko ang lahat ng due dates mo.",
  "I can even tell you if it\u2019s safe to spend before a big due date. Ask me anything.":
    "Masasabi ko rin kung ligtas bang gumastos bago ang malaking due date. Tanungin mo ako ng kahit ano.",
  "You\u2019ve got eight free asks to start. Want to keep the conversation going? Pick a plan that fits and I\u2019m all yours.":
    "Mayroon kang walong libreng tanong para magsimula. Gusto mong magpatuloy? Pumili ng plano na angkop sa\u2019yo at para mo na ako.",
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
    synthOnboarding(utterance, persona)
      .then(({ audioBase64 }) => {
        if (!cancelled) playBase64Mp3(audioBase64).catch(() => {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  });
}

const DLOCAL = {
  askQ: "“Judith, what’s my total credit card bill next month?”",
  askA: "“₱8,300 across BPI and BDO — both due before the 25th. Want a heads-up?”",
  askQ2: "“Judith, which bills are due this week?”",
  askA2: "“Three — Meralco, PLDT and your condo dues. ₱5,830 total. Want me to remind you the day before each?”",
  askQ3: "“Judith, I’ve got ₱30,000 left this month — can I afford ₱5,000 for a trip this week?”",
  askA3: "“You can, but keep it tight — ₱8,800 is due by Friday. After the trip you’d have ₱16,200 to cover the rest. Go, just don’t touch the bill money.”",
};

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
const dueClass = (d: number): "urgent" | "near" | "ok" =>
  d <= 3 ? "urgent" : d <= 7 ? "near" : "ok";

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
  bills: OnbBill[];
  addBill: (b: OnbBill) => void;
  next: () => void;
}

/* ------------------------------------------------------------------ */
/* Shared animation helpers                                            */
/* ------------------------------------------------------------------ */

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

/* ================================================================== */
/* 1. Welcome                                                          */
/* ================================================================== */

function ScreenWelcome({ ctx }: { ctx: Ctx }) {
  useOnbVoice("Hi — I\u2019m Judith. I keep your bills organised and make sure you\u2019re never caught off guard by a due date. Let\u2019s get you set up.", ctx.persona, ctx.language);
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
        <Lede style={{ maxWidth: 290, textAlign: "center" }}>
          Judith tracks every due date and reminds you in your own voice, your own language.
        </Lede>
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
  const { t, country, setCountry, next } = ctx;
  useOnbVoice("I\u2019ll use your location to show the right currency and format your dates the way you\u2019d expect. Just tap your country.", ctx.persona, ctx.language);
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
  const { t, persona, next, language, setLanguage } = ctx;
  const [voiceLang, setVoiceLang] = useState(language || "en");
  const [speaking, setSpeaking] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const langReqId = useRef(0);

  const playSample = async (code: string) => {
    const id = ++langReqId.current;
    setVoiceLang(code);
    setLanguage(code);
    setSpeaking(true);
    try {
      const { audioBase64 } = await synthOnboarding(langSample(code), persona);
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
            {speaking ? langSample(voiceLang) : "Tap ▸ to hear me in any language or dialect."}
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
        <Btn label={T("continue")} onPress={next} />
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

function ScreenPersona({ ctx }: { ctx: Ctx }) {
  const { t, persona, setPersona, next } = ctx;
  const [speakId, setSpeakId] = useState<PersonaId | null>(null);
  const selected = PERSONAS.find((p) => p.id === persona);
  const personaReqId = useRef(0);

  // Prefetch all 4 persona samples the moment this screen mounts so
  // "Play voice" taps are instant (hits the in-memory cache, no network round-trip).
  useEffect(() => {
    PERSONAS.forEach((p) => {
      fetchSampleOnboarding(p.id).catch(() => {});
    });
  }, []);

  const playLine = async (id: PersonaId) => {
    const reqId = ++personaReqId.current;
    setPersona(id);
    setSpeakId(id);
    try {
      const { audioBase64 } = await fetchSampleOnboarding(id);
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
          {PERSONAS.map((p) => {
            const on = persona === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => playLine(p.id)}
                style={{
                  width: `${(100 - 4) / 2}%` as `${number}%`,
                  borderWidth: 1,
                  borderColor: on ? withAlpha(t.accent, 0.6) : t.hair,
                  borderRadius: t.radius.md,
                  backgroundColor: t.surface2,
                  padding: 15,
                  gap: 10,
                }}
              >
                <JudithAvatar persona={p.id} size={52} state={speakId === p.id ? "speaking" : "idle"} />
                <View>
                  <Txt size={15} weight="semibold">{p.name}</Txt>
                  <Low size={12} style={{ marginTop: 2 }}>{p.vibe}</Low>
                </View>
                <View
                  style={{
                    alignSelf: "flex-start",
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
/* 5. Late fee (alert variant, persona=pro)                            */
/* ================================================================== */

function ScreenLateFee({ ctx }: { ctx: Ctx }) {
  const { t, persona, next } = ctx;
  const cur = ctx.country.cur;
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
  const { t, persona, next } = ctx;
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
    if (knows) { setTimeout(next, 480); return; }

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
  const { t, persona, next } = ctx;
  const cur = ctx.country.cur;
  useOnbVoice("These are real numbers. A missed payment hits your credit, your wallet, and your peace of mind. I\u2019m here to make sure it never gets to that.", persona, ctx.language);
  const [committed, setCommitted] = useState(false);

  /* commit animation values */
  const boxScale    = useRef(new Animated.Value(0.25)).current;
  const boxOpacity  = useRef(new Animated.Value(0)).current;
  const youScale    = useRef(new Animated.Value(0)).current;
  const youOpacity  = useRef(new Animated.Value(0)).current;
  const youRotate   = useRef(new Animated.Value(-6)).current;
  const ctrlOpacity = useRef(new Animated.Value(0)).current;
  const ctrlY       = useRef(new Animated.Value(14)).current;

  const commit = () => {
    setCommitted(true);
    Animated.parallel([
      /* commitBoxIn: scale 0.25 → 1.08 → 1, opacity 0 → 1 (0.8s) */
      Animated.parallel([
        Animated.timing(boxOpacity, { toValue: 1,    duration: 440, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(boxScale,   { toValue: 1.08, duration: 624, easing: Easing.bezier(0.2, 0.9, 0.3, 1.15), useNativeDriver: true }),
          Animated.timing(boxScale,   { toValue: 1,    duration: 176, useNativeDriver: true }),
        ]),
      ]),
      /* commitYouIn: scale 0 → 1.25 → 1, rotate −6° → 0 (0.7s, delay 0.5s) */
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(youOpacity, { toValue: 1,    duration: 350, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(youScale, { toValue: 1.25, duration: 385, easing: Easing.bezier(0.2, 0.9, 0.3, 1.3), useNativeDriver: true }),
            Animated.timing(youScale, { toValue: 1,    duration: 315, useNativeDriver: true }),
          ]),
          Animated.timing(youRotate,  { toValue: 0,    duration: 700, useNativeDriver: true }),
        ]),
      ]),
      /* commitCtrlIn: opacity 0→1, translateY 14→0 (0.4s, delay 0.8s) */
      Animated.sequence([
        Animated.delay(800),
        Animated.parallel([
          Animated.timing(ctrlOpacity, { toValue: 1, duration: 400, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true }),
          Animated.timing(ctrlY,       { toValue: 0, duration: 400, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => setTimeout(next, 2000));
  };

  return (
    <>
      <Scroll center>
        <JudithAvatar persona={persona} size={64} state="idle" />
        <Kicker style={{ textAlign: "center", marginTop: 14 }}>The fork</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>
          What if you keep going this way?
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
        <Btn label="No — let’s fix this" onPress={commit} />
      </CtaBar>

      {/* commitBoxIn overlay */}
      {committed && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.canvas, zIndex: 50, justifyContent: "center", alignItems: "center" }}>
          <View style={{ position: "absolute", width: "140%", height: "50%", left: "-20%", top: "25%", backgroundColor: withAlpha(t.accent, 0.07), borderRadius: 999, transform: [{ scaleY: 0.4 }] }} />
          <Animated.View style={{
            opacity: boxOpacity, transform: [{ scale: boxScale }],
            padding: 36, borderRadius: 28, borderWidth: 1, borderColor: withAlpha(t.accent, 0.28),
            backgroundColor: t.surface2, alignItems: "center", gap: 8, maxWidth: 300, width: "80%",
          }}>
            <Animated.View style={{
              opacity: youOpacity,
              transform: [
                { scale: youScale },
                { rotate: youRotate.interpolate({ inputRange: [-6, 0], outputRange: ["-6deg", "0deg"] }) },
              ],
            }}>
              <Txt size={52} weight="semibold" color={t.accent} style={{ letterSpacing: -1.5 }}>You</Txt>
            </Animated.View>
            <Animated.View style={{ opacity: ctrlOpacity, transform: [{ translateY: ctrlY }], alignItems: "center" }}>
              <Txt size={21} weight="semibold" color={t.txtHi} style={{ textAlign: "center", lineHeight: 28, letterSpacing: -0.3 }}>
                will start taking{"\n"}control today
              </Txt>
              <View style={{ marginTop: 8, height: 2, width: 140, borderRadius: 2, backgroundColor: t.accent, opacity: 0.7 }} />
            </Animated.View>
          </Animated.View>
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
  useOnbVoice("Alright \u2014 I\u2019ll ask about your bills one by one. Just speak naturally. Tell me the name, the amount, and when it\u2019s due. That\u2019s it.", persona, language);
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
  const [screenshotStatus, setScreenshotStatus] = useState<"idle" | "loading" | "done">("idle");
  const [screenshotBills, setScreenshotBills] = useState<{ provider: string; amount: number | null; dueDay: number | null }[]>([]);
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
      provider: parsedBill?.provider || sample.cat,
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
    setMode(manualReturn);
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
      for (const sub of subscriptions) {
        const b: OnbBill = {
          provider: sub.provider,
          cat: "Phone subscription",
          icon: "spark",
          amount: sub.amount ?? 0,
          due: sub.dueDay ? ordinal(sub.dueDay) : (sub.frequency === "annual" ? "annual" : "monthly"),
          dueDays: sub.dueDay ?? 20,
          kind: "Fixed",
          frequency: sub.frequency ?? "monthly",
        };
        addBill(b);
        saveBill(onbBillToStoreBill(b));
      }
      setScreenshotBills(subscriptions);
      setScreenshotStatus("done");
    } catch {
      setErr(isFilipino(language)
        ? "Hindi nabasa ang screenshot. Subukan muli o magsalita na lang."
        : "Couldn't read that screenshot. Try a clearer image or speak instead.");
      setScreenshotStatus("idle");
    }
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
      const VAD_MIN_MS = 800;        // settling period — sample ambient noise
      const VAD_SILENCE_MS = 1500;   // 1.5 s of silence after speech → auto-stop
      let adaptiveThreshold = -50;   // updated after settling
      let settlingComplete = false;
      const ambientReadings: number[] = [];
      vadIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - vadStart;
        const db = recorder.getStatus().metering;
        // Settling phase — collect ambient samples to calibrate threshold
        if (elapsed < VAD_MIN_MS) {
          if (db != null) ambientReadings.push(db);
          return;
        }
        // First tick past settling — lock adaptive threshold (ambient + 8 dBFS)
        if (!settlingComplete) {
          settlingComplete = true;
          if (ambientReadings.length > 0) {
            adaptiveThreshold = Math.max(...ambientReadings) + 8;
          }
        }
        // Metering unavailable on this device — fall back to elapsed-time gate
        if (db == null) {
          if (elapsed >= VAD_MIN_MS + VAD_SILENCE_MS) {
            clearVad();
            void stopListeningRef.current();
          }
          return;
        }
        if (db > adaptiveThreshold) {
          silenceRef.current.hasSpeech = true;
          if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
        } else if (silenceRef.current.hasSpeech && silenceRef.current.timer === null) {
          silenceRef.current.timer = setTimeout(() => {
            clearVad();
            void stopListeningRef.current();
          }, VAD_SILENCE_MS);
        }
      }, 100);
    } catch (e) {
      setErr(`Couldn’t start recording: ${String((e as Error)?.message ?? e)}`);
    }
  };

  const stopListening = async () => {
    clearVad(); // cancel any pending silence timer
    setMode("transcribing");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio captured");
      const base64 = await fileToBase64(uri);
      const { text } = await transcribeOnboarding(base64, "audio/m4a", sttHint(language));
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
            provider: "",
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
        : (isFil ? PROMPTS_FIL[sample.cat] : PROMPTS[sample.cat]) || (isFil ? "Sabihin mo ang tungkol sa bill na ito." : "Tell me about this bill.");

  /* Auto-play Judith's prompt aloud each time a new question appears. */
  const lastPlayedPromptKey = useRef("");
  useEffect(() => {
    if (mode !== "prompt") return;
    const key = `${phase}-${idx}-${cardDone}-${loanDone}`;
    if (key === lastPlayedPromptKey.current) return;
    lastPlayedPromptKey.current = key;
    let cancelled = false;
    synthOnboarding(promptText, persona)
      .then(({ audioBase64 }) => {
        if (!cancelled) return playBase64Mp3(audioBase64);
      })
      .catch(() => { /* silently skip if TTS unavailable */ });
    return () => {
      cancelled = true;
      stopCurrentAudio();
    };
  }, [mode, phase, idx, cardDone, loanDone, promptText, persona]);

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
          {mode === "prompt" && !done && isPhoneSub && screenshotStatus === "done" && (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <JudithAvatar persona={persona} size={44} state="speaking" />
                <JudithLine style={{ flex: 1 }}>
                  {isFil
                    ? `Nakuha ko! ${screenshotBills.length} subscription ang nadagdag sa listahan mo.`
                    : `Got them! Added ${screenshotBills.length} subscription${screenshotBills.length !== 1 ? "s" : ""} to your list.`}
                </JudithLine>
              </View>
              <View style={{ gap: 7, marginTop: 4 }}>
                {screenshotBills.map((b, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Icon name="spark" size={13} color={t.accent} />
                      <Txt size={14} weight="medium">{b.provider}</Txt>
                    </View>
                    {b.amount != null && <Mono size={13} color={t.txtMid}>{cur}{fmtNum(b.amount)}</Mono>}
                  </View>
                ))}
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
                  <Txt size={17} weight="semibold" color={parsedBill?.provider ? t.txtHi : t.semantic.near}>
                    {parsedBill?.provider || "Who is this with?"}
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
                <View style={{ marginTop: 14, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: withAlpha(t.accent, 0.45), backgroundColor: mix(t.accent, t.canvas, 0.07), maxWidth: 300 }}>
                  <Txt size={15} weight="semibold">{g.askTitle}</Txt>
                  <Low size={12} style={{ marginTop: 2 }}>{g.askSub}</Low>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, maxWidth: 300, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(t.semantic.ok, 0.32), backgroundColor: mix(t.semantic.ok, t.canvas, 0.11) }}>
                  <Icon name="check" size={14} color={t.semantic.ok} />
                  <Txt size={12.5} color={t.semantic.ok} style={{ flex: 1, lineHeight: 17 }}>
                    Saved — you can stop here and pick up later.
                  </Txt>
                </View>
              </View>
            );
          })()}

          {mode === "more" && (() => {
            const total = bills.reduce((s, b) => s + (b.amount || 0), 0);
            return (
              <View style={{ alignItems: "center" }}>
                <JudithAvatar persona={persona} size={68} state="speaking" />
                <JudithLine style={{ marginTop: 12 }}>
                  That’s {bills.length} so far — {cur}{fmtNum(total)}/mo. Any more cards, loans, or anything else? Gym, insurance, tuition? Let’s not miss any.
                </JudithLine>
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
                  placeholder={"e.g. " + (formCat.cat === "Electricity" ? "Meralco" : formCat.cat === "Water" ? "Maynilad" : "your provider")}
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
            {isPhoneSub && screenshotStatus === "done" && (
              <Btn label={isFil ? "Ituloy →" : "Continue →"} onPress={advanceAfterItem} />
            )}
            {screenshotStatus !== "done" && screenshotStatus !== "loading" && (
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
              <Btn label="Keep going →" onPress={() => { if (breatherGroup === 1) startCards(); else setMode("prompt"); }} />
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
      ? `Mayroon kang ${n} na bayarin \u2014 ${cur}${fmtNum(total)} bawat buwan. Handa na. Ipapakita ko sa\u2019yo.`
      : `You\u2019ve got ${n} bills \u2014 ${cur}${fmtNum(total)} a month. All set. Let me show you what I see.`;
    synthOnboarding(line, persona)
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
    const enLine = "Give me just a second \u2014 I\u2019m putting your dashboard together right now.";
    const utterance = (isFilipino(language) ? VOICE_LINES_FIL[enLine] : undefined) ?? enLine;
    synthOnboarding(utterance, persona)
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
      ? `Heto ang buong larawan — ${cur}${fmtNum(total)} bawat buwan, ${n} bayarin. Ang pinakamalaki ay ${biggest.provider} sa ${cur}${fmtNum(biggest.amount)}. Susunod na mag-e-expire: ${nextDue.provider}, sa loob ng ${nextDue.dueDays} araw. Hawak ko na ito.`
      : `Here's the full picture — ${cur}${fmtNum(total)} a month across ${n} bill${n === 1 ? "" : "s"}. Your biggest is ${biggest.provider} at ${cur}${fmtNum(biggest.amount)}. Next up: ${nextDue.provider} in ${nextDue.dueDays} day${nextDue.dueDays === 1 ? "" : "s"}. ${savings}`;
    synthOnboarding(line, ctx.persona)
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
}: {
  ctx: Ctx;
  dotIdx: number;
  kicker: string;
  title: string;
  lede: string;
  q: string;
  a: string;
  mood: "warm" | "proud" | "joy";
}) {
  const { t, persona, language, next, bills } = ctx;
  useOnbVoice(FEATURE_VOICES[dotIdx] ?? FEATURE_VOICES[0]!, persona, language);

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
      const { reply, audioBase64 } = await askOnboarding(q2, billsCtx, persona);
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

        {/* ── demo Q&A (before first ask) or real conversation ── */}
        {!started ? (
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
              <JudithAvatar persona={persona} size={72} state="speaking" mood={mood} />
              <Animated.View
                style={{
                  alignSelf: "flex-end",
                  opacity: tOpacity,
                  transform: [{ translateY: tY }, { scale: tScale }],
                }}
              >
                <Transcript>{q}</Transcript>
              </Animated.View>
              <Animated.View
                style={{
                  opacity: rOpacity,
                  transform: [{ translateY: rY }, { scale: rScale }],
                }}
              >
                <JudithLine>{a}</JudithLine>
              </Animated.View>
            </View>
          </Animated.View>
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
          {QUICK_ASKS.slice(0, 4).map((qa, i) => (
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
      kicker="Voice-first"
      title="Just ask Judith."
      lede="Ask anything — she totals it across every card and bill, out loud, hands free."
      q={DLOCAL.askQ}
      a={DLOCAL.askA}
      mood="warm"
    />
  );
}
function ScreenFeature2({ ctx }: { ctx: Ctx }) {
  return (
    <FeatureShell
      ctx={ctx}
      dotIdx={1}
      kicker="Voice-first"
      title="Ask about anything."
      lede="Due dates, what’s coming up, what you owe — just talk, she answers."
      q={DLOCAL.askQ2}
      a={DLOCAL.askA2}
      mood="proud"
    />
  );
}
function ScreenFeature3({ ctx }: { ctx: Ctx }) {
  return (
    <FeatureShell
      ctx={ctx}
      dotIdx={2}
      kicker="Voice-first"
      title="She does the math."
      lede="Judith weighs what’s due before you spend — so you decide with the full picture."
      q={DLOCAL.askQ3}
      a={DLOCAL.askA3}
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
  useOnbVoice("You\u2019ve got eight free asks to start. Want to keep the conversation going? Pick a plan that fits and I\u2019m all yours.", persona, language);
  const [pick, setPick] = useState("plus");
  const tiers = [
    { id: "plus", name: "Judith+", price: 99, asks: "50 voice asks / month", sub: "Plenty for most months", tag: undefined as string | undefined },
    { id: "pro", name: "Judith Unlimited", price: 199, asks: "Unlimited voice asks", sub: "Ask away, no counting", tag: "Best value" },
  ];
  const sel = tiers.find((x) => x.id === pick) || tiers[0]!;
  const food = countryFood(ctx.country.code);
  return (
    <>
      <Scroll center>
        <JudithAvatar persona={persona} size={72} state="speaking" mood="proud" />
        <Kicker style={{ marginTop: 16, textAlign: "center" }}>Ask Judith</Kicker>
        <Title style={{ maxWidth: 300, textAlign: "center" }}>You’ve got 8 free asks to start</Title>
        <Lede style={{ maxWidth: 290, textAlign: "center" }}>
          Try her out on the house. When you’re hooked, go Judith+ for more — she only ever talks about your bills. Ask her for a {food} recipe and she’ll politely send you back to your due dates. 🍲🚫
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
        <Low size={11} style={{ marginTop: 12, textAlign: "center" }}>Fair-use cap of 10 asks per hour · cancel anytime</Low>
      </Scroll>
      <CtaBar>
        <Btn label={`Start ${sel.name} · ${cur}${sel.price}/mo`} onPress={next} />
        <Btn label="Continue with 8 free asks" variant="ghost" onPress={next} />
      </CtaBar>
    </>
  );
}

/* ================================================================== */
/* flow controller                                                    */
/* ================================================================== */

const FLOW: { id: string; C: (p: { ctx: Ctx }) => React.ReactElement }[] = [
  { id: "welcome", C: ScreenWelcome },
  { id: "country", C: ScreenCountry },
  { id: "language", C: ScreenLanguage },
  { id: "persona", C: ScreenPersona },
  { id: "latefee", C: ScreenLateFee },
  { id: "problem", C: ScreenProblem },
  { id: "stakes", C: ScreenStakes },
  { id: "voice", C: ScreenVoiceAdd },
  { id: "congrats", C: ScreenCongrats },
  { id: "personalizing", C: ScreenPersonalizing },
  { id: "summary", C: ScreenSummary },
  { id: "feature1", C: ScreenFeature1 },
  { id: "feature2", C: ScreenFeature2 },
  { id: "feature3", C: ScreenFeature3 },
  { id: "askpaywall", C: ScreenAskPaywall },
];
const SETUP = ["country", "language", "persona", "problem", "stakes", "voice", "congrats", "summary"];
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

  const advance = (toIdx: number) => {
    if (toIdx >= FLOW.length) {
      setOnboarded(true);
      return;
    }
    setIdx(toIdx);
  };
  const next = () => advance(idx + 1);
  const back = () => setIdx((i) => Math.max(i - 1, 0));
  const addBill = (b: OnbBill) => setBills((arr) => [...arr, b]);

  const ctx = useMemo<Ctx>(
    () => ({ t, persona, setPersona, country, setCountry, language, setLanguage, bills, addBill, next }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, persona, language, country, bills, idx],
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
    </View>
  );
}
