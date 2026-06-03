import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Chip, Low, Muted, Pill, SpeechBubble, Txt, mix } from "@/components/ui";
import { makeBillFromAction, makeSubscriptionBill } from "@/constants/data";
import { getQuickAsks } from "@/constants/providers";
import { getPersona } from "@/constants/personas";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { fileToBase64, playBase64Mp3 } from "@/lib/audio";
import { type AddBillAction, type AskBill, askJudith, parseSubscriptionScreenshot, transcribe, RateLimitError } from "@/lib/proxy";
import { sttHint } from "@/constants/languages";

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

interface Msg {
  role: "user" | "judith";
  text: string;
}

export default function AskModal() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bills, asksLeft, tier, persona, language, country, consumeAsk, saveBill, showToast } = useJudith();
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

  const paid = tier === "chat" || tier === "voice";
  const locked = !paid && asksLeft <= 0;
  const lowAsks = !paid && asksLeft > 0 && asksLeft <= 3;

  const [messages, setMessages] = useState<Msg[]>([]);
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

  const scanSubscriptions = async () => {
    if (busy || scanBusy) return;
    setErr("");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErr("Photo permission is needed to scan a screenshot. You can type instead.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as ImagePicker.MediaType[],
        base64: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0]!;
      setScanBusy(true);
      const { subscriptions } = await parseSubscriptionScreenshot(
        asset.base64!,
        asset.mimeType || "image/jpeg",
      );
      if (subscriptions.length === 0) {
        setErr("No active subscriptions found in that screenshot. Try a clearer image.");
        setScanBusy(false);
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
      setScanBusy(false);
    } catch (e) {
      setScanBusy(false);
      setErr(`Couldn't read that screenshot: ${String((e as Error)?.message ?? e)}`);
    }
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

  const askBills = (): AskBill[] =>
    bills.map((b) => ({
      provider: b.provider,
      cat: b.cat,
      amount: b.amount,
      dueDays: b.dueDays,
      dueLabel: b.dueLabel,
      status: b.status,
    }));

  const localFallback = (q: string): string => {
    if (!BILL_WORDS.test(q)) {
      return "That's outside my lane — I only handle your bills and due dates. Ask me anything about those and I'm all yours.";
    }
    const next = bills
      .filter((b) => b.status !== "paid")
      .sort((a, b) => a.dueDays - b.dueDays)[0];
    return next
      ? `Your next bill is ${next.provider} — ${"\u20B1"}${Math.round(next.amount).toLocaleString("en-US")}, due ${next.dueLabel}.`
      : "You're all caught up — nothing due right now.";
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
    setMessages((m) => [...m, { role: "user", text: q }]);
    if (!paid) consumeAsk();
    setBusy(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      const { reply, audioBase64, action } = await askJudith(q, askBills(), persona, language);
      const finalReply = reply?.trim() || localFallback(q);
      setMessages((m) => [...m, { role: "judith", text: finalReply }]);
      if (audioBase64) {
        playBase64Mp3(audioBase64).catch(() => {});
      }
      if (action?.type === "add_bill") {
        const bill = makeBillFromAction(action as AddBillAction);
        saveBill(bill);
        showToast(`Added: ${bill.provider}`);
      }
    } catch (e) {
      if (e instanceof RateLimitError) {
        setRateLimitSecs(Math.min(e.retryAfter, 3600));
        setMessages((m) => [...m, { role: "judith", text: `You're sending too fast — please wait ${e.retryAfter} second${e.retryAfter === 1 ? "" : "s"} before asking again.` }]);
      } else {
        setMessages((m) => [...m, { role: "judith", text: localFallback(q) }]);
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
    if (tier === "chat") {
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
      const VAD_SILENCE_MS = 1500;   // 1.5 s of silence → auto-stop
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
        // First tick past settling — lock adaptive threshold (ambient + 5 dBFS)
        if (!settlingComplete) {
          settlingComplete = true;
          if (ambientReadings.length > 0) {
            adaptiveThreshold = Math.max(...ambientReadings) + 5;
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
          // Active speech — cancel any pending silence timer
          silenceRef.current.hasSpeech = true;
          if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
        } else if (silenceRef.current.timer === null) {
          // Silence (pre- or post-speech) — start countdown unconditionally so
          // VAD always fires even when the user's voice doesn't cross the threshold.
          silenceRef.current.timer = setTimeout(() => {
            clearVad();
            void stopRecordingRef.current();
          }, VAD_SILENCE_MS);
        }
      }, 100);
    } catch (e) {
      setErr(`Couldn't start recording: ${String((e as Error)?.message ?? e)}`);
    }
  };

  const stopRecording = async () => {
    const hadSpeech = silenceRef.current.hasSpeech;
    clearVad();
    setRecording(false);
    // VAD detected no real speech above threshold — stop recorder silently,
    // do not transcribe or show an error.
    if (!hadSpeech) {
      await recorder.stop().catch(() => {});
      return;
    }
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio captured");
      const base64 = await fileToBase64(uri);
      const { text } = await transcribe(base64, "audio/m4a", sttHint(language));
      setBusy(false);
      // Discard transcriptions that are only background-noise annotations
      // e.g. "(beep) (footsteps thudding)" → stripped → "" → noise
      if (text?.trim() && !isNoiseTranscript(text)) await ask(text);
    } catch (e) {
      setBusy(false);
      if (e instanceof RateLimitError) {
        setRateLimitSecs(Math.min(e.retryAfter, 3600));
        setErr(`Sending too fast — wait ${e.retryAfter}s before trying again.`);
      } else {
        const msg = String((e as Error)?.message ?? e);
        setErr(msg.includes("401") ? "Session expired — close and reopen the app to sign back in." : `Couldn't transcribe that: ${msg}`);
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
        </View>
        <Pill
          onPress={() => router.push("/plans")}
          style={lowAsks ? { borderColor: t.semantic.near } : undefined}
        >
          <Icon name={paid ? "star" : "spark"} size={13} color={t.accent} />
          <Txt size={13} weight="bold" color={t.txtHi}>
            {paid ? "Unlimited" : `${asksLeft} asks`}
          </Txt>
        </Pill>
      </View>

      {/* body */}
      {!started ? (
        locked ? (
          <View style={styles.center}>
            <JudithAvatar persona={persona} size={108} state="idle" />
            <View style={{ alignItems: "center" }}>
              <Txt size={19} weight="bold">
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
          <View style={styles.center}>
            <JudithAvatar persona={persona} size={132} state={micState} />
            <View style={{ alignItems: "center" }}>
              <Txt size={18} weight="semibold">
                {recording ? "Listening\u2026" : "Hi, I'm Judith"}
              </Txt>
              <Muted
                size={14}
                style={{ marginTop: 4, maxWidth: 270, textAlign: "center" }}
              >
                {recording ? "Go ahead\u2026" : p.line}
              </Muted>
              {!recording && (
                <Low size={12} style={{ marginTop: 10 }}>
                  {paid
                    ? "Ask as much as you like."
                    : `Each answer uses one ask · ${asksLeft} left`}
                </Low>
              )}
            </View>
          </View>
        )
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
                <SpeechBubble style={{ flex: 1 }}>
                  <Txt size={14.5}>{m.text}</Txt>
                </SpeechBubble>
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

      {!!err && (
        <Txt
          size={12.5}
          color={t.semantic.urgent}
          style={{ textAlign: "center", paddingHorizontal: 22, marginBottom: 6 }}
        >
          {err}
        </Txt>
      )}

      {/* quick asks */}
      {!locked && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingVertical: 10 }}
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
          value={input}
          onChangeText={setInput}
          editable={!locked && !busy && rateLimitSecs <= 0}
          placeholder={locked ? "Out of asks — upgrade to keep asking" : rateLimitSecs > 0 ? `Wait ${rateLimitSecs}s before asking again…` : "Type a question\u2026"}
          placeholderTextColor={t.txtLow}
          onSubmitEditing={() => ask(input)}
          returnKeyType="send"
          style={{
            flex: 1,
            backgroundColor: t.surface1,
            borderWidth: 1,
            borderColor: t.hair,
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
          disabled={rateLimitSecs > 0}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: recording ? t.semantic.urgent : t.accent,
            opacity: rateLimitSecs > 0 ? 0.4 : 1,
          }}
        >
          <Icon
            name={locked ? "spark" : "mic"}
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
              onPress={() => { setVoiceUpgradeVisible(false); router.push("/plans"); }}
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
  center: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 18,
    paddingHorizontal: 22,
  },
};
