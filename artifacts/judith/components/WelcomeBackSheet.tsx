/**
 * Welcome-back sheet — surfaces when iCloud has a backup for the
 * signed-in account and there's no local data yet (returning user
 * reinstall). Without this prompt, the previous build silently routed
 * the user through onboarding and the post-onboarding blank state
 * overwrote the iCloud backup before they could intervene.
 *
 * Two paths:
 *  - Restore: applies the backup and jumps the user straight to Home.
 *  - Start fresh: confirm-warns that continuing will replace the prior
 *    backup, then dismisses the sheet so onboarding can proceed.
 */
import React from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Low, Txt } from "@/components/ui";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

export function WelcomeBackSheet() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingRestore, applyPendingRestore, dismissPendingRestore } = useJudith();

  if (!pendingRestore) return null;

  const savedAt = new Date(pendingRestore.savedAt);
  const dateLabel = Number.isFinite(savedAt.getTime())
    ? savedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "an earlier date";

  const onRestore = async () => {
    await applyPendingRestore();
  };

  const onStartFresh = () => {
    Alert.alert(
      "Start fresh?",
      "Your previous backup stays in iCloud, but the moment you add a bill or finish onboarding, the new state will REPLACE the old one. Restore your existing data instead?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore instead",
          onPress: () => void onRestore(),
        },
        {
          text: "Start fresh",
          style: "destructive",
          onPress: () => dismissPendingRestore(),
        },
      ],
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onStartFresh}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: t.canvas,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 20,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 22,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 14 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: t.accent + "1c",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="refresh" size={28} color={t.accent} />
            </View>
          </View>

          <Txt size={20} weight="bold" style={{ textAlign: "center", marginBottom: 6 }}>
            Welcome back
          </Txt>
          <Low size={13} style={{ textAlign: "center", marginBottom: 18 }}>
            We found your iCloud backup from {dateLabel}.{" "}
            {pendingRestore.billCount > 0
              ? `${pendingRestore.billCount} bill${pendingRestore.billCount === 1 ? "" : "s"}, your settings, and your altitude history are still there.`
              : "Your settings and altitude history are still there."}
          </Low>

          <Pressable
            onPress={() => void onRestore()}
            style={{
              backgroundColor: t.accent,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Txt size={16} weight="bold" color={t.onAccent}>
              Restore my data
            </Txt>
          </Pressable>

          <Pressable
            onPress={() => {
              // Dismiss the RN <Modal> first, then push on the next tick.
              // Pushing while the modal is still in its close animation can
              // leave expo-router without a proper back entry, breaking the
              // chooser's X button. The 0ms timeout lets React commit the
              // dismiss before navigation kicks off.
              dismissPendingRestore();
              setTimeout(() => router.push("/restore-from-icloud"), 0);
            }}
            style={{ paddingVertical: 10, alignItems: "center" }}
          >
            <Txt size={14} color={t.accent}>
              See all backups
            </Txt>
          </Pressable>

          <Pressable
            onPress={onStartFresh}
            style={{ paddingVertical: 10, alignItems: "center" }}
          >
            <Txt size={15} color={t.txtMid}>
              Start fresh instead
            </Txt>
          </Pressable>

          <Low size={11} style={{ textAlign: "center", marginTop: 14 }}>
            If you start fresh, the new data will replace this backup as soon as you finish onboarding.
          </Low>
        </View>
      </View>
    </Modal>
  );
}
