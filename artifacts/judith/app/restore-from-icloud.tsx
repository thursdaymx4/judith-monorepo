/**
 * Restore-from-iCloud chooser.
 *
 * Modal screen that lists every backup snapshot iCloud has for the
 * signed-in account, newest first. Each row shows when it was saved and
 * how many bills it contains; tapping a row confirms and applies the
 * restore, replacing local state with the chosen snapshot.
 *
 * Reachable from:
 *   - Settings -> Account -> Restore from iCloud
 *   - WelcomeBackSheet's "See all backups" affordance
 *   - Welcome screen's "Restore from iCloud" CTA when a backup peek
 *     confirms there's more than one snapshot to choose from
 */
import { useRouter, Stack } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Low, Txt } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { listICloudBackups, type BackupSummary } from "@/lib/icloud-backup";

function formatWhen(iso: string): { date: string; relative: string } {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    return { date: iso, relative: "" };
  }
  const date = d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  let relative = "";
  if (mins < 1) relative = "just now";
  else if (mins < 60) relative = `${mins} min ago`;
  else if (mins < 60 * 24) relative = `${Math.round(mins / 60)} h ago`;
  else relative = `${Math.round(mins / (60 * 24))} d ago`;
  return { date, relative };
}

export default function RestoreFromICloudScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { applyICloudBackupByKey, showToast, onboarded } = useJudith();

  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  /**
   * Bulletproof close handler. The chooser can be reached from THREE
   * places (Settings inside tabs, WelcomeBackSheet inside onboarding,
   * legacy Welcome-screen Restore button), and at least one of those
   * paths — the WelcomeBackSheet one — pushes from inside a React
   * Native <Modal> that sits OUTSIDE expo-router's stack. The resulting
   * navigation state sometimes has no `back` entry registered for the
   * chooser, so plain `router.back()` no-ops silently and the user is
   * stuck on the modal with a dead X button.
   *
   * Order of escalation:
   *   1. canGoBack() → standard pop, when history is intact
   *   2. canDismiss() → dismiss the modal presentation when available
   *   3. router.replace(...) → fall back to a known-valid root so the
   *      user never gets trapped, picking onboarding vs tabs based on
   *      whether they're past setup.
   */
  const closeChooser = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const dismiss = (router as unknown as { dismiss?: () => void; canDismiss?: () => boolean }).dismiss;
    const canDismiss = (router as unknown as { canDismiss?: () => boolean }).canDismiss;
    if (typeof canDismiss === "function" && canDismiss() && typeof dismiss === "function") {
      dismiss();
      return;
    }
    router.replace(onboarded ? "/(tabs)" : "/(onboarding)");
  };

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setBackups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listICloudBackups(user.id);
      setBackups(list);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onTapBackup = (b: BackupSummary) => {
    const { date } = formatWhen(b.savedAt);
    Alert.alert(
      "Restore this backup?",
      `Your current bills and settings will be REPLACED with the snapshot from ${date} (${b.billCount} bill${b.billCount === 1 ? "" : "s"}).`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setApplyingKey(b.key);
            const ok = await applyICloudBackupByKey(b.key);
            setApplyingKey(null);
            if (ok) {
              showToast("Restored from iCloud");
              // A successful restore may have flipped the underlying Stack
              // guards (onboarded true→false or vice versa depending on the
              // snapshot age), invalidating the route this modal was
              // pushed on top of. Reusing `closeChooser` ensures we land on
              // a valid root regardless of which guard is now active.
              closeChooser();
            } else {
              Alert.alert(
                "Couldn't restore",
                "We couldn't read that backup. It may be from a different account or partially uploaded. Try another one.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable onPress={closeChooser} hitSlop={12}>
          <Icon name="x" size={24} color={t.txtHi} />
        </Pressable>
        <Txt size={16} weight="bold">Restore from iCloud</Txt>
        <Pressable onPress={() => void refresh()} hitSlop={12}>
          <Icon name="refresh" size={22} color={t.txtMid} />
        </Pressable>
      </View>

      <Low size={12} style={{ paddingHorizontal: 22, marginBottom: 8 }}>
        Choose a backup to restore. Your current bills and settings will be
        replaced with the chosen snapshot.
      </Low>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ paddingVertical: 64, alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={t.accent} />
            <Low size={12}>Searching iCloud…</Low>
          </View>
        ) : !user?.id ? (
          <View style={{ paddingVertical: 64, alignItems: "center", paddingHorizontal: 32, gap: 8 }}>
            <Txt size={15} weight="bold" style={{ textAlign: "center" }}>
              Sign in to view your backups
            </Txt>
            <Low size={12} style={{ textAlign: "center" }}>
              Your iCloud backups are tied to your Apple ID. Sign in with Apple
              to see them.
            </Low>
          </View>
        ) : backups.length === 0 ? (
          <View style={{ paddingVertical: 64, alignItems: "center", paddingHorizontal: 32, gap: 8 }}>
            <Icon name="globe" size={36} color={t.txtMid} />
            <Txt size={15} weight="bold" style={{ textAlign: "center" }}>
              No backups yet
            </Txt>
            <Low size={12} style={{ textAlign: "center" }}>
              Your bills will start backing up to iCloud automatically as soon
              as you add one.
            </Low>
          </View>
        ) : (
          backups.map((b, idx) => {
            const { date, relative } = formatWhen(b.savedAt);
            const isApplying = applyingKey === b.key;
            return (
              <Pressable
                key={b.key}
                onPress={() => onTapBackup(b)}
                disabled={!!applyingKey}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  marginBottom: 10,
                  borderRadius: t.radius.md,
                  borderWidth: 1,
                  borderColor: idx === 0 ? t.accent : t.line,
                  backgroundColor: idx === 0 ? t.accent + "0a" : t.surface1,
                  opacity: applyingKey && !isApplying ? 0.4 : 1,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: t.accent + "1c",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isApplying ? (
                    <ActivityIndicator size="small" color={t.accent} />
                  ) : (
                    <Icon name="globe" size={18} color={t.accent} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Txt size={14} weight="bold">{date}</Txt>
                    {idx === 0 ? (
                      <Txt size={10} weight="bold" color={t.accent}>LATEST</Txt>
                    ) : null}
                  </View>
                  <Low size={11} style={{ marginTop: 2 }}>
                    {b.billCount} bill{b.billCount === 1 ? "" : "s"}
                    {relative ? ` · ${relative}` : ""}
                    {b.legacy ? " · v1" : ""}
                  </Low>
                </View>
                <Icon name="chev" size={18} color={t.txtMid} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
