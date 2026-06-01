import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IntroScreenGlow } from "@/components/GlowBlob";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn } from "@/components/ui";
import { useAuth, type OAuthProvider } from "@/contexts/AuthContext";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

type Busy = null | "submit" | "google" | "apple";

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { persona, setGuest } = useJudith();
  const { signInWithPassword, signUp, signInWithProvider, resetPassword } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const inputStyle = {
    borderWidth: 1,
    borderColor: t.hair,
    backgroundColor: t.surface1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
      {/* ── intro-screen persistent background glow (same as splash).
           radial-gradient(95% 55% at 50% 38%, accent 22%, transparent 62%) */}
      <IntroScreenGlow />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 26,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 26,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── avatar — centred, is-auth scale (prototype top:92px, scale:0.7×132=92px) */}
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <JudithAvatar persona={persona} size={92} state="idle" />
        </View>

        {/* ── intro-auth-head: kicker + title + lede */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          {/* .kicker: 12px uppercase letter-spacing:0.16em accent */}
          <Text
            style={{
              fontSize: 12,
              fontFamily: t.fonts.semibold,
              fontWeight: "600",
              letterSpacing: 1.92,
              textTransform: "uppercase",
              color: t.accent,
              marginBottom: 6,
            }}
          >
            {mode === "login" ? "Welcome" : "Get started"}
          </Text>

          {/* .title 25px */}
          <Text
            style={{
              fontSize: 25,
              fontFamily: t.fonts.semibold,
              fontWeight: "600",
              letterSpacing: -0.4,
              color: t.txtHi,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {mode === "login" ? "Hi, I'm Judith" : "Create your account"}
          </Text>

          {/* .lede 14px txtMid */}
          {mode === "login" && (
            <Text
              style={{
                fontSize: 14,
                fontFamily: t.fonts.regular,
                color: t.txtMid,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {"Your bills & due dates \u2014 handled, on time, no stress."}
            </Text>
          )}
        </View>

        {/* ── social buttons */}
        <View style={{ gap: 10, marginBottom: 6 }}>
          <Btn
            variant="soft"
            icon="apple"
            label={busy === "apple" ? "" : "Continue with Apple"}
            onPress={() => oauth("apple")}
          >
            {busy === "apple" && <ActivityIndicator color={t.txtHi} />}
          </Btn>

          {/* Google button — prototype: <span class="g-badge">G</span> + text */}
          <Pressable
            onPress={() => oauth("google")}
            disabled={anyBusy}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 18,
              backgroundColor: t.surface2,
              borderWidth: 1,
              borderColor: t.hair,
            }}
          >
            {busy === "google" ? (
              <ActivityIndicator color={t.txtHi} />
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: "#4285F4",
                    fontFamily: t.fonts.bold,
                  }}
                >
                  G
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "500",
                    color: t.txtHi,
                    fontFamily: t.fonts.medium,
                  }}
                >
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── "or use email" divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
          <Text style={{ fontSize: 12, color: t.txtLow, fontFamily: t.fonts.regular }}>
            or use email
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
        </View>

        {/* ── email + password fields */}
        <View style={{ gap: 10 }}>
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
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={t.txtLow}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
          />
          {mode === "login" && (
            <Pressable
              onPress={forgot}
              disabled={anyBusy}
              style={{ alignSelf: "flex-end", paddingVertical: 2 }}
            >
              <Text style={{ fontSize: 12, color: t.txtMid, fontFamily: t.fonts.regular }}>
                Forgot password?
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── feedback */}
        {!!notice && (
          <Text
            style={{
              marginTop: 12,
              fontSize: 13,
              color: t.accent,
              textAlign: "center",
              fontFamily: t.fonts.regular,
            }}
          >
            {notice}
          </Text>
        )}
        {!!err && (
          <Text
            style={{
              marginTop: 12,
              fontSize: 13,
              color: t.semantic.urgent,
              textAlign: "center",
              fontFamily: t.fonts.regular,
            }}
          >
            {err}
          </Text>
        )}

        {/* ── Log in button — btn-primary: accent bg, dark text */}
        <View style={{ marginTop: 20, gap: 10 }}>
          <Btn
            label={busy === "submit" ? "" : mode === "login" ? "Log in" : "Create account"}
            onPress={submit}
          >
            {busy === "submit" && <ActivityIndicator color={t.onAccent} />}
          </Btn>

          {/* .auth-foot: "New to Judith? Create an account" */}
          <Pressable
            onPress={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setErr("");
              setNotice("");
            }}
            disabled={anyBusy}
            style={{ paddingTop: 4 }}
          >
            <Text
              style={{
                fontSize: 14,
                color: t.txtMid,
                textAlign: "center",
                fontFamily: t.fonts.regular,
              }}
            >
              {mode === "login" ? "New to Judith? " : "Already have an account? "}
              <Text
                style={{
                  color: t.accent,
                  fontWeight: "600",
                  fontFamily: t.fonts.semibold,
                }}
              >
                {mode === "login" ? "Create an account" : "Log in"}
              </Text>
            </Text>
          </Pressable>

          {/* skip for now */}
          <Pressable
            onPress={() => setGuest(true)}
            disabled={anyBusy}
            style={{ paddingVertical: 6 }}
          >
            <Text
              style={{
                fontSize: 12,
                color: t.txtLow,
                textAlign: "center",
                fontFamily: t.fonts.regular,
              }}
            >
              Skip for now →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
