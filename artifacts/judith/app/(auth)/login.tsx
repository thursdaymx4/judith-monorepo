import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn, Low, Txt } from "@/components/ui";
import { useAuth, type OAuthProvider } from "@/contexts/AuthContext";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

type Busy = null | "submit" | "google" | "apple";

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { persona } = useJudith();
  const { signInWithPassword, signUp, signInWithProvider, resetPassword } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

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

  const msg = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;

  const submit = async () => {
    setErr("");
    setNotice("");
    if (!email.trim() || !password) {
      setErr("Enter your email and password.");
      return;
    }
    setBusy("submit");
    try {
      if (mode === "login") {
        await signInWithPassword(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice("Check your email to confirm your account, then log in.");
          setMode("login");
          setPassword("");
        }
      }
    } catch (e) {
      setErr(msg(e, "Something went wrong"));
    } finally {
      setBusy(null);
    }
  };

  const oauth = async (provider: OAuthProvider) => {
    setErr("");
    setNotice("");
    setBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch (e) {
      setErr(msg(e, "Sign-in failed"));
    } finally {
      setBusy(null);
    }
  };

  const forgot = async () => {
    setErr("");
    setNotice("");
    if (!email.trim()) {
      setErr("Enter your email first, then tap Forgot password.");
      return;
    }
    setBusy("submit");
    try {
      await resetPassword(email);
      setNotice("Password reset link sent to your email.");
    } catch (e) {
      setErr(msg(e, "Could not send reset link"));
    } finally {
      setBusy(null);
    }
  };

  const anyBusy = busy !== null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 22,
          paddingTop: insets.top + 18,
          paddingBottom: 18,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 26 }}>
          <JudithAvatar persona={persona} size={64} state="idle" />
          <View style={{ flex: 1 }}>
            <Txt
              size={12}
              weight="semibold"
              color={t.accent}
              style={{ letterSpacing: 1.92, textTransform: "uppercase", marginBottom: 4 }}
            >
              {mode === "login" ? "Welcome back" : "Get started"}
            </Txt>
            <Txt size={26} weight="semibold" style={{ letterSpacing: -0.4, lineHeight: 30 }}>
              {mode === "login" ? "Hi, I’m Judith" : "Create your account"}
            </Txt>
          </View>
        </View>

        {/* socials */}
        <Btn
          variant="soft"
          icon="apple"
          label={busy === "apple" ? "" : "Continue with Apple"}
          onPress={() => oauth("apple")}
          style={{ marginBottom: 9 }}
        >
          {busy === "apple" && <ActivityIndicator color={t.txtHi} />}
        </Btn>
        <Btn
          variant="soft"
          icon="google"
          label={busy === "google" ? "" : "Continue with Google"}
          onPress={() => oauth("google")}
        >
          {busy === "google" && <ActivityIndicator color={t.txtHi} />}
        </Btn>

        {/* divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
          <Txt size={12} color={t.txtLow}>
            or use email
          </Txt>
          <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
        </View>

        {/* fields */}
        <View style={{ gap: 11 }}>
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
          <View>
            <Txt size={12} color={t.txtMid} style={{ marginBottom: 6 }}>
              Password
            </Txt>
            <TextInput
              style={inputStyle}
              placeholder="••••••••"
              placeholderTextColor={t.txtLow}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {mode === "login" && (
            <Pressable onPress={forgot} disabled={anyBusy} style={{ alignSelf: "flex-end" }}>
              <Txt size={12} color={t.txtMid}>
                Forgot password?
              </Txt>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* cta-bar */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          gap: 10,
        }}
      >
        {!!notice && (
          <Low size={13} color={t.accent} style={{ textAlign: "center" }}>
            {notice}
          </Low>
        )}
        {!!err && (
          <Low size={13} color={t.semantic.urgent} style={{ textAlign: "center" }}>
            {err}
          </Low>
        )}

        <Btn label={busy === "submit" ? "" : mode === "login" ? "Log in" : "Create account"} onPress={submit}>
          {busy === "submit" && <ActivityIndicator color={t.onAccent} />}
        </Btn>

        <Pressable
          onPress={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));
            setErr("");
            setNotice("");
          }}
          disabled={anyBusy}
          style={{ paddingTop: 2 }}
        >
          <Txt size={14} color={t.txtMid} style={{ textAlign: "center" }}>
            {mode === "login" ? "New to Judith? " : "Already have an account? "}
            <Txt size={14} weight="semibold" color={t.accent}>
              {mode === "login" ? "Create an account" : "Log in"}
            </Txt>
          </Txt>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
