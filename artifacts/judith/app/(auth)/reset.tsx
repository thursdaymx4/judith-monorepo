import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn, Low, Txt } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

export default function ResetScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { persona } = useJudith();
  const { establishSessionFromUrl, updatePassword } = useAuth();
  const url = Linking.useURL();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const initial = url ?? (await Linking.getInitialURL());
      if (!initial) {
        if (active) setErr("This reset link is invalid or has expired.");
        return;
      }
      try {
        const ok = await establishSessionFromUrl(initial);
        if (active) {
          if (ok) setReady(true);
          else setErr("This reset link is invalid or has expired.");
        }
      } catch (e) {
        if (active) {
          setErr(e instanceof Error ? e.message : "Could not verify reset link.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [url, establishSessionFromUrl]);

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

  const submit = async () => {
    setErr("");
    setNotice("");
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setNotice("Password updated. Taking you in…");
      setTimeout(() => router.replace("/"), 700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

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
          paddingBottom: insets.bottom + 18,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 26 }}
        >
          <JudithAvatar persona={persona} size={64} state="idle" />
          <View style={{ flex: 1 }}>
            <Txt
              size={12}
              weight="semibold"
              color={t.accent}
              style={{ letterSpacing: 1.92, textTransform: "uppercase", marginBottom: 4 }}
            >
              Reset password
            </Txt>
            <Txt size={26} weight="semibold" style={{ letterSpacing: -0.4, lineHeight: 30 }}>
              Pick a new one
            </Txt>
          </View>
        </View>

        {!ready && !err && (
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
            <ActivityIndicator color={t.accent} />
            <Low size={13} color={t.txtMid}>
              Verifying your reset link…
            </Low>
          </View>
        )}

        {ready && (
          <View style={{ gap: 11 }}>
            <View>
              <Txt size={12} color={t.txtMid} style={{ marginBottom: 6 }}>
                New password
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
            <View>
              <Txt size={12} color={t.txtMid} style={{ marginBottom: 6 }}>
                Confirm password
              </Txt>
              <TextInput
                style={inputStyle}
                placeholder="••••••••"
                placeholderTextColor={t.txtLow}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={confirm}
                onChangeText={setConfirm}
              />
            </View>
          </View>
        )}

        {!!notice && (
          <Low size={13} color={t.accent} style={{ textAlign: "center", marginTop: 16 }}>
            {notice}
          </Low>
        )}
        {!!err && (
          <Low size={13} color={t.semantic.urgent} style={{ textAlign: "center", marginTop: 16 }}>
            {err}
          </Low>
        )}

        {ready && (
          <Btn
            label={busy ? "" : "Update password"}
            onPress={submit}
            style={{ marginTop: 18 }}
          >
            {busy && <ActivityIndicator color={t.onAccent} />}
          </Btn>
        )}

        {!ready && !!err && (
          <Btn
            variant="soft"
            label="Back to log in"
            onPress={() => router.replace("/(auth)/login")}
            style={{ marginTop: 18 }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
