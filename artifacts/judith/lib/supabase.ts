import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalizes a Supabase URL to the project API origin.
 *
 * Accepts the canonical `https://<ref>.supabase.co` form as well as the common
 * mistake of pasting the dashboard URL
 * (`https://supabase.com/dashboard/project/<ref>`), which would otherwise return
 * HTML and surface as "JSON Parse error: Unexpected character: <".
 */
function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "supabase.com" || host === "app.supabase.com") {
    const match = parsed.pathname.match(/\/project\/([a-z0-9]+)/i);
    if (match) {
      return `https://${match[1]}.supabase.co`;
    }
  }
  return parsed.origin;
}

const url = normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}
