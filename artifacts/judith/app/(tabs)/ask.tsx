import { Feather } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { JudithOrb, type OrbState } from "@/components/JudithOrb";
import { Paywall } from "@/components/Paywall";
import { getPersona } from "@/constants/personas";
import { PAYWALL_ENABLED } from "@/constants/config";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { fileToBase64, playBase64Mp3 } from "@/lib/audio";
import { askJudith, transcribe } from "@/lib/proxy";

const SUGGESTIONS = [
  "Magkano lahat ng bill ko ngayong buwan?",
  "Ano ang susunod kong babayaran?",
  "May overdue ba ako?",
];

export default function AskScreen() {
  const colors = useColors();
  const { profile, hasAccess } = useSettings();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [orb, setOrb] = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const persona = getPersona(profile.persona);
  const busy = orb === "thinking" || orb === "speaking";

  const runAsk = async (question: string) => {
    setError(null);
    setReply("");
    setTranscript(question);
    setOrb("thinking");
    try {
      const res = await askJudith(question);
      setReply(res.reply);
      if (res.audioBase64) {
        setOrb("speaking");
        await playBase64Mp3(res.audioBase64);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hindi makasagot si Judith ngayon.");
    } finally {
      setOrb("idle");
    }
  };

  const startRecording = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError("Kailangan ng access sa mikropono.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOrb("listening");
  };

  const stopRecording = async () => {
    await recorder.stop();
    const uri = recorder.uri;
    setOrb("thinking");
    try {
      if (!uri) throw new Error("Walang na-record.");
      const base64 = await fileToBase64(uri);
      const { text } = await transcribe(base64, "audio/m4a");
      if (!text.trim()) {
        setError("Hindi ko narinig. Subukan ulit.");
        setOrb("idle");
        return;
      }
      await runAsk(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "May mali sa pagproseso ng boses.");
      setOrb("idle");
    }
  };

  const toggleMic = () => {
    if (orb === "listening") void stopRecording();
    else if (!busy) void startRecording();
  };

  const sendTyped = () => {
    const q = typed.trim();
    if (!q || busy) return;
    setTyped("");
    void runAsk(q);
  };

  if (PAYWALL_ENABLED && !hasAccess) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Paywall />
      </SafeAreaView>
    );
  }

  const micColor =
    orb === "listening" ? colors.destructive : colors.primary;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Tanungin si Judith</Text>
          <Text style={[styles.persona, { color: persona.color }]}>{persona.name}</Text>
        </View>

        <View style={styles.orbArea}>
          <JudithOrb size={200} state={orb} />
          <Text style={[styles.status, { color: colors.mutedForeground }]}>
            {orb === "listening"
              ? "Nakikinig…"
              : orb === "thinking"
                ? "Iniisip…"
                : orb === "speaking"
                  ? "Sumasagot…"
                  : "Pindutin ang mic at magtanong"}
          </Text>
        </View>

        {transcript ? (
          <View style={[styles.bubble, styles.userBubble, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.bubbleLabel, { color: colors.mutedForeground }]}>Ikaw</Text>
            <Text style={[styles.bubbleText, { color: colors.foreground }]}>{transcript}</Text>
          </View>
        ) : null}

        {reply ? (
          <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.bubbleLabel, { color: persona.color }]}>Judith</Text>
            <Text style={[styles.bubbleText, { color: colors.foreground }]}>{reply}</Text>
          </View>
        ) : null}

        {!transcript && !reply ? (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => void runAsk(s)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.suggestion,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.dock, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          placeholder="O i-type ang tanong…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          onSubmitEditing={sendTyped}
          returnKeyType="send"
          editable={!busy}
        />
        {typed.trim() ? (
          <Pressable
            onPress={sendTyped}
            style={[styles.mic, { backgroundColor: colors.primary }]}
          >
            <Feather name="arrow-up" size={24} color={colors.primaryForeground} />
          </Pressable>
        ) : (
          <Pressable
            onPress={toggleMic}
            disabled={busy}
            style={[styles.mic, { backgroundColor: micColor, opacity: busy ? 0.5 : 1 }]}
          >
            <Feather name={orb === "listening" ? "square" : "mic"} size={24} color="#fff" />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 24, gap: 18 },
  header: { alignItems: "center", gap: 4 },
  title: { fontSize: 24, fontWeight: "800" },
  persona: { fontSize: 14, fontWeight: "700" },
  orbArea: { alignItems: "center", gap: 14, marginVertical: 10 },
  status: { fontSize: 15 },
  bubble: { borderRadius: 18, padding: 16, gap: 6 },
  userBubble: { alignSelf: "flex-end", maxWidth: "90%" },
  bubbleLabel: { fontSize: 12, fontWeight: "700" },
  bubbleText: { fontSize: 16, lineHeight: 23 },
  suggestions: { gap: 10 },
  suggestion: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  suggestionText: { fontSize: 15 },
  error: { fontSize: 14, textAlign: "center" },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
  },
  mic: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
});
