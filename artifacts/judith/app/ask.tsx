import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Chip, Low, Muted, Pill, SpeechBubble, Txt, mix } from "@/components/ui";
import { makeBillFromAction, makeSubscriptionBill, currentCycleDue, nextOccurrence, totalOwed, ccProjectedFuture } from "@/constants/data";
import type { AskMsg } from "@/contexts/JudithStore";
import { getQuickAsks } from "@/constants/providers";
import { getPersona } from "@/constants/personas";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { fileToBase64, playBase64Mp3 } from "@/lib/audio";
import { type AddBillAction, type AskBill, askJudith, parseSubscriptionScreenshot, transcribe, RateLimitError } from "@/lib/proxy";
import { sttHint, isFilipino } from "@/constants/languages";

/**
 * Returns true when the STT transcription is purely background-noise annotations
 * and contains no real speech. Strips parenthetical/bracketed sound descriptions
 * like "(beep)", "(footsteps thudding)", "[laughter]", etc., then checks whether
 * any letter/digit characters remain. Discarding these prevents sending noise to Judith.
 */
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

export default function AskModal() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bills, asksLeft, tier, persona, language, country, currency, monthlyIncome, incomeByMonth, consumeAsk, canUseVoice, saveBill, showToast, toggles, setToggle, askHistory, setAskHistory, clearAskHistory, hydrated } = useJudith();
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

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; hasSpeech: boolean }>({ timer: null, hasSpeech: false });
  const clearVad = () => {
    if (vadIntervalRef.current !== null) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
  };
  useEffect(() => clearVad, []);

  const [scanBusy, setScanBusy] = useState(false);
  const [scanRows, setScanRows] = useState<ScanRow[] | null>(null);
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

  const askBills = (): AskBill[] => {
    const today = new Date();
    const periodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // ── Current-cycle entries (overdue-aware, mirrors home screen) ────────
    const current = bills.map((b) => {
      // Recompute the due date LIVE from the bill's day-of-month, using the same
      // overdue-aware logic as the home screen (currentCycleDue). This keeps an
      // overdue bill in the CURRENT month with a NEGATIVE offset instead of
      // rolling it forward to next month — otherwise Judith drops overdue bills
      // from "what's due this month" and under-reports the total (home and Ask
      // would disagree). The signed offset also files the bill in the right month.
      const { dueDays, dueLabel } = currentCycleDue(b, today);
      const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dueDays);
      const dueMonth = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
      const cardName = b.chargedToCard && b.parentCardId
        ? (bills.find((c) => c.id === b.parentCardId)?.provider ?? null)
        : null;
      // Send the REMAINING balance for the current cycle (full statement minus
      // anything already paid this period), and mark a bill fully paid THIS
      // period as "paid". b.status alone is unreliable: after a payment it
      // advances to the next cycle, so an already-paid bill would look unpaid and
      // be re-counted at its full amount — that's what inflated Judith's totals
      // above the home/calendar figures. Mirrors the home screen's `remaining()`.
      const rec = (b.paymentHistory ?? []).find((r) => r.period === periodKey);
      const paidThisPeriod = rec ? rec.paid : (b.amountPaid ?? 0);
      const isPaidThisPeriod = (b.paymentHistory ?? []).some(
        (r) => r.period === periodKey && r.paid >= r.totalDue,
      );
      const remaining = Math.max(0, totalOwed(b) - paidThisPeriod);
      return {
        provider: b.provider,
        cat: b.cat,
        amount: remaining,
        dueDays,
        dueLabel,
        status: isPaidThisPeriod ? "paid" : b.status,
        dueMonth,
        isBusiness: b.isBusiness,
        businessName: b.businessName,
        chargedToCard: b.chargedToCard,
        cardName,
      };
    });

    // ── Next-month projections (estimated recurring cycle) ────────────────
    // Project every monthly (non-annual) bill one calendar month forward so the
    // AI's MONTHLY TOTALS section includes a July estimate. This mirrors the
    // Calendar screen's viewedAmt logic for future months.
    const nxYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const nxMonth = (today.getMonth() + 1) % 12; // 0-indexed
    const nxKey = `${nxYear}-${String(nxMonth + 1).padStart(2, "0")}`;
    const nxDaysInMonth = new Date(nxYear, nxMonth + 1, 0).getDate();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const projections: AskBill[] = bills
      .filter((b) => {
        if (b.frequency === "annual") return false; // annual bills don't recur monthly
        if (b.cat === "Credit card") return false;  // handled separately below
        // Skip if currentCycleDue already lands in next month (avoid duplicate)
        const { dueDays } = currentCycleDue(b, today);
        const dd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dueDays);
        return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}` !== nxKey;
      })
      .map((b) => {
        const dayInMonth = Math.min(b.dueDate, nxDaysInMonth);
        const nxDue = new Date(nxYear, nxMonth, dayInMonth);
        const dueDays = Math.round((nxDue.getTime() - today.getTime()) / 86_400_000);
        const dueLabel = nxYear === today.getFullYear()
          ? `${monthNames[nxMonth]} ${dayInMonth}`
          : `${monthNames[nxMonth]} ${dayInMonth}, ${nxYear}`;

        // Mirror calendar's viewedAmt for future months exactly:
        // paid current cycle → fresh base amount (no carry-over)
        // unpaid/partial    → base amount + effective carry
        // Using b.amount (not totalOwed) as the base so stale carryOver
        // from prior cycles doesn't inflate the next-month projection.
        const isPaidCurrent = (b.paymentHistory ?? []).some(
          (r) => r.period === periodKey && r.paid >= r.totalDue,
        );
        const hasPartial = (b.amountPaid ?? 0) > 0;
        const effectiveCarry = hasPartial
          ? Math.max(0, totalOwed(b) - (b.amountPaid ?? 0))
          : (b.carryOver ?? 0);
        const amount = isPaidCurrent ? b.amount : b.amount + effectiveCarry;

        const cardName = b.chargedToCard && b.parentCardId
          ? (bills.find((c) => c.id === b.parentCardId)?.provider ?? null)
          : null;

        return {
          provider: b.provider,
          cat: b.cat,
          amount,
          dueDays,
          dueLabel,
          status: "upcoming",
          dueMonth: nxKey,
          isBusiness: b.isBusiness,
          businessName: b.businessName,
          chargedToCard: b.chargedToCard,
          cardName,
          isProjection: true,
        };
      });

    // Credit-card next-month projections — use ccProjectedFuture (outstanding
    // remainder + recurring charges re-billed onto the card), matching what
    // the Calendar shows for future months. This avoids the regular formula
    // which would just re-use the current statement amount verbatim.
    const ccProjections: AskBill[] = bills
      .filter((b) => b.cat === "Credit card")
      .map((b) => {
        const dayInMonth = Math.min(b.dueDate, nxDaysInMonth);
        const nxDue = new Date(nxYear, nxMonth, dayInMonth);
        const dueDays = Math.round((nxDue.getTime() - today.getTime()) / 86_400_000);
        const dueLabel = nxYear === today.getFullYear()
          ? `${monthNames[nxMonth]} ${dayInMonth}`
          : `${monthNames[nxMonth]} ${dayInMonth}, ${nxYear}`;
        return {
          provider: b.provider,
          cat: b.cat,
          amount: ccProjectedFuture(b, bills, nxYear, nxMonth, today),
          dueDays,
          dueLabel,
          status: "upcoming" as const,
          dueMonth: nxKey,
          isBusiness: b.isBusiness,
          chargedToCard: false,
          cardName: null,
          isProjection: true,
        };
      });

    return [...current, ...projections, ...ccProjections];
  };

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
    // 1-second minimum cooldown between successive asks (client-side guard)
    const now = Date.now();
    if (now - lastAskRef.current < 1000) return;
    lastAskRef.current = now;
    setErr("");
    setInput("");
    appendAndPersist({ role: "user", text: q });
    if (!isPaid) consumeAsk();
    setBusy(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      // Speak aloud only when the user hasn't muted replies (voice tier) — saves TTS cost and stays silent in public.
      // The mute only applies to the voice tier; other tiers (e.g. free with asks left) are unaffected.
      const wantVoice = canUseVoice() && (!voiceTier || speakAloud);
      const { reply, audioBase64, action } = await askJudith(q, askBills(), persona, language, wantVoice, currency, country.name, monthlyIncome, country.code, Object.keys(incomeByMonth).length > 0 ? incomeByMonth : undefined);
      const finalReply = reply?.trim() || await fallbackWithDelay(q);
      appendAndPersist({ role: "judith", text: finalReply });
      if (audioBase64) {
        playBase64Mp3(audioBase64).catch(() => {});
      }
      if (action?.type === "add_bill") {
        const bill = makeBillFromAction(action as AddBillAction);
        saveBill(bill);
        showToast(`Added: ${bill.provider}`);
      }
    } catch (e) {
      const isFil = isFilipino(language ?? "fil");
      if (e instanceof RateLimitError) {
        setRateLimitSecs(Math.min(e.retryAfter, 3600));
        appendAndPersist({ role: "judith", text: isFil
          ? `Sandali lang — maghintay ka ng ${e.retryAfter} segundo bago magtanong ulit.`
          : `You're sending too fast — please wait ${e.retryAfter} second${e.retryAfter === 1 ? "" : "s"} before asking again.`
        });
      } else {
        await new Promise<void>((r) => setTimeout(r, 900));
        appendAndPersist({ role: "judith", text: isFil
          ? "Hindi ako makakonekta sa server — check your connection and try again."
          : "I can't connect to the server — check your connection and try again."
        });
      }
    } finally {
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
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErr("Microphone permission is needed. You can type instead.");
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
        setErr("Microphone permission denied — allow it in your phone settings and try again.");
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
      setErr("I didn't catch anything — tap the mic and speak clearly.");
      return;
    }
    setBusy(true);
    try {
      await recorder.stop();
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
      } else {
        const msg = String((e as Error)?.message ?? e);
        if (msg.includes("401") || msg.includes("session")) {
          setErr("Session expired — close and reopen the app to sign back in.");
        } else if (msg === "no_audio") {
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
  const { intent } = useLocalSearchParams<{ intent?: string }>();
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
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: Math.max(insets.top, 44) + 6 }}>
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
            onPress={() => router.back()}
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
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: speakAloud ? mix(t.accent, t.canvas, 0.85) : t.surface2,
                borderWidth: 1,
                borderColor: speakAloud ? t.accent : t.hair,
              }}
            >
              <Icon name={speakAloud ? "volume" : "volumeOff"} size={16} color={speakAloud ? t.accent : t.txtMid} />
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
                  Judith out loud, pick a plan.
                </Muted>
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
        >
          {messages.map((m, i) =>
            m.role === "user" ? (
              <View
                key={i}
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
            ) : (
              <View
                key={i}
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}
              >
                <JudithAvatar persona={persona} size={30} state="idle" />
                <View style={{ flex: 1, gap: 5 }}>
                  <SpeechBubble>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                      <Txt size={14.5} style={{ flex: 1 }}>{m.text}</Txt>
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
            ),
          )}
          {busy && (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <JudithAvatar persona={persona} size={30} state="speaking" />
              <SpeechBubble>
                <Low size={14}>{"Judith is thinking\u2026"}</Low>
              </SpeechBubble>
            </View>
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
          {getQuickAsks(country.code).map((qa, i) => (
            <Chip
              key={i}
              label={qa}
              onPress={() => ask(qa)}
              style={{ opacity: busy ? 0.5 : 1 }}
            />
          ))}
        </ScrollView>
      )}

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

      {/* Voice upgrade nudge — shown when a Chat Ask subscriber taps the mic */}
      <Modal
        visible={voiceUpgradeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVoiceUpgradeVisible(false)}
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
            <Muted size={14.5} style={{ textAlign: "center", maxWidth: 300, alignSelf: "center", marginBottom: 24 }}>
              Your Chat Ask plan covers unlimited text questions. Upgrade to Voice Ask (₱199/mo) to speak and listen hands-free.
            </Muted>
            <Pressable
              onPress={() => { setVoiceUpgradeVisible(false); router.push("/plans?focus=voice"); }}
              style={{
                backgroundColor: t.accent,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Txt size={16} weight="semibold" color={t.onAccent}>Upgrade to Voice Ask</Txt>
            </Pressable>
            <Pressable
              onPress={() => setVoiceUpgradeVisible(false)}
              style={{ paddingVertical: 12, alignItems: "center" }}
            >
              <Txt size={15} color={t.txtMid}>Keep typing — it's fine</Txt>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
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
