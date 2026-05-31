import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { PAYWALL_ENABLED } from "@/constants/config";
import type { PersonaId } from "@/constants/personas";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { hasActiveEntitlement } from "@/lib/purchases";

interface Profile {
  persona: PersonaId;
  voice_id: string | null;
  subscription_status: "free" | "trial" | "active" | "expired";
  reminders_enabled: boolean;
  onboarded: boolean;
}

const DEFAULT_PROFILE: Profile = {
  persona: "professional",
  voice_id: null,
  subscription_status: "free",
  reminders_enabled: true,
  onboarded: false,
};

interface SettingsContextValue {
  profile: Profile;
  loading: boolean;
  hasAccess: boolean;
  refresh: () => Promise<void>;
  setPersona: (persona: PersonaId) => Promise<void>;
  setRemindersEnabled: (enabled: boolean) => Promise<void>;
  markOnboarded: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [entitled, setEntitled] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setProfile(DEFAULT_PROFILE);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("persona, voice_id, subscription_status, reminders_enabled, onboarded")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setProfile({ ...DEFAULT_PROFILE, ...(data as Partial<Profile>) });
    }
    setEntitled(await hasActiveEntitlement());
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (patch: Partial<Profile>) => {
      setProfile((prev) => ({ ...prev, ...patch }));
      if (supabase && user) {
        await supabase
          .from("profiles")
          .upsert({ id: user.id, ...patch }, { onConflict: "id" });
      }
    },
    [user],
  );

  const value = useMemo<SettingsContextValue>(() => {
    const subscriptionActive =
      profile.subscription_status === "active" ||
      profile.subscription_status === "trial";
    const hasAccess = !PAYWALL_ENABLED || entitled || subscriptionActive;
    return {
      profile,
      loading,
      hasAccess,
      refresh,
      setPersona: (persona) => update({ persona, voice_id: null }),
      setRemindersEnabled: (reminders_enabled) => update({ reminders_enabled }),
      markOnboarded: () => update({ onboarded: true }),
    };
  }, [profile, loading, entitled, refresh, update]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
