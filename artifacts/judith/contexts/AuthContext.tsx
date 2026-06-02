import type { Session, User } from "@supabase/supabase-js";
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
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
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

async function sendSessionToWatch(session: Session): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const WatchConnectivity = (await import("react-native-watch-connectivity")).default;
    const installed = await WatchConnectivity.getIsWatchAppInstalled();
    if (!installed) return;
    await WatchConnectivity.transferUserInfo({
      supabaseAccessToken: session.access_token,
      supabaseRefreshToken: session.refresh_token,
    });
  } catch {
    /* watch not paired or app not installed — silently ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryActive, setRecoveryActive] = useState(false);

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
    [session, loading, recoveryActive],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
