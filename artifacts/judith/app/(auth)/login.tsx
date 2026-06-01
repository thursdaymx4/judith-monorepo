import React, { useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn, Low, Txt } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { persona } = useJudith();
  const { signInWithOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const inputStyle = {
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
  } as const;

  const send = async () => {
    setErr("");
    setBusy(true);
    try {
      await signInWithOtp(email);
      setStep("code");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setErr("");
    setBusy(true);
    try {
      await verifyOtp(email, code);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      {/* scroll center */}
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 22,
          paddingTop: insets.top + 14,
          paddingBottom: 26,
        }}
      >
        <JudithAvatar persona={persona} size={92} state="idle" />

        <Txt
          size={12}
          weight="semibold"
          color={t.accent}
          style={{
            letterSpacing: 1.92,
            textTransform: "uppercase",
            marginTop: 26,
            marginBottom: 8,
          }}
        >
          Welcome back
        </Txt>

        <Txt
          size={27}
          weight="semibold"
          style={{
            lineHeight: 30,
            letterSpacing: -0.4,
            textAlign: "center",
            maxWidth: 280,
            marginTop: 4,
          }}
        >
          {step === "email" ? "Sign in to Judith" : "Check your email"}
        </Txt>

        <Txt
          size={15}
          color={t.txtMid}
          style={{ lineHeight: 21, textAlign: "center", maxWidth: 270, marginTop: 10 }}
        >
          {step === "email"
            ? "Your due dates, handled — pick up right where you left off."
            : `I sent a 6-digit code to ${email}.`}
        </Txt>

        {/* fields */}
        <View style={{ marginTop: 26, width: "100%" }}>
          {step === "email" ? (
            <View style={{ width: "100%", gap: 11 }}>
              <View>
                <Txt size={12} color={t.txtMid} style={{ marginBottom: 6 }}>
                  Email or mobile
                </Txt>
                <TextInput
                  style={inputStyle}
                  placeholder="you@email.com"
                  placeholderTextColor={t.txtLow}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>
          ) : (
            <View style={{ width: "100%", gap: 11 }}>
              <View>
                <Txt size={12} color={t.txtMid} style={{ marginBottom: 6 }}>
                  6-digit code
                </Txt>
                <TextInput
                  style={inputStyle}
                  placeholder="••••••"
                  placeholderTextColor={t.txtLow}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                />
              </View>
            </View>
          )}
        </View>
      </View>

      {/* cta-bar */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: insets.bottom + 20,
          gap: 9,
        }}
      >
        {step === "email" ? (
          <Btn label={busy ? "" : "Send code"} onPress={send}>
            {busy && <ActivityIndicator color={t.onAccent} />}
          </Btn>
        ) : (
          <>
            <Btn label={busy ? "" : "Log in"} onPress={verify}>
              {busy && <ActivityIndicator color={t.onAccent} />}
            </Btn>
            <Btn label="Use a different email" variant="ghost" onPress={() => setStep("email")} />
          </>
        )}

        {!!err && (
          <Low size={13} color={t.semantic.urgent} style={{ textAlign: "center", paddingTop: 4 }}>
            {err}
          </Low>
        )}
      </View>
    </View>
  );
}
