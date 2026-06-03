import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { PlayfairDisplay_800ExtraBold_Italic } from "@expo-google-fonts/playfair-display";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Splash } from "@/components/Splash";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { JudithProvider, useJudith } from "@/contexts/JudithStore";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { useTheme } from "@/hooks/useTheme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NotConfigured() {
  const t = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: t.canvas }]}>
      <Text style={[styles.title, { color: t.txtHi, fontFamily: t.fonts.bold }]}>
        Setup needed
      </Text>
      <Text style={[styles.body, { color: t.txtMid, fontFamily: t.fonts.regular }]}>
        Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and
        EXPO_PUBLIC_SUPABASE_ANON_KEY.
      </Text>
    </View>
  );
}

function Loading() {
  const t = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: t.canvas }]}>
      <ActivityIndicator color={t.accent} size="large" />
    </View>
  );
}

function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: t.canvas, gap: 20 }]}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hair,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 34 }}>🔒</Text>
      </View>
      <Text style={{ fontFamily: t.fonts.semibold, fontSize: 20, color: t.txtHi, letterSpacing: -0.3 }}>
        Judith is locked
      </Text>
      <Text style={{ fontFamily: t.fonts.regular, fontSize: 14, color: t.txtMid, textAlign: "center" }}>
        Use Face ID or your PIN to continue
      </Text>
      <Pressable
        onPress={onUnlock}
        style={({ pressed }) => ({
          marginTop: 8,
          paddingVertical: 14,
          paddingHorizontal: 32,
          borderRadius: 14,
          backgroundColor: t.accent,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ fontFamily: t.fonts.semibold, fontSize: 15, color: t.onAccent }}>
          Unlock with Face ID
        </Text>
      </Pressable>
    </View>
  );
}

function RootLayoutNav() {
  const { session, loading, configured, recoveryActive } = useAuth();
  const { onboarded, hydrated, guest, faceIdLock } = useJudith();
  const t = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  const authed = !!session || guest;
  const isOnboarded = authed && onboarded && !recoveryActive;

  // Only engage biometric lock once the user is fully onboarded and authed.
  const { locked, unlock } = useBiometricLock(isOnboarded && faceIdLock);

  if (!configured) return <NotConfigured />;
  if (loading || !hydrated) return <Loading />;

  const modalOpts = { presentation: "modal" as const, headerShown: false };

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.canvas } }}>
        <Stack.Protected guard={isOnboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="account" options={modalOpts} />
          <Stack.Screen name="ask" options={modalOpts} />
          <Stack.Screen name="reminders" options={modalOpts} />
          <Stack.Screen name="devices" options={modalOpts} />
          <Stack.Screen name="bills" options={modalOpts} />
          <Stack.Screen name="add-bill" options={modalOpts} />
          <Stack.Screen name="plans" options={modalOpts} />
          <Stack.Screen name="bill/[id]" options={modalOpts} />
        </Stack.Protected>
        <Stack.Protected guard={authed && !onboarded && !recoveryActive}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={!authed || recoveryActive}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      {/* Biometric lock overlay — sits above everything including the splash */}
      {isOnboarded && faceIdLock && locked && splashDone && (
        <View style={StyleSheet.absoluteFillObject}>
          <BiometricLockScreen onUnlock={unlock} />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    PlayfairDisplay_800ExtraBold_Italic,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <JudithProvider>
                  <RootLayoutNav />
                </JudithProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  title: { fontSize: 22 },
  body: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
