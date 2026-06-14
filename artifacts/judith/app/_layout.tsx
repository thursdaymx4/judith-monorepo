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
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";

// Sentry must initialize before any other JS executes app code — surfaces
// crashes and unhandled rejections that happen during the very first render.
// DSN is public by design; pulled from env so dev/prod can point at different
// projects. Set EXPO_PUBLIC_SENTRY_DSN in `.env` (and as an EAS secret for CI).
//
// IMPORTANT — In dev we skip Sentry.init entirely (not just `enabled: false`).
// With only `enabled: false`, Sentry STILL installs its auto-instrumentation:
// every fetch is wrapped in a transaction, every touch is recorded as a
// breadcrumb, every screen change is tracked. With `tracesSampleRate: 1.0`
// in dev that was bombarding the JS thread with span/transaction work even
// though no events were being uploaded. Symptom: hundreds of CFNetwork
// events/sec while the app was idle, JS thread starved, taps stopped
// responding (scrolls kept working because they're UI-thread). Skipping
// init entirely in dev means no instrumentation, no breadcrumb buffer, no
// transaction overhead. Production builds still get full Sentry coverage.
if (!__DEV__) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // 20% of perf traces in production to stay under the free-tier budget.
    tracesSampleRate: 0.2,
  });
}
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, AppState, LogBox, Pressable, StyleSheet, Text, View } from "react-native";
import { resetAudioToPlayback, stopCurrentAudio } from "@/lib/audio";

// expo-notifications logs this on every push-token call on the iOS simulator —
// harmless and won't appear on real devices.
LogBox.ignoreLogs([/expo-notifications: obtaining a push token may not work on iOS simulators/]);
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BreathingBackdrop } from "@/components/BreathingBackdrop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HandledSplash } from "@/components/HandledSplash";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { JudithProvider, useJudith } from "@/contexts/JudithStore";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { useNotificationSync } from "@/hooks/useNotificationSync";
import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { useWatchSync } from "@/hooks/useWatchSync";
import { useTheme } from "@/hooks/useTheme";
import { registerNotificationCategories, syncRemotePushRegistrationToSession } from "@/lib/notifications";
import { configurePurchases, identifyUser, resetUser, getActiveTier } from "@/lib/purchases";
import { SubscriptionProvider } from "@/lib/SubscriptionProvider";

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
  const { onboarded, hydrated, guest, faceIdLock, tier, subscribe, markPaid, snooze } = useJudith();
  const t = useTheme();
  const router = useRouter();

  const authed = !!session || guest;
  const isOnboarded = authed && onboarded && !recoveryActive;

  // Sync RevenueCat entitlements into the store whenever the session changes.
  // Runs once on mount (handles cold launch) and again on sign-in/out.
  useEffect(() => {
    if (session?.user?.id) {
      const userId = session.user.id;
      configurePurchases(userId);
      identifyUser(userId).catch(() => {});
      getActiveTier()
        .then((activeTier) => {
          if (activeTier !== tier) subscribe(activeTier);
        })
        .catch(() => {});
    } else {
      resetUser().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Defensive: whenever the app returns to the foreground (or first activates),
  // hard-reset the audio system. Tears down any orphaned player, drains the
  // playback queue, and flips the iOS audio session out of PlayAndRecord. This
  // prevents audio-state leaks from compounding into systemic UI slowness.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        stopCurrentAudio();
        resetAudioToPlayback().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // Register notification action categories (Mark Paid / Remind Tomorrow buttons).
  useEffect(() => { registerNotificationCategories().catch(() => {}); }, []);

  // Pull and apply OTA updates promptly (first reopen, not the second).
  useOtaUpdate();

  // Keep local notifications in sync with bills and toggles.
  useNotificationSync();

  // Keep the paired Apple Watch in sync whenever bills change.
  useWatchSync();

  // Keep remote push registration in sync if iOS rotates the push token.
  useEffect(() => {
    if (!authed) return;
    const sub = Notifications.addPushTokenListener(() => {
      syncRemotePushRegistrationToSession().catch(() => {});
    });
    return () => sub.remove();
  }, [authed]);

  // Navigate to the relevant bill when the user taps a Judith notification.
  // Handles both foreground taps and cold-start launches from a notification.
  useEffect(() => {
    if (!isOnboarded) return;

    function handleResponse(response: Notifications.NotificationResponse) {
      const billId = response.notification.request.content.data?.billId as string | undefined;
      if (typeof billId !== "string") return;

      const action = response.actionIdentifier;
      if (action === "pay-now") {
        markPaid(billId);
      } else if (action === "remind-tomorrow") {
        snooze(billId, 1);
      } else {
        // Default tap — open the bill detail
        router.push(`/bill/${billId}`);
      }
    }

    // Cold start: app was launched by tapping a notification
    Notifications.getLastNotificationResponseAsync()
      .then((response) => { if (response) handleResponse(response); })
      .catch(() => {});

    // Foreground / background tap
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboarded]);

  // Only engage biometric lock once the user is fully onboarded and authed.
  const { locked, unlock } = useBiometricLock(isOnboarded && faceIdLock);

  if (!configured) return <NotConfigured />;
  if (loading || !hydrated) return <Loading />;

  const modalOpts = { presentation: "modal" as const, headerShown: false };

  // BreathingBackdrop is now mounted ONLY while the user is on a screen
  // that visually needs it (splash + auth). Once authed, it unmounts —
  // freeing the UI thread of 5 Reanimated worklet loops + 5 SVG radial
  // gradients that were running indefinitely behind opaque tab screens.
  // That sustained UI-thread work was the source of the "app gets slower
  // after 5 minutes" thermal-throttling complaint.
  const showBackdrop = !authed || recoveryActive;

  return (
    <View style={{ flex: 1 }}>
      {showBackdrop && <BreathingBackdrop />}
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
          {/* Auth route renders transparent so the root BreathingBackdrop
              shows through — without this override, Stack's default
              contentStyle (t.canvas, opaque) paints over the bloom field
              and the login looks blank. */}
          <Stack.Screen name="(auth)" options={{ contentStyle: { backgroundColor: "transparent" } }} />
        </Stack.Protected>
      </Stack>
      {isOnboarded && faceIdLock && locked && (
        <View style={StyleSheet.absoluteFillObject}>
          <BiometricLockScreen onUnlock={unlock} />
        </View>
      )}
    </View>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    PlayfairDisplay_800ExtraBold_Italic,
  });

  // The animated "Handled." splash covers the screen while the JS bundle
  // warms and contexts hydrate. It dismisses itself ~2.2s after fonts load
  // by calling onDone(), at which point the system splash is also released.
  const [splashDone, setSplashDone] = React.useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {/* The persistent BreathingBackdrop used to live HERE at root,
                but it ran 5 Reanimated worklet loops (breathe + drift +
                spin per bloom) continuously even while the user was on a
                tab screen that paints opaquely on top. After ~5 minutes
                iOS thermal-throttles the CPU and the app feels
                progressively slower. The backdrop is now rendered
                conditionally inside RootLayoutNav, only while the user
                is unauthed (splash + auth screens) — see the
                `!authed` gate there. HandledSplash has its own internal
                backdrop instance, so the splash fade is unaffected. */}
            <KeyboardProvider>
              <AuthProvider>
                <JudithProvider>
                  <SubscriptionProvider>
                    <RootLayoutNav />
                    {/* Splash sits INSIDE the provider stack so its useTheme()
                        call resolves against JudithProvider. It absolute-positions
                        over RootLayoutNav and unmounts after its own fade. */}
                    {!splashDone && <HandledSplash onDone={() => setSplashDone(true)} />}
                  </SubscriptionProvider>
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

// Sentry.wrap installs the error boundary that captures unhandled render
// errors with full component stack frames + a "view stacktrace" link in the
// Sentry UI. Keep this as the default export so Expo Router picks it up.
export default Sentry.wrap(RootLayout);
