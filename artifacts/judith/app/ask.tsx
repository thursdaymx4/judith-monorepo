import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import RA, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, withRepeat, withSequence, cancelAnimation, Easing as REasing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/lib/haptics";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Chip, Low, Muted, Pill, SpeechBubble, Txt, mix } from "@/components/ui";
import { makeBillFromAction, makeSubscriptionBill, currentCycleDue, nextOccurrence, totalOwed } from "@/constants/data";
import type { AskMsg } from "@/contexts/JudithStore";
import { getQuickAsks } from "@/constants/providers";
import { getPersona } from "@/constants/personas";
import { useJudith } from "@/contexts/JudithStore";
import { useAiConsent } from "@/contexts/AiConsentContext";
import { useTheme } from "@/hooks/useTheme";
import { enqueueAudio, fileToBase64, isAudioActive, resetAudioToPlayback, stopCurrentAudio } from "@/lib/audio";
import { safeBack } from "@/lib/navigation";
import { type AddBillAction, askJudith, synthesizeAiReply, parseSubscriptionScreenshot, transcribe, RateLimitError, TimeoutError, ServerError, UnauthorizedError, AbortedError } from "@/lib/proxy";
import { buildAskBills } from "@/lib/buildAskBills";
import { ensureMicPermission } from "@/lib/micPermission";
import { sttHint, isFilipino } from "@/constants/languages";
import { getPackageForTier, purchaseForTier, isPurchasesConfigured } from "@/lib/purchases";
import { PRIVACY_URL, TERMS_URL, openLegal } from "@/constants/legal";

/**
 * Returns true when the STT transcription is purely background-noise annotations
 * and contains no real speech. Strips parenthetical/bracketed sound descriptions
 * like "(beep)", "(footsteps thudding)", "[laughter]", etc., then checks whether
 * any letter/digit characters remain. Discarding these prevents sending noise to Judith.
 */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function isNoiseTranscript(text: string): boolean {
  const stripped = text.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
  return (stripped.match(/[\p{L}\p{N}]/gu) ?? []).length < 2;
}

interface ScanRow {
  provider: string;
  amount: string;
  dueDay: number | null;
  frequency: "monthly" | "annual";
  nextDue: string | null;
  include: boolean;
}

function scanDueLabel(nextDue: string | null, dueDay: number | null, frequency: "monthly" | "annual"): string {
  if (nextDue) {
    const d = new Date(`${nextDue}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const yr = new Date().getFullYear();
      return d.getFullYear() === yr
        ? `${M[d.getMonth()]} ${d.getDate()}`
        : `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
  }
  if (dueDay != null) return frequency === "annual" ? `day ${dueDay} · yearly` : `day ${dueDay} · monthly`;
  return "";
}

const BILL_WORDS =
  /bill|due|owe|owed|pay|paid|payment|total|month|week|today|tomorrow|balance|card|loan|rent|mortgage|electric|water|internet|mobile|subscription|netflix|spotify|meralco|when|how much|magkano|cost|charge|fee|money|budget|afford|salary|spend/i;

type Msg = AskMsg;

/* ── Animated typing dot ── */
function TypingDot({ delay }: { delay: number }) {
  const t = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-5, { duration: 280, easing: REasing.out(REasing.quad) }),
        withTiming(0, { duration: 280, easing: REasing.in(REasing.quad) }),
        withTiming(0, { duration: 160 }),
      ),
      -1,
    ));
    return () => cancelAnimation(y);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <RA.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.txtMid, opacity: 0.65 }, style]} />;
}

function TypingDots() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3 }}>
      <TypingDot delay={0} />
      <TypingDot delay={180} />
      <TypingDot delay={360} />
    </View>
  );
}

/* ── Spring-in wrapper for new messages ── */
function AnimMsg({ children }: { children: React.ReactNode }) {
  const op = useSharedValue(0);
  const ty = useSharedValue(10);
  const sc = useSharedValue(0.95);
  useEffect(() => {
    op.value = withTiming(1, { duration: 200 });
    ty.value = withSpring(0, { damping: 20, stiffness: 200 });
    sc.value = withSpring(1, { damping: 20, stiffness: 200 });
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }, { scale: sc.value }],
  }));
  return <RA.View style={style}>{children}</RA.View>;
}

export default function AskModal() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bills, asksLeft, tier, persona, language, country, currency, monthlyIncome, incomeByMonth, payCycle, paydayDay, paydaySemi, paydayWeekday, consumeAsk, addAsks, canUseVoice, saveBill, markPaid, payPartial, updateBillAmount, showToast, toggles, setToggle, askHistory, setAskHistory, clearAskHistory, hydrated, customQuestions, addCustomQuestion, deleteCustomQuestion, subscribe } = useJudith();
  // Shared AI-consent gate (Apple 5.1.1(i)/5.1.2(i)). The legacy inline
  // consent modal below covers the Ask Judith voice/text path; this hook
  // covers the receipt/bill-screenshot scan paths so the user sees one
  // unified consent before any image leaves the device.
  const { ensure: ensureAiConsentShared } = useAiConsent();
  // Voice tier can mute spoken replies (e.g. in public) and get text-only answers.
  const speakAloud = toggles.voiceReplies;
  const voiceTier = tier === "voice";
  const [rateLimitSecs, setRateLimitSecs] = React.useState(0);
  const lastAskRef = useRef<number>(0);
  // Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (rateLimitSecs <= 0) return;
    const id = setTimeout(() => setRateLimitSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [rateLimitSecs]);
  const [voiceUpgradeVisible, setVoiceUpgradeVisible] = React.useState(false);
  // AI consent now lives in the shared AiConsentProvider (lib/aiConsent.ts
  // + contexts/AiConsentContext.tsx). Every AI-touching surface in the app
  // (Ask Judith, receipt scan, onboarding voice + parse) gates on the same
  // one-time opt-in stored under `judith.aiDisclosureConsent.v3`. Migrated
  // off the prior inline v2 system to give Apple reviewers a single,
  // unmistakable consent surface that fires at the FIRST third-party AI
  // call regardless of which screen triggers it.
  /** When non-null, we just completed a successful purchase — show the
   *  inline congrats card so the user knows the entitlement is live. */
  const [purchasedTier, setPurchasedTier] = React.useState<"chat" | "voice" | null>(null);
  /** Disables the in-modal CTAs while StoreKit / RC is in flight. */
  const [buyingTier, setBuyingTier] = React.useState<"chat" | "voice" | null>(null);

  /**
   * Trigger a direct StoreKit purchase from any in-screen paywall surface
   * (the voice-upgrade modal AND the out-of-asks empty state). Mirrors
   * plans.tsx's executeBuy semantics so behavior is identical wherever the
   * user buys from:
   *   - production + missing RC package → toast "Purchase unavailable"
   *   - __DEV__ + missing package       → engineering free-grant for testing
   *   - package present                 → real Apple sheet via
   *                                       purchaseForTier(); on success
   *                                       subscribe(tier) + congrats card.
   * The CTAs disable themselves via buyingTier so the user can't double-tap
   * into a duplicate purchase.
   */
  const buyTierFromAsk = async (targetTier: "chat" | "voice") => {
    if (buyingTier) return;
    if (!isPurchasesConfigured) {
      // Production builds MUST have EXPO_PUBLIC_REVENUECAT_API_KEY_IOS set;
      // surface a distinct error so we don't silently look like "cancelled".
      showToast("Purchases not configured on this build");
      return;
    }
    setBuyingTier(targetTier);
    try {
      const pkg = await getPackageForTier(targetTier);
      if (!pkg) {
        if (__DEV__) {
          subscribe(targetTier);
          setPurchasedTier(targetTier);
          setVoiceUpgradeVisible(false);
          showToast(targetTier === "voice" ? "Voice Ask activated ✓ (dev)" : "Chat Ask activated ✓ (dev)");
          return;
        }
        showToast("Purchase unavailable — please try again later");
        return;
      }
      const newTier = await purchaseForTier(pkg);
      if (newTier !== "free") {
        subscribe(newTier);
        setPurchasedTier(newTier === "voice" ? "voice" : "chat");
        setVoiceUpgradeVisible(false);
      } else {
        // Apple sheet was shown and dismissed without buying — silent. Avoid
        // "Purchase failed" toast here because the user explicitly chose to
        // back out.
      }
    } catch {
      showToast("Purchase failed — try again");
    } finally {
      setBuyingTier(null);
    }
  };

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const isPaid = tier === "chat" || tier === "voice";
  const unlimited = isPaid;
  const locked = tier === "free" && asksLeft <= 0;
  const voiceLocked = !canUseVoice() && !locked;
  const lowAsks = !isPaid && asksLeft > 0 && asksLeft <= 3;

  // Initialise from persisted history (store is usually hydrated before the modal opens).
  const [messages, setMessages] = useState<Msg[]>(() => askHistory);
  // Ref mirrors local state so appendAndPersist can read the latest value synchronously.
  const messagesRef = useRef<Msg[]>(askHistory);
  // Once the store finishes hydrating (edge case: modal opened before hydration), sync history.
  const historyLoadedRef = useRef(hydrated);
  useEffect(() => {
    if (hydrated && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      if (askHistory.length > 0 && messagesRef.current.length === 0) {
        messagesRef.current = askHistory;
        setMessages(askHistory);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /** Append a message, update local state, and persist to the store. */
  const appendAndPersist = (msg: Msg) => {
    const next = [...messagesRef.current, msg].slice(-100);
    messagesRef.current = next;
    setMessages(next);
    setAskHistory(next);
  };

  /** Append a message to local state only — used for streaming placeholders. */
  const appendNoPersist = (msg: Msg) => {
    const next = [...messagesRef.current, msg].slice(-100);
    messagesRef.current = next;
    setMessages(next);
  };

  /** Update the text of the last judith message in-place — used during streaming. */
  const updateLatestMsg = (text: string) => {
    const msgs = messagesRef.current;
    if (!msgs.length || msgs[msgs.length - 1].role !== "judith") return;
    const next = [...msgs.slice(0, -1), { ...msgs[msgs.length - 1], text }];
    messagesRef.current = next;
    setMessages(next);
  };

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [err, setErr] = useState("");
  // The last question that failed (timeout / connection) — drives the Retry button.
  const [lastFailedQ, setLastFailedQ] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Track whether we've done the initial jump-to-bottom on open; after that,
  // scroll is driven by the per-message requestAnimationFrame calls below.
  const hasInitialScrolled = useRef(false);

  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; hasSpeech: boolean }>({ timer: null, hasSpeech: false });
  const clearVad = () => {
    if (vadIntervalRef.current !== null) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
  };
  useEffect(() => clearVad, []);

  // Tracks the AbortController for the in-flight ask request so the unmount
  // effect (and the next ask) can cancel it instead of waiting on the 45s
  // server-side timeout. Without this, closing the screen mid-request leaves
  // the fetch + SSE reader alive on the JS thread — the UI feels frozen.
  const inFlightAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Always cancel any in-flight request on unmount.
      inFlightAbortRef.current?.abort();
      inFlightAbortRef.current = null;
      // Stop audio only if we were mid-request (no audio playing yet).
      // If Judith was already speaking the user tapped X, let it finish.
      if (!isAudioActive()) stopCurrentAudio();
      recorder.stop().catch(() => {});
      resetAudioToPlayback().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * X-button close handler.
   * - Thinking (in-flight request): abort immediately so the fetch is cancelled
   *   BEFORE navigation starts, preventing the "stuck thinking" feeling.
   * - Speaking (audio playing, no request): navigate without stopping audio —
   *   Judith keeps talking while the user returns to the previous screen.
   */
  const handleClose = useCallback(() => {
    const wasThinking = inFlightAbortRef.current != null;
    if (wasThinking) {
      inFlightAbortRef.current!.abort();
      inFlightAbortRef.current = null;
      stopCurrentAudio();
    }
    safeBack(router);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const [scanBusy, setScanBusy] = useState(false);
  const [scanRows, setScanRows] = useState<ScanRow[] | null>(null);
  const [addQVisible, setAddQVisible] = useState(false);
  const [newQText, setNewQText] = useState("");
  const [deletingQIdx, setDeletingQIdx] = useState<number | null>(null);
  const includedCount = scanRows?.filter((r) => r.include).length ?? 0;

  const processScanAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setScanBusy(true);
    try {
      const { subscriptions } = await parseSubscriptionScreenshot(
        asset.base64!,
        asset.mimeType || "image/jpeg",
      );
      if (subscriptions.length === 0) {
        setErr("No subscriptions found in that image. Try a clearer photo.");
        return;
      }
      setScanRows(
        subscriptions.map((s) => ({
          provider: s.provider,
          amount: s.amount != null ? String(s.amount) : "",
          dueDay: s.dueDay,
          frequency: s.frequency,
          nextDue: s.nextDue,
          include: true,
        })),
      );
    } catch (e) {
      setErr(`Couldn't read that image: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setScanBusy(false);
    }
  };

  const scanFromLibrary = async () => {
    // Apple 5.1.1(i)/5.1.2(i): receipt/screenshot scans send images to
    // Claude vision via our server. Explicit AI consent before the picker
    // opens so the user can't accidentally upload before being informed.
    if (!(await ensureAiConsentShared())) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr("Photo library access is needed to scan a bill. You can type instead.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    await processScanAsset(result.assets[0]!);
  };

  const scanFromCamera = async () => {
    if (!(await ensureAiConsentShared())) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErr("Camera access is needed to take a photo. You can upload one instead.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    await processScanAsset(result.assets[0]!);
  };

  const scanSubscriptions = () => {
    if (busy || scanBusy) return;
    setErr("");
    Alert.alert("Scan a Bill", "How do you want to add a photo?", [
      { text: "Take Photo", onPress: () => void scanFromCamera() },
      { text: "Upload from Library", onPress: () => void scanFromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const patchScanRow = (i: number, patch: Partial<ScanRow>) =>
    setScanRows((rows) => rows?.map((r, j) => (j === i ? { ...r, ...patch } : r)) ?? rows);

  const confirmScannedBills = () => {
    if (!scanRows) return;
    const stamp = Date.now();
    scanRows
      .filter((r) => r.include)
      .forEach((r, i) => {
        const amt = Number(r.amount.replace(/[^0-9.]/g, ""));
        saveBill(
          makeSubscriptionBill(
            {
              provider: r.provider.trim() || "Subscription",
              amount: Number.isFinite(amt) && amt > 0 ? amt : null,
              dueDay: r.dueDay,
              frequency: r.frequency,
              nextDue: r.nextDue,
            },
            `${stamp}-${i}`,
          ),
        );
      });
    setScanRows(null);
  };

  const started = messages.length > 0 || busy;
  const p = getPersona(persona);

  const localFallback = (q: string): string => {
    if (!BILL_WORDS.test(q)) {
      return "That's outside my lane — I only handle your bills and due dates. Ask me anything about those and I'm all yours.";
    }
    const lower = q.toLowerCase();
    const now = new Date();
    const unpaid = bills.filter((b) => b.status !== "paid");

    // Credit-card total query
    if (/credit.?card|credit card/i.test(lower) && /total|sum|how much|magkano|lahat/i.test(lower)) {
      const cards = unpaid.filter((b) => b.cat === "Credit card");
      if (cards.length === 0) return "No unpaid credit card bills right now.";
      const total = cards.reduce((s, b) => s + totalOwed(b), 0);
      return `You have ${cards.length} credit card ${cards.length === 1 ? "bill" : "bills"} totaling ${currency}${Math.round(total).toLocaleString("en-US")} unpaid.`;
    }

    // Overdue query
    if (/overdue|late|past.?due/i.test(lower)) {
      const overdue = unpaid.filter((b) => (currentCycleDue(b, now).dueDays) < 0);
      if (overdue.length === 0) return "No overdue bills — you're all caught up!";
      const total = overdue.reduce((s, b) => s + totalOwed(b), 0);
      return `You have ${overdue.length} overdue ${overdue.length === 1 ? "bill" : "bills"} totaling ${currency}${Math.round(total).toLocaleString("en-US")}.`;
    }

    // This-week query
    if (/this week|this 7 days|7 days/i.test(lower)) {
      const thisWeek = unpaid.filter((b) => {
        const d = currentCycleDue(b, now).dueDays;
        return d >= 0 && d <= 7;
      });
      if (thisWeek.length === 0) return "Nothing new due this week.";
      const total = thisWeek.reduce((s, b) => s + totalOwed(b), 0);
      return `${thisWeek.length} ${thisWeek.length === 1 ? "bill" : "bills"} due this week — ${currency}${Math.round(total).toLocaleString("en-US")} total.`;
    }

    // Monthly total query
    if (/total|this month|monthly|month/i.test(lower)) {
      const monthBills = unpaid.filter((b) => {
        const d = currentCycleDue(b, now).dueDays;
        return d >= -31 && d <= 31;
      });
      if (monthBills.length === 0) return "No bills due this month.";
      const total = monthBills.reduce((s, b) => s + totalOwed(b), 0);
      return `${monthBills.length} ${monthBills.length === 1 ? "bill" : "bills"} this month — ${currency}${Math.round(total).toLocaleString("en-US")} total.`;
    }

    // Default: next upcoming bill
    const next = unpaid
      .map((b) => ({ b, occ: nextOccurrence(b, now) }))
      .sort((a, b) => a.occ.dueDays - b.occ.dueDays)[0];
    return next
      ? `Your next bill is ${next.b.provider} — ${currency}${Math.round(next.b.amount).toLocaleString("en-US")}, due ${next.occ.dueLabel}.`
      : "You're all caught up — nothing due right now.";
  };

  /** Show localFallback with a minimum thinking delay so it never feels instant. */
  const fallbackWithDelay = async (q: string, minMs = 900): Promise<string> => {
    const [answer] = await Promise.all([
      Promise.resolve(localFallback(q)),
      new Promise<void>((r) => setTimeout(r, minMs)),
    ]);
    return answer;
  };

  const ask = async (text: string) => {
    const q = (text || "").trim();
    if (!q || busy) return;
    if (locked) {
      router.push("/plans");
      return;
    }
    // Apple Guideline 5.1.1(i)/5.1.2(i) — block until the user has
    // explicitly accepted the AI data-sharing disclosure. The shared
    // AiConsentProvider surfaces the modal globally and resolves to
    // true/false on accept/decline.
    if (!(await ensureAiConsentShared())) return;
    // Honor an active rate-limit cooldown for ALL entry points (Retry button and
    // quick-ask chips included), not just the disabled text input / mic.
    if (rateLimitSecs > 0) return;
    // 1-second minimum cooldown between successive asks (client-side guard)
    const now = Date.now();
    if (now - lastAskRef.current < 1000) return;
    lastAskRef.current = now;
    setErr("");
    setLastFailedQ(null);
    setInput("");
    appendAndPersist({ role: "user", text: q });
    if (!isPaid) consumeAsk();
    setBusy(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    // Cancel any prior in-flight ask before starting a new one, then track this
    // request so unmount can abort it cleanly.
    inFlightAbortRef.current?.abort();
    const abortCtrl = new AbortController();
    inFlightAbortRef.current = abortCtrl;
    try {
      // Speak aloud only when the user hasn't muted replies (voice tier) — saves TTS cost and stays silent in public.
      // The mute only applies to the voice tier; other tiers (e.g. free with asks left) are unaffected.
      const wantVoice = !forceTextOnly && canUseVoice() && (!voiceTier || speakAloud);
      // Send the last 5 messages as conversation history (excluding the just-appended user turn).
      const MAX_HISTORY = 5;
      const historyMsgs = messagesRef.current.slice(0, -1).slice(-MAX_HISTORY).map((m) => ({
        role: m.role === "user" ? "user" : "assistant" as "user" | "assistant",
        text: m.text,
      }));
      appendNoPersist({ role: "judith", text: "" });
      // Request text only — never block the reply on server-side TTS. The text
      // renders the moment the model responds, then (if voice is wanted) we fetch
      // and play the audio as a follow-up so it trails the text instead of gating it.
      const { reply, action, actions, ttsToken } = await askJudith(
        q, buildAskBills(bills), persona, language, false, currency, country.name,
        monthlyIncome, country.code,
        Object.keys(incomeByMonth).length > 0 ? incomeByMonth : undefined,
        payCycle, paydayDay, paydaySemi, paydayWeekday,
        historyMsgs.length > 0 ? historyMsgs : undefined,
        abortCtrl.signal,
      );
      const finalReply = reply?.trim() || await fallbackWithDelay(q);
      updateLatestMsg(finalReply);
      // Fire-and-forget audio for Judith's reply. Trails the on-screen text by one
      // fast (flash-model) TTS round-trip. The ttsToken authorizes the fast path;
      // only fire it when the reply matches what the server signed. Skip if this
      // ask was superseded/unmounted.
      if (wantVoice && reply?.trim() && ttsToken) {
        synthesizeAiReply(finalReply, persona, language, country.code, ttsToken)
          .then(({ audioBase64 }) => {
            if (audioBase64 && !abortCtrl.signal.aborted) enqueueAudio(audioBase64);
          })
          .catch(() => { /* no audio is acceptable — text already shown */ });
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
      setAskHistory([...messagesRef.current]);
      // Apply every action the model emitted, in order. Multi-bill asks
      // ("mark Netflix and Spotify paid", "log ₱1 on BPI and ₱1 on UnionBank")
      // emit one tag per bill; we iterate so all of them land. Falls back to
      // the legacy single `action` only when the server hasn't migrated to
      // the array shape yet.
      const actionsToApply = (actions && actions.length > 0)
        ? actions
        : (action ? [action] : []);
      const appliedNames: string[] = [];
      for (const a of actionsToApply) {
        if (a?.type === "add_bill") {
          const bill = makeBillFromAction(a as AddBillAction);
          saveBill(bill);
          appliedNames.push(bill.provider);
        } else if (a?.type === "mark_paid") {
          const id = a.id as string | undefined;
          if (id) {
            markPaid(id);
            const b = bills.find((x) => x.id === id);
            if (b?.provider) appliedNames.push(b.provider);
          }
        } else if (a?.type === "add_payment") {
          const id = a.id as string | undefined;
          const amount = typeof a.amount === "number" ? a.amount : 0;
          if (id && amount > 0) {
            payPartial(id, amount);
            const b = bills.find((x) => x.id === id);
            if (b?.provider) appliedNames.push(b.provider);
          }
        } else if (a?.type === "update_amount") {
          const id = a.id as string | undefined;
          const amount = typeof a.amount === "number" ? a.amount : 0;
          if (id && amount > 0) {
            updateBillAmount(id, amount);
            const b = bills.find((x) => x.id === id);
            if (b?.provider) appliedNames.push(b.provider);
          }
        } else if (a?.type === "update_bill") {
          const id = a.id as string | undefined;
          const existing = id ? bills.find((x) => x.id === id) : undefined;
          if (existing) {
            const updated = {
              ...existing,
              ...(typeof a.cat === "string" && a.cat ? { cat: a.cat } : {}),
              ...(a.kind === "Fixed" || a.kind === "Variable" ? { kind: a.kind as "Fixed" | "Variable" } : {}),
              ...(typeof a.reminderDays === "number" ? { reminderDays: a.reminderDays } : {}),
              ...(typeof a.reminderHour === "number" ? { reminderHour: Math.max(0, Math.min(23, Math.round(a.reminderHour))) } : {}),
              ...(typeof a.isBusiness === "boolean" ? { isBusiness: a.isBusiness } : {}),
              ...(typeof a.house === "string" && a.house ? { house: a.house } : {}),
              ...(typeof a.chargedToCard === "boolean" ? { chargedToCard: a.chargedToCard } : {}),
            };
            saveBill(updated);
            appliedNames.push(existing.provider);
          }
        }
      }
      // Single combined toast when 2+ actions applied — avoids stacking
      // 5 toasts when the user updates multiple bills in one sentence.
      if (appliedNames.length === 1) {
        showToast(`Updated: ${appliedNames[0]}`);
      } else if (appliedNames.length > 1) {
        showToast(`Updated ${appliedNames.length} bills`);
      }
    } catch (e) {
      // Screen unmounted or a newer ask superseded this one — silently bail.
      // No state updates: the component is gone or about to be.
      if (e instanceof AbortedError) return;
      const isFil = isFilipino(language ?? "fil");
      const showJudithMsg = (text: string) => {
        const last = messagesRef.current[messagesRef.current.length - 1];
        if (last?.role === "judith" && last.text === "") {
          updateLatestMsg(text);
          setAskHistory([...messagesRef.current]);
        } else {
          appendAndPersist({ role: "judith", text });
        }
      };
      if (e instanceof RateLimitError) {
        // Server rejected before answering — refund the ask for free-tier users.
        if (!isPaid) addAsks(1);
        setRateLimitSecs(Math.min(e.retryAfter, 3600));
        showJudithMsg(isFil
          ? `Sandali lang — maghintay ka ng ${e.retryAfter} segundo bago magtanong ulit.`
          : `You're sending too fast — please wait ${e.retryAfter} second${e.retryAfter === 1 ? "" : "s"} before asking again.`
        );
      } else if (e instanceof UnauthorizedError) {
        // Signed-out / expired session — retrying won't help, so don't offer Retry.
        if (!isPaid) addAsks(1);
        showJudithMsg(isFil
          ? "Naka-sign out ka — i-sign in ulit sa Account para magamit ang Ask Judith."
          : "You're signed out — please sign back in from Account to use Ask Judith."
        );
      } else {
        // Timeout, server error, or connection failure — refund the ask, remember
        // the question so the user can retry with one tap.
        if (!isPaid) addAsks(1);
        setLastFailedQ(q);
        const timedOut = e instanceof TimeoutError;
        const serverSide = e instanceof ServerError;
        await new Promise<void>((r) => setTimeout(r, 600));
        showJudithMsg(timedOut
          ? (isFil
            ? "Pasensya, ang tagal ng sagot — baka mahina ang connection. Pindutin ang Subukang muli sa baba."
            : "Sorry, that took too long — your connection may be slow. Tap Retry below to try again.")
          : serverSide
            ? (isFil
              ? "May problema sa server — hindi kasalanan ng connection mo. Pindutin ang Subukang muli."
              : "Something went wrong on my end — not your connection. Tap Retry below.")
            : (isFil
              ? "Hindi ako makakonekta sa server — i-check ang connection mo, tapos pindutin ang Subukang muli."
              : "I can't connect to the server — check your connection, then tap Retry below.")
        );
      }
    } finally {
      if (inFlightAbortRef.current === abortCtrl) inFlightAbortRef.current = null;
      setBusy(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    }
  };

  const startRecording = async () => {
    if (busy) return;
    if (locked) {
      router.push("/plans");
      return;
    }
    // Chat Ask subscribers can only do text asks — voice requires Voice Ask tier
    if (voiceLocked) {
      setVoiceUpgradeVisible(true);
      return;
    }
    setErr("");
    try {
      const mic = await ensureMicPermission();
      if (!mic.ok) {
        if (mic.reason === "denied" && !mic.canAskAgain) {
          setErr("Microphone access is off. Enable it in iPhone Settings, or type instead.");
          Alert.alert(
            "Microphone access is off",
            "Judith needs microphone access for voice questions. You can turn it on in Settings.",
            [
              { text: "Type instead", style: "cancel" },
              { text: "Open Settings", onPress: () => void Linking.openSettings() },
            ],
          );
        } else {
          setErr("Microphone permission is needed. You can type instead.");
        }
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      // ── Auto-stop after a natural pause (Voice Activity Detection) ────
      clearVad();
      silenceRef.current = { timer: null, hasSpeech: false };
      const vadStart = Date.now();
      const VAD_MIN_MS = 800;        // settling period — sample ambient noise
      const VAD_SILENCE_MS = 3000;   // 3 s of trailing silence → auto-stop (allows natural mid-sentence pauses)
      const VAD_MAX_MS = 30000;      // hard ceiling — never record more than 30 s
      let adaptiveThreshold = -50;   // updated after settling
      let settlingComplete = false;
      const ambientReadings: number[] = [];
      vadIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - vadStart;
        const db = recorder.getStatus().metering;
        // Hard ceiling — safety net for edge cases
        if (elapsed >= VAD_MIN_MS + VAD_MAX_MS) {
          clearVad();
          void stopRecordingRef.current();
          return;
        }
        // Settling phase — collect ambient samples to calibrate threshold
        if (elapsed < VAD_MIN_MS) {
          if (db != null) ambientReadings.push(db);
          return;
        }
        // First tick past settling — lock adaptive threshold.
        // Use the MEDIAN of ambient readings (not max) so that any speech that
        // leaked into the settling window doesn't inflate the threshold and make
        // the user's actual speech invisible to the VAD.
        if (!settlingComplete) {
          settlingComplete = true;
          if (ambientReadings.length > 0) {
            const sorted = [...ambientReadings].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)] ?? -50;
            adaptiveThreshold = median + 8; // 8 dBFS above median ambient
          }
        }
        // Metering unavailable on this device — fall back to elapsed-time gate
        if (db == null) {
          if (elapsed >= VAD_MIN_MS + VAD_SILENCE_MS) {
            clearVad();
            void stopRecordingRef.current();
          }
          return;
        }
        if (db > adaptiveThreshold) {
          // Active speech — mark it and cancel any pending silence timer
          silenceRef.current.hasSpeech = true;
          if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
        } else if (silenceRef.current.hasSpeech && silenceRef.current.timer === null) {
          // Trailing silence AFTER the user has spoken — wait VAD_SILENCE_MS so
          // natural mid-sentence pauses (recalling amounts, due dates) don't cut off.
          silenceRef.current.timer = setTimeout(() => {
            clearVad();
            void stopRecordingRef.current();
          }, VAD_SILENCE_MS);
        }
        // Pre-speech silence — do nothing; let the user take their time to start
      }, 100);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg.toLowerCase().includes("permission")) {
        setErr("Microphone permission denied — allow it in iPhone Settings and try again.");
        Alert.alert(
          "Microphone permission needed",
          "Turn on microphone access for Judith in Settings, then try the mic again.",
          [
            { text: "Type instead", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
      } else {
        setErr("Microphone couldn't start — try again in a moment.");
      }
    }
  };

  const stopRecording = async () => {
    const hadSpeech = silenceRef.current.hasSpeech;
    clearVad();
    setRecording(false);
    // VAD detected no real speech above threshold — stop the recorder and
    // tell the user clearly so they know to try again.
    if (!hadSpeech) {
      await recorder.stop().catch(() => {});
      resetAudioToPlayback().catch(() => {});
      setErr("I didn't catch anything — tap the mic and speak clearly.");
      return;
    }
    setBusy(true);
    try {
      await recorder.stop();
      resetAudioToPlayback().catch(() => {});
      const uri = recorder.uri;
      if (!uri) throw new Error("no_audio");
      const base64 = await fileToBase64(uri);
      const { text } = await transcribe(base64, "audio/m4a", sttHint(language));
      setBusy(false);
      // Discard transcriptions that are only background-noise annotations
      // e.g. "(beep) (footsteps thudding)" → stripped → "" → noise
      if (text?.trim() && !isNoiseTranscript(text)) {
        await ask(text);
      } else {
        setErr("Couldn't make out what you said — try again in a quieter spot.");
      }
    } catch (e) {
      setBusy(false);
      if (e instanceof RateLimitError) {
        setRateLimitSecs(Math.min(e.retryAfter, 3600));
        setErr(`You're going too fast — wait ${e.retryAfter} second${e.retryAfter === 1 ? "" : "s"} then try again.`);
      } else if (e instanceof UnauthorizedError) {
        setErr("You need to sign in again before asking.");
      } else {
        const msg = String((e as Error)?.message ?? e);
        if (msg === "no_audio") {
          setErr("Nothing was recorded — make sure your microphone is working and try again.");
        } else {
          setErr("Couldn't process your voice — check your connection and try again.");
        }
      }
    }
  };
  // Ref so the VAD interval always calls the latest stopRecording closure
  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => { stopRecordingRef.current = stopRecording; });

  // ── Entry intent from the home menu (scan / voice) — run once on open ──
  const { intent, chatOnly } = useLocalSearchParams<{ intent?: string; chatOnly?: string }>();
  const forceTextOnly = chatOnly === "1" || chatOnly === "true";
  const intentHandled = useRef(false);
  useEffect(() => {
    if (intentHandled.current) return;
    const which = Array.isArray(intent) ? intent[0] : intent;
    if (which !== "scan" && which !== "voice") return; // wait for params to hydrate
    intentHandled.current = true;
    if (which === "scan") void scanSubscriptions();
    else void startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  const micState = recording ? "listening" : busy ? "speaking" : "idle";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: t.canvas, paddingTop: Math.max(insets.top, 44) + 6 }}
    >
      {/* header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 22,
          marginBottom: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.surface2,
              borderWidth: 1,
              borderColor: t.hair,
            }}
          >
            <Icon name="x" size={15} color={t.txtMid} />
          </Pressable>
          <Txt size={22} weight="semibold">
            Ask Judith
          </Txt>
          {messages.length > 0 && (
            <Pressable
              onPress={() => {
                messagesRef.current = [];
                setMessages([]);
                clearAskHistory();
              }}
              hitSlop={10}
              accessibilityLabel="Clear chat history"
              style={{ paddingLeft: 2, paddingTop: 3 }}
            >
              <Txt size={12} color={t.txtMid}>Clear</Txt>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {voiceTier && (
            <Pressable
              onPress={() => {
                const next = !speakAloud;
                setToggle("voiceReplies", next);
                showToast(next ? "Judith will speak answers aloud" : "Voice off · text replies only");
              }}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: speakAloud }}
              accessibilityLabel={speakAloud ? "Mute spoken replies" : "Speak replies aloud"}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: speakAloud ? 10 : 9,
                height: 32,
                borderRadius: 16,
                backgroundColor: speakAloud ? t.accent : t.surface2,
                borderWidth: 1,
                borderColor: speakAloud ? t.accent : t.hair,
              }}
            >
              <Icon name={speakAloud ? "volume" : "volumeOff"} size={15} color={speakAloud ? t.onAccent : t.txtMid} />
              {speakAloud && (
                <Txt size={12} weight="semibold" color={t.onAccent} style={{ letterSpacing: 0.1 }}>
                  {"Voice"}
                </Txt>
              )}
            </Pressable>
          )}
          <Pill
            onPress={() => router.push("/plans")}
            style={lowAsks ? { borderColor: t.semantic.near } : undefined}
          >
            <Icon name={isPaid ? "star" : "spark"} size={13} color={t.accent} />
            <Txt size={13} weight="bold" color={t.txtHi}>
              {isPaid ? "Unlimited" : `${asksLeft} asks`}
            </Txt>
          </Pill>
        </View>
      </View>

      {/* body */}
      {!started ? (
        <View style={{ flex: 1 }}>
          {locked ? (
            <View style={styles.intro}>
              <JudithAvatar persona={persona} size={88} state="idle" />
              <View style={{ alignItems: "center" }}>
                <Txt size={18} weight="bold">
                  You're out of free asks
                </Txt>
                <Muted
                  size={14}
                  style={{ marginTop: 6, maxWidth: 270, textAlign: "center" }}
                >
                  Reminders and bill tracking stay free forever. To keep asking
                  Judith, pick a plan.
                </Muted>
              </View>

              {/* Inline purchase CTAs — tap fires the Apple sheet directly
                  via buyTierFromAsk, no detour through /plans. */}
              <View style={{ alignSelf: "stretch", marginTop: 18, gap: 10 }}>
                <Pressable
                  onPress={() => { if (!buyingTier) void buyTierFromAsk("chat"); }}
                  style={{
                    borderWidth: 1.5,
                    borderColor: t.accent,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    backgroundColor: mix(t.accent, t.canvas, 0.08),
                    opacity: buyingTier === "chat" ? 0.7 : 1,
                  }}
                >
                  <Txt size={15} weight="semibold" color={t.accent}>
                    {buyingTier === "chat" ? "Opening Apple…" : "Get Chat Ask"}
                  </Txt>
                  <Low size={11} style={{ marginTop: 2 }}>Unlimited text asks</Low>
                </Pressable>

                <Pressable
                  onPress={() => { if (!buyingTier) void buyTierFromAsk("voice"); }}
                  style={{
                    backgroundColor: t.accent,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    opacity: buyingTier === "voice" ? 0.7 : 1,
                  }}
                >
                  <Txt size={15} weight="semibold" color={t.onAccent}>
                    {buyingTier === "voice" ? "Opening Apple…" : "Get Voice Ask"}
                  </Txt>
                  <Low size={11} color={t.onAccent} style={{ marginTop: 2, opacity: 0.85 }}>
                    Speak & listen — includes Chat Ask
                  </Low>
                </Pressable>

                <Low size={10.5} style={{ textAlign: "center", marginTop: 4 }}>
                  Cancel anytime · managed by the App Store
                </Low>
                <Low size={10.5} style={{ textAlign: "center" }}>
                  By subscribing, you agree to our{" "}
                  <Low size={10.5} color={t.accent} style={{ textDecorationLine: "underline" }} onPress={() => openLegal(TERMS_URL)}>Terms of Use</Low>
                  {" "}&{" "}
                  <Low size={10.5} color={t.accent} style={{ textDecorationLine: "underline" }} onPress={() => openLegal(PRIVACY_URL)}>Privacy Policy</Low>.
                </Low>
              </View>
            </View>
          ) : (
            <View style={styles.intro}>
              <JudithAvatar persona={persona} size={96} state={micState} />
              <View style={{ alignItems: "center" }}>
                <Txt size={17} weight="semibold">
                  {recording ? "Listening\u2026" : "Hi, I'm Judith"}
                </Txt>
                <Muted
                  size={13.5}
                  style={{ marginTop: 3, maxWidth: 270, textAlign: "center" }}
                >
                  {recording ? "Go ahead\u2026" : p.line}
                </Muted>
                {!recording && (
                  <Low size={11.5} style={{ marginTop: 8 }}>
                    {isPaid
                      ? voiceLocked
                        ? "Unlimited chat asks · upgrade for voice"
                        : "Ask as much as you like."
                      : `Each answer uses one ask · ${asksLeft} left`}
                  </Low>
                )}
              </View>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingVertical: 12,
            gap: 11,
          }}
          onContentSizeChange={() => {
            if (!hasInitialScrolled.current) {
              hasInitialScrolled.current = true;
              scrollRef.current?.scrollToEnd({ animated: false });
            }
          }}
        >
          {messages.map((m, i) =>
            m.role === "user" ? (
              <AnimMsg key={i}>
              <View
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "85%",
                  backgroundColor: t.accent,
                  borderRadius: 16,
                  borderBottomRightRadius: 5,
                  paddingVertical: 9,
                  paddingHorizontal: 13,
                }}
              >
                <Txt size={14.5} color={t.onAccent}>
                  {m.text}
                </Txt>
              </View>
              </AnimMsg>
            ) : (
              <AnimMsg key={i}>
              <View
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}
              >
                <JudithAvatar persona={persona} size={30} state="idle" />
                <View style={{ flex: 1, gap: 5 }}>
                  <SpeechBubble>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                      {m.text === "" && busy && i === messages.length - 1
                        ? <View style={{ flex: 1 }}><TypingDots /></View>
                        : <Txt size={14.5} style={{ flex: 1 }}>{m.text}</Txt>}
                      <Pressable
                        onPress={() => {
                          const next = messagesRef.current.map((msg, j) =>
                            j === i ? { ...msg, flagged: !msg.flagged } : msg,
                          );
                          messagesRef.current = next;
                          setMessages(next);
                          setAskHistory(next);
                        }}
                        hitSlop={10}
                        style={{ paddingTop: 1 }}
                      >
                        <Txt size={13} color={m.flagged ? t.semantic.urgent : t.txtMid} style={{ opacity: m.flagged ? 1 : 0.35 }}>
                          {"⚑"}
                        </Txt>
                      </Pressable>
                    </View>
                  </SpeechBubble>
                  {m.flagged && (
                    <View
                      style={{
                        backgroundColor: "#ff3b3014",
                        borderLeftWidth: 3,
                        borderLeftColor: t.semantic.urgent,
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 11,
                        gap: 2,
                      }}
                    >
                      <Txt size={12.5} color={t.semantic.urgent} style={{ fontWeight: "700" }}>
                        {"⚠ This answer may be incorrect"}
                      </Txt>
                      <Muted size={12}>
                        {"Check your Calendar tab for accurate monthly totals."}
                      </Muted>
                    </View>
                  )}
                </View>
              </View>
              </AnimMsg>
            ),
          )}
          {busy && !(messages[messages.length - 1]?.role === "judith" && messages[messages.length - 1]?.text === "") && (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <JudithAvatar persona={persona} size={30} state="speaking" />
              <SpeechBubble>
                <TypingDots />
              </SpeechBubble>
            </View>
          )}
          {lastFailedQ && !busy && (
            <Pressable
              onPress={() => { const q = lastFailedQ; setLastFailedQ(null); ask(q); }}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6,
                marginLeft: 38, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 18,
                borderWidth: 1, borderColor: t.accent,
                backgroundColor: pressed ? t.accent + "30" : t.accent + "18",
              })}
            >
              <Icon name="refresh" size={14} color={t.accent} />
              <Txt size={13.5} weight="semibold" color={t.accent}>
                {isFilipino(language ?? "fil") ? "Subukang muli" : "Retry"}
              </Txt>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* quick-ask chips — always visible above the input bar */}
      {!locked && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingVertical: 8, alignItems: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          {/* + add custom question */}
          <Pressable
            onPress={() => { setNewQText(""); setAddQVisible(true); }}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              borderWidth: 1.5, borderColor: t.accent, borderRadius: 22,
              paddingVertical: 8, paddingHorizontal: 14,
              backgroundColor: t.canvas,
            }}
          >
            <Icon name="plus" size={13} color={t.accent} />
            <Txt size={13} weight="medium" color={t.accent}>Add question</Txt>
          </Pressable>

          {/* user-created questions first */}
          {(customQuestions ?? []).map((qa, i) => (
            <Pressable
              key={`custom-${i}`}
              onPress={() => ask(qa)}
              onLongPress={() => setDeletingQIdx(i)}
              delayLongPress={500}
              style={{
                borderRadius: 22,
                paddingVertical: 8, paddingHorizontal: 14,
                backgroundColor: t.accent,
                opacity: busy ? 0.5 : 1,
                flexDirection: "row", alignItems: "center", gap: 6,
              }}
            >
              <Icon name="star" size={11} color={t.onAccent} />
              <Txt size={13} weight="medium" color={t.onAccent} style={{ maxWidth: 200 }} numberOfLines={1}>{qa}</Txt>
            </Pressable>
          ))}

          {/* built-in suggestions */}
          {getQuickAsks(country.code).map((qa, i) => (
            <Chip
              key={`builtin-${i}`}
              label={qa}
              onPress={() => ask(qa)}
              style={{ opacity: busy ? 0.5 : 1 }}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Add custom question sheet ── */}
      <Modal visible={addQVisible} transparent animationType="slide" onRequestClose={() => setAddQVisible(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setAddQVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <Pressable
            style={{ backgroundColor: t.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 20, paddingBottom: insets.bottom + 20 }}
          >
            <Txt size={18} weight="bold" style={{ marginBottom: 4 }}>Save a question</Txt>
            <Low size={13} style={{ marginBottom: 16 }}>It'll appear first in your chip strip — tap to send anytime.</Low>
            <TextInput
              value={newQText}
              onChangeText={setNewQText}
              placeholder="e.g. How much is my Meralco this month?"
              placeholderTextColor={t.txtLow}
              autoFocus
              multiline
              returnKeyType="done"
              blurOnSubmit
              style={{
                backgroundColor: t.surface1, borderWidth: 1, borderColor: t.hair,
                borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
                color: t.txtHi, fontSize: 15, fontFamily: t.fonts.regular,
                minHeight: 56, marginBottom: 14,
              }}
            />
            <Pressable
              onPress={() => {
                const q = newQText.trim();
                if (!q) return;
                addCustomQuestion(q);
                setAddQVisible(false);
                setNewQText("");
              }}
              style={{
                backgroundColor: newQText.trim() ? t.accent : t.surface2,
                borderRadius: 14, paddingVertical: 15, alignItems: "center",
              }}
            >
              <Txt size={15} weight="semibold" color={newQText.trim() ? t.onAccent : t.txtLow}>Save question</Txt>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ── Delete custom question confirm ── */}
      <Modal visible={deletingQIdx !== null} transparent animationType="fade" onRequestClose={() => setDeletingQIdx(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 28 }} onPress={() => setDeletingQIdx(null)}>
          <Pressable style={{ backgroundColor: t.surface2, borderRadius: 22, padding: 24 }}>
            <Txt size={17} weight="bold" style={{ marginBottom: 6 }}>Remove this question?</Txt>
            <Low size={14} style={{ marginBottom: 22, lineHeight: 20 }} numberOfLines={3}>
              {deletingQIdx !== null ? (customQuestions ?? [])[deletingQIdx] : ""}
            </Low>
            <Pressable
              onPress={() => {
                if (deletingQIdx !== null) deleteCustomQuestion(deletingQIdx);
                setDeletingQIdx(null);
              }}
              style={{ backgroundColor: t.semantic.urgent, borderRadius: 13, paddingVertical: 13, alignItems: "center", marginBottom: 10 }}
            >
              <Txt size={15} weight="semibold" color="#fff">Remove</Txt>
            </Pressable>
            <Pressable onPress={() => setDeletingQIdx(null)} style={{ paddingVertical: 10, alignItems: "center" }}>
              <Txt size={14} color={t.txtMid}>Keep it</Txt>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {!!err && (
        <Txt
          size={12.5}
          color={t.semantic.urgent}
          style={{ textAlign: "center", paddingHorizontal: 22, marginBottom: 6 }}
        >
          {err}
        </Txt>
      )}

      {/* input + mic */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 22,
          paddingBottom: insets.bottom + 14,
          paddingTop: 4,
        }}
      >
        <Pressable
          onPress={scanSubscriptions}
          disabled={locked || busy || scanBusy}
          hitSlop={6}
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hair,
            opacity: locked || busy || scanBusy ? 0.5 : 1,
          }}
        >
          <Icon name={scanBusy ? "spark" : "scan"} size={21} color={t.accent} />
        </Pressable>
        <TextInput
          value={busy ? "" : input}
          onChangeText={busy ? undefined : setInput}
          editable={!locked && !busy && rateLimitSecs <= 0}
          accessibilityLabel={busy ? "Ask Judith is thinking" : "Ask Judith question input ready"}
          placeholder={
            locked ? "Out of asks — upgrade to keep asking"
            : busy ? "Judith is thinking\u2026"
            : rateLimitSecs > 0 ? `Wait ${rateLimitSecs}s before asking again\u2026`
            : "Type a question\u2026"
          }
          placeholderTextColor={busy ? t.accent : t.txtLow}
          onSubmitEditing={() => ask(input)}
          returnKeyType="send"
          style={{
            flex: 1,
            backgroundColor: busy ? withAlpha(t.accent, 0.08) : t.surface1,
            borderWidth: 1,
            borderColor: busy ? withAlpha(t.accent, 0.4) : t.hair,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            color: t.txtHi,
            fontSize: 15,
            fontFamily: t.fonts.regular,
          }}
        />
        <Pressable
          onPress={recording ? stopRecording : startRecording}
          disabled={(busy && !recording) || rateLimitSecs > 0}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: recording ? t.semantic.urgent : t.accent,
            opacity: (busy && !recording) || rateLimitSecs > 0 ? 0.5 : 1,
          }}
        >
          <Icon
            name={locked || voiceLocked ? "spark" : "mic"}
            size={23}
            color={recording ? "#fff" : t.onAccent}
          />
        </Pressable>
      </View>

      <Modal
        visible={scanRows !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setScanRows(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: t.canvas,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingTop: 16,
              paddingBottom: insets.bottom + 16,
              maxHeight: "88%",
            }}
          >
            <View style={{ paddingHorizontal: 22, marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Txt size={20} weight="semibold">
                  Review subscriptions
                </Txt>
                <Pressable
                  onPress={() => setScanRows(null)}
                  hitSlop={10}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: t.surface2,
                    borderWidth: 1,
                    borderColor: t.hair,
                  }}
                >
                  <Icon name="x" size={14} color={t.txtMid} />
                </Pressable>
              </View>
              <Low size={13} style={{ marginTop: 4 }}>
                Got {scanRows?.length ?? 0} subscription{(scanRows?.length ?? 0) !== 1 ? "s" : ""} — verify the amount, due day, and billing frequency before adding.
              </Low>
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: 22, paddingVertical: 12, gap: 10 }}
            >
              {scanRows?.map((r, i) => (
                <View
                  key={i}
                  style={{
                    borderWidth: 1,
                    borderColor: r.include ? mix(t.accent, t.surface2, 0.45) : t.hair,
                    backgroundColor: r.include ? mix(t.accent, t.surface2, 0.08) : t.surface2,
                    borderRadius: 14,
                    padding: 13,
                    gap: 11,
                    opacity: r.include ? 1 : 0.6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <Pressable
                      onPress={() => patchScanRow(i, { include: !r.include })}
                      hitSlop={8}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: r.include ? t.accent : "transparent",
                        borderWidth: 1.5,
                        borderColor: r.include ? t.accent : t.hair,
                      }}
                    >
                      {r.include && <Icon name="check" size={14} color={t.onAccent} />}
                    </Pressable>
                    <TextInput
                      value={r.provider}
                      onChangeText={(v) => patchScanRow(i, { provider: v })}
                      placeholder="Subscription"
                      placeholderTextColor={t.txtLow}
                      style={{
                        flex: 1,
                        color: t.txtHi,
                        fontSize: 15.5,
                        fontFamily: t.fonts.semibold,
                        paddingVertical: 2,
                      }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        flex: 1,
                        backgroundColor: t.surface1,
                        borderWidth: 1,
                        borderColor: t.hair,
                        borderRadius: 10,
                        paddingHorizontal: 11,
                      }}
                    >
                      <Txt size={15} color={t.txtMid} mono>
                        {"\u20B1"}
                      </Txt>
                      <TextInput
                        value={r.amount}
                        onChangeText={(v) => patchScanRow(i, { amount: v.replace(/[^0-9.]/g, "") })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={t.txtLow}
                        style={{
                          flex: 1,
                          color: t.txtHi,
                          fontSize: 15,
                          fontFamily: t.fonts.mono,
                          paddingVertical: 9,
                        }}
                      />
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: t.surface1,
                        borderWidth: 1,
                        borderColor: t.hair,
                        borderRadius: 10,
                        padding: 3,
                      }}
                    >
                      {(["monthly", "annual"] as const).map((f) => (
                        <Pressable
                          key={f}
                          onPress={() => patchScanRow(i, { frequency: f, nextDue: null })}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 11,
                            borderRadius: 8,
                            backgroundColor: r.frequency === f ? t.accent : "transparent",
                          }}
                        >
                          <Txt
                            size={12.5}
                            weight="medium"
                            color={r.frequency === f ? t.onAccent : t.txtMid}
                          >
                            {f === "monthly" ? "Monthly" : "Yearly"}
                          </Txt>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        flex: 1,
                        backgroundColor: t.surface1,
                        borderWidth: 1,
                        borderColor: t.hair,
                        borderRadius: 10,
                        paddingHorizontal: 11,
                        paddingVertical: 6,
                      }}
                    >
                      <Txt size={12.5} color={t.txtLow}>Day</Txt>
                      <TextInput
                        value={r.dueDay != null ? String(r.dueDay) : ""}
                        onChangeText={(v) => {
                          const n = parseInt(v.replace(/\D/g, ""), 10);
                          patchScanRow(i, { dueDay: Number.isFinite(n) && n >= 1 && n <= 31 ? n : null, nextDue: null });
                        }}
                        keyboardType="numeric"
                        placeholder="–"
                        placeholderTextColor={t.txtLow}
                        maxLength={2}
                        style={{ color: t.txtHi, fontSize: 14, fontFamily: t.fonts.mono, width: 28, paddingVertical: 0 }}
                      />
                    </View>
                    <Txt size={12.5} color={t.txtMid} style={{ flex: 2 }}>
                      {scanDueLabel(r.nextDue, r.dueDay, r.frequency) || "date not found"}
                    </Txt>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 22, paddingTop: 6 }}>
              <Pressable
                onPress={() => setScanRows(null)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 14,
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: t.hair,
                  backgroundColor: t.surface2,
                }}
              >
                <Txt size={14.5} weight="medium">
                  Cancel
                </Txt>
              </Pressable>
              <Pressable
                onPress={confirmScannedBills}
                disabled={includedCount === 0}
                style={{
                  flex: 2,
                  alignItems: "center",
                  paddingVertical: 14,
                  borderRadius: 13,
                  backgroundColor: t.accent,
                  opacity: includedCount === 0 ? 0.5 : 1,
                }}
              >
                <Txt size={14.5} weight="semibold" color={t.onAccent}>
                  {includedCount === 0
                    ? "Select bills to add"
                    : `Add ${includedCount} bill${includedCount !== 1 ? "s" : ""}`}
                </Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI consent modal is now mounted globally by AiConsentProvider in
          app/_layout.tsx — Ask Judith, receipt scan, and onboarding all
          share the same consent surface. */}

      {/* Voice upgrade nudge — shown when a Chat Ask subscriber taps the mic.
          Triggers StoreKit DIRECTLY (no redirect to /plans), so the user
          gets the Apple sheet from this same modal. App Store guideline
          3.1.2 wants the purchase mechanism close to the value prop, not
          buried in a settings hop. */}
      <Modal
        visible={voiceUpgradeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!buyingTier) setVoiceUpgradeVisible(false); }}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: t.canvas,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingTop: 20,
              paddingBottom: insets.bottom + 20,
              paddingHorizontal: 22,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 18 }}>
              <JudithAvatar persona={persona} size={72} state="speaking" mood="proud" />
            </View>
            <Txt size={22} weight="bold" style={{ textAlign: "center", marginBottom: 8 }}>
              Voice asks need Voice Ask
            </Txt>
            <Muted size={14.5} style={{ textAlign: "center", maxWidth: 300, alignSelf: "center", marginBottom: 14 }}>
              Your Chat Ask plan covers unlimited text questions. Upgrade to Voice Ask to speak and listen hands-free.
            </Muted>
            <Pressable
              onPress={() => { if (!buyingTier) void buyTierFromAsk("voice"); }}
              style={{
                backgroundColor: t.accent,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: "center",
                marginBottom: 10,
                opacity: buyingTier === "voice" ? 0.7 : 1,
              }}
            >
              <Txt size={16} weight="semibold" color={t.onAccent}>
                {buyingTier === "voice" ? "Opening Apple…" : "Upgrade to Voice Ask"}
              </Txt>
            </Pressable>
            <Low size={10.5} style={{ textAlign: "center", marginBottom: 4 }}>
              Cancel anytime · managed by the App Store
            </Low>
            <Low size={10.5} style={{ textAlign: "center", marginBottom: 10 }}>
              By subscribing, you agree to our{" "}
              <Low size={10.5} color={t.accent} style={{ textDecorationLine: "underline" }} onPress={() => openLegal(TERMS_URL)}>Terms of Use</Low>
              {" "}&{" "}
              <Low size={10.5} color={t.accent} style={{ textDecorationLine: "underline" }} onPress={() => openLegal(PRIVACY_URL)}>Privacy Policy</Low>.
            </Low>
            <Pressable
              onPress={() => { if (!buyingTier) setVoiceUpgradeVisible(false); }}
              style={{ paddingVertical: 10, alignItems: "center" }}
            >
              <Txt size={15} color={t.txtMid}>Keep typing — it's fine</Txt>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Purchase congrats — fires from any in-screen paywall (voice modal
          OR out-of-asks empty state) the moment the StoreKit transaction
          completes. Sits as the last sibling so it overlays everything. */}
      <Modal
        visible={purchasedTier != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPurchasedTier(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 26 }}>
          <View style={{ width: "100%", maxWidth: 360, borderRadius: 22, backgroundColor: t.surface2, padding: 24, alignItems: "center" }}>
            <JudithAvatar persona={persona} size={84} state="speaking" mood="joy" />
            <Txt size={22} weight="bold" style={{ marginTop: 14, textAlign: "center" }}>
              You're all set!
            </Txt>
            <Muted size={14.5} style={{ marginTop: 8, textAlign: "center", maxWidth: 280 }}>
              {purchasedTier === "voice"
                ? "Voice Ask is active. You can now speak your questions and hear Judith out loud."
                : "Chat Ask is active. Ask Judith anything about your bills — unlimited."}
            </Muted>
            <Pressable
              onPress={() => setPurchasedTier(null)}
              style={{ marginTop: 22, alignSelf: "stretch", backgroundColor: t.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
            >
              <Txt size={16} weight="semibold" color={t.onAccent}>
                {purchasedTier === "voice" ? "Start speaking" : "Start asking"}
              </Txt>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = {
  intro: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
  },
};
