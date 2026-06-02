import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Chip, Low, Muted, Pill, SpeechBubble, Txt } from "@/components/ui";
import { QUICK_ASKS } from "@/constants/data";
import { getPersona } from "@/constants/personas";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { fileToBase64, playBase64Mp3 } from "@/lib/audio";
import { type AskBill, askJudith, transcribe } from "@/lib/proxy";
import { sttHint } from "@/constants/languages";

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
  const { bills, asksLeft, tier, persona, language, consumeAsk } = useJudith();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const unlimited = tier === "unlimited";
  const locked = !unlimited && asksLeft <= 0;
  const lowAsks = !unlimited && asksLeft > 0 && asksLeft <= 3;

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
    setErr("");
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    if (!unlimited) consumeAsk();
    setBusy(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      const { reply, audioBase64 } = await askJudith(q, askBills(), persona);
      const finalReply = reply?.trim() || localFallback(q);
      setMessages((m) => [...m, { role: "judith", text: finalReply }]);
      if (audioBase64) {
        playBase64Mp3(audioBase64).catch(() => {});
      }
    } catch {
      setMessages((m) => [...m, { role: "judith", text: localFallback(q) }]);
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
      const VAD_THRESHOLD_DB = -50;  // dBFS; below this = silence
      const VAD_MIN_MS = 800;        // ignore first 800 ms while mic settles
      const VAD_SILENCE_MS = 3000;   // 3 s of silence after speech → auto-stop
      vadIntervalRef.current = setInterval(() => {
        if (Date.now() - vadStart < VAD_MIN_MS) return;
        const db = recorder.getStatus().metering;
        if (db == null) return; // device doesn't support metering
        if (db > VAD_THRESHOLD_DB) {
          silenceRef.current.hasSpeech = true;
          if (silenceRef.current.timer !== null) { clearTimeout(silenceRef.current.timer); silenceRef.current.timer = null; }
        } else if (silenceRef.current.hasSpeech && silenceRef.current.timer === null) {
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
    clearVad(); // cancel any pending silence timer
    setRecording(false);
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio captured");
      const base64 = await fileToBase64(uri);
      const { text } = await transcribe(base64, "audio/m4a", sttHint(language));
      setBusy(false);
      if (text?.trim()) await ask(text);
    } catch (e) {
      setBusy(false);
      setErr(`Couldn't transcribe that: ${String((e as Error)?.message ?? e)}`);
    }
  };
  // Ref so the VAD interval always calls the latest stopRecording closure
  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => { stopRecordingRef.current = stopRecording; });

  const micState = recording ? "listening" : busy ? "speaking" : "idle";

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top + 6 }}>
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
          <Icon name={unlimited ? "star" : "spark"} size={13} color={t.accent} />
          <Txt size={13} weight="bold" color={t.txtHi}>
            {unlimited ? "Unlimited" : `${asksLeft} asks`}
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
                  {unlimited
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
          {QUICK_ASKS.map((qa, i) => (
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
        <TextInput
          value={input}
          onChangeText={setInput}
          editable={!locked && !busy}
          placeholder={locked ? "Out of asks — upgrade to keep asking" : "Type a question\u2026"}
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
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: recording ? t.semantic.urgent : t.accent,
          }}
        >
          <Icon
            name={locked ? "spark" : "mic"}
            size={23}
            color={recording ? "#fff" : t.onAccent}
          />
        </Pressable>
      </View>
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
