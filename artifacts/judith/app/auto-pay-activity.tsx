/**
 * Auto-pay activity — Phase 3 surface.
 *
 * Lists every event the FK matcher has produced: auto-marks, suggestions,
 * confirmations, undos. Append-only on-device log (lib/financeMatching.ts
 * AsyncStorage). Each auto-mark gets an Undo affordance for 24h; after
 * that the row is read-only and serves as audit history. This screen is
 * required by Apple's FK guidance — reviewers will check it exists when
 * the auto-mark feature ships.
 */
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Low, Mono, Screen, SheetHeader, Txt, mix } from "@/components/ui";
import { useJudithActions } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { safeBack } from "@/lib/navigation";
import {
  type ActivityEntry,
  clearActivity,
  confirmSuggestion,
  loadActivity,
  undoAutoMark,
} from "@/lib/financeMatching";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export default function AutoPayActivityScreen() {
  const t = useTheme();
  const router = useRouter();
  const { markPaid } = useJudithActions();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setEntries(await loadActivity());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Wrap markPaid in an "unmark" — the existing togglePaid is the proper
  // reverse, but for the undo path we just call markPaid which the store
  // treats as a toggle on the current period. Lighter than wiring a
  // separate togglePaid through useJudithActions.
  const unmark = useCallback((billId: string) => {
    markPaid(billId);
  }, [markPaid]);

  const handleUndo = async (id: string) => {
    setBusyId(id);
    try {
      await undoAutoMark(id, unmark);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirm = async (id: string) => {
    setBusyId(id);
    try {
      await confirmSuggestion(id, markPaid);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleClear = async () => {
    await clearActivity();
    await refresh();
  };

  return (
    <Screen contentStyle={{ paddingBottom: 24 }}>
      <SheetHeader title="Auto-pay activity" onClose={() => safeBack(router)} />

      {entries.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
          <Icon name="spark" size={28} color={t.txtLow} />
          <Txt size={15} weight="semibold">No activity yet</Txt>
          <Low size={13} style={{ textAlign: "center", maxWidth: 280 }}>
            Once Judith spots a transaction that matches one of your bills, it shows up here.
          </Low>
        </View>
      ) : (
        <View style={{ gap: 9, marginTop: 6 }}>
          {entries.map((e) => {
            const undoable = e.kind === "auto-marked" && Date.now() - e.ts < UNDO_WINDOW_MS;
            const confirmable = e.kind === "suggested";
            const ageMin = Math.max(1, Math.floor((Date.now() - e.ts) / 60_000));
            const ageLabel = ageMin < 60
              ? `${ageMin}m ago`
              : ageMin < 1440
                ? `${Math.floor(ageMin / 60)}h ago`
                : `${Math.floor(ageMin / 1440)}d ago`;

            return (
              <View
                key={e.id}
                style={{
                  padding: 13,
                  borderRadius: t.radius.md,
                  borderWidth: 1,
                  borderColor: t.hair,
                  backgroundColor: t.surface2,
                  gap: 9,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      backgroundColor: badgeBg(e.kind, t),
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Icon name={badgeIcon(e.kind)} size={14} color={t.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="semibold">{e.billProvider}</Txt>
                    <Low size={11}>{kindLabel(e.kind)} · {ageLabel}</Low>
                  </View>
                  <Mono size={14} weight="bold">{e.currency}{Math.round(e.amount).toLocaleString()}</Mono>
                </View>
                {(undoable || confirmable) && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {confirmable && (
                      <Pressable
                        onPress={() => handleConfirm(e.id)}
                        disabled={busyId === e.id}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: 10,
                          alignItems: "center",
                          backgroundColor: t.accent,
                          opacity: busyId === e.id ? 0.5 : 1,
                        }}
                      >
                        <Txt size={13} weight="semibold" color={t.onAccent}>Mark paid</Txt>
                      </Pressable>
                    )}
                    {undoable && (
                      <Pressable
                        onPress={() => handleUndo(e.id)}
                        disabled={busyId === e.id}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: 10,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: t.hair,
                          backgroundColor: t.surface3,
                          opacity: busyId === e.id ? 0.5 : 1,
                        }}
                      >
                        <Txt size={13} weight="semibold">Undo</Txt>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          <Pressable
            onPress={handleClear}
            style={{ paddingVertical: 14, alignItems: "center", marginTop: 4 }}
          >
            <Low size={12} style={{ textDecorationLine: "underline" }}>Clear all activity</Low>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function kindLabel(k: ActivityEntry["kind"]): string {
  switch (k) {
    case "auto-marked": return "Auto-marked as paid";
    case "suggested":   return "Suggested";
    case "confirmed":   return "Confirmed";
    case "undone":      return "Undone";
    case "ignored":     return "Dismissed";
  }
}

function badgeIcon(k: ActivityEntry["kind"]): "spark" | "check" | "bell" | "trenddown" {
  switch (k) {
    case "auto-marked": return "check";
    case "suggested":   return "bell";
    case "confirmed":   return "check";
    case "undone":      return "trenddown";
    case "ignored":     return "bell";
  }
}

function badgeBg(k: ActivityEntry["kind"], t: ReturnType<typeof useTheme>): string {
  if (k === "undone" || k === "ignored") return mix(t.semantic.urgent, t.surface2, 0.15);
  return mix(t.accent, t.surface2, 0.18);
}
