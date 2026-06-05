import type { Session, User } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  recoveryActive: boolean;
  appleAuthAvailable: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
  signInWithApple: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  establishSessionFromUrl: (url: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readTokensFromUrl(rawUrl: string): {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  errorDescription?: string;
} {
  const queryString = rawUrl.includes("?") ? rawUrl.split("?")[1].split("#")[0] : "";
  const hashString = rawUrl.includes("#") ? rawUrl.split("#")[1] : "";
  const query = new URLSearchParams(queryString);
  const hash = new URLSearchParams(hashString);
  return {
    code: query.get("code") ?? undefined,
    accessToken: hash.get("access_token") ?? undefined,
    refreshToken: hash.get("refresh_token") ?? undefined,
    errorDescription:
      hash.get("error_description") ?? query.get("error_description") ?? undefined,
  };
}

// Apple Watch sync is implemented in feature #5.
// react-native-watch-connectivity calls TurboModuleRegistry.getEnforcing() at
// module-load time — that throw cannot be caught by a try/catch around a
// dynamic import(). The integration requires a development build with the
// native WatchConnectivity module compiled in. This function is a no-op
// placeholder until the Watch feature is built.
async function sendSessionToWatch(_session: Session): Promise<void> {
  // TODO (feature #5): send supabaseAccessToken + supabaseRefreshToken via
  // WatchConnectivity.transferUserInfo() in a dev build.
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryActive, setRecoveryActive] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) setAppleAuthAvailable(available);
      })
      .catch(() => {
        if (active) setAppleAuthAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) sendSessionToWatch(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN" && next) sendSessionToWatch(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,
      recoveryActive,
      appleAuthAvailable,
      async signInWithPassword(email: string, password: string) {
        if (!supabase) throw new Error("Supabase not configured");
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },
      async signUp(email: string, password: string) {
        if (!supabase) throw new Error("Supabase not configured");
        const redirectTo = Linking.createURL("auth/callback");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      async signInWithProvider(provider: OAuthProvider) {
        if (!supabase) throw new Error("Supabase not configured");
        const redirectTo = Linking.createURL("auth/callback");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("Could not start sign-in");

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === "cancel" || result.type === "dismiss") return;
        if (result.type !== "success" || !result.url) {
          throw new Error("Sign-in was cancelled");
        }

        const { code, accessToken, refreshToken, errorDescription } =
          readTokensFromUrl(result.url);
        if (errorDescription) throw new Error(errorDescription);
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
          return;
        }
        if (accessToken && refreshToken) {
          const { error: sErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sErr) throw sErr;
          return;
        }
        throw new Error("Sign-in did not complete");
      },
      async signInWithApple() {
        if (!supabase) throw new Error("Supabase not configured");
        const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(
          /-/g,
          "",
        );
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce,
        );
        let credential: AppleAuthentication.AppleAuthenticationCredential;
        try {
          credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
          });
        } catch (e) {
          if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return;
          throw e;
        }
        if (!credential.identityToken) {
          throw new Error("Apple sign-in failed: no identity token returned");
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
          nonce: rawNonce,
        });
        if (error) throw error;
      },
      async resetPassword(email: string) {
        if (!supabase) throw new Error("Supabase not configured");
        const redirectTo = Linking.createURL("auth/reset");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });
        if (error) throw error;
      },
      async establishSessionFromUrl(url: string) {
        if (!supabase) throw new Error("Supabase not configured");
        const { code, accessToken, refreshToken, errorDescription } =
          readTokensFromUrl(url);
        if (errorDescription) throw new Error(errorDescription);
        if (code) {
          setRecoveryActive(true);
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } catch (e) {
            setRecoveryActive(false);
            throw e;
          }
          return true;
        }
        if (accessToken && refreshToken) {
          setRecoveryActive(true);
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          } catch (e) {
            setRecoveryActive(false);
            throw e;
          }
          return true;
        }
        return false;
      },
      async updatePassword(password: string) {
        if (!supabase) throw new Error("Supabase not configured");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecoveryActive(false);
      },
      async signOut() {
        setRecoveryActive(false);
        await supabase?.auth.signOut();
      },
    }),
    [session, loading, recoveryActive, appleAuthAvailable],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
