import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { JudithOrb } from "@/components/JudithOrb";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const { signInWithOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!email.includes("@")) {
      setError("Maglagay ng wastong email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithOtp(email);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "May mali. Subukan ulit.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (code.trim().length < 4) {
      setError("Ilagay ang code mula sa email mo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mali ang code. Subukan ulit.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <JudithOrb size={140} state="idle" />
            <Text style={[styles.title, { color: colors.foreground }]}>Judith</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Ang personal mong due date assistant
            </Text>
          </View>

          <View style={styles.form}>
            {step === "email" ? (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ikaw@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  style={[
                    styles.input,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                  ]}
                />
                <Button label="Ipadala ang code" onPress={sendCode} loading={busy} style={styles.cta} />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Code na ipinadala sa {email}
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    styles.code,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                  ]}
                />
                <Button label="Mag-login" onPress={confirm} loading={busy} style={styles.cta} />
                <Button
                  label="Baguhin ang email"
                  variant="ghost"
                  onPress={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                  }}
                  style={styles.secondary}
                />
              </>
            )}
            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 40 },
  hero: { alignItems: "center", gap: 8 },
  title: { fontSize: 40, fontWeight: "800", marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: "center" },
  form: { gap: 10 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  code: { letterSpacing: 8, textAlign: "center", fontSize: 22 },
  cta: { marginTop: 6 },
  secondary: { marginTop: 2 },
  error: { fontSize: 13, textAlign: "center", marginTop: 4 },
});
