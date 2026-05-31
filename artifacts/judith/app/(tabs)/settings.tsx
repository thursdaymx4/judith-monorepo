import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { JudithOrb } from "@/components/JudithOrb";
import { Button, SectionLabel } from "@/components/ui";
import { PRICE_LABEL } from "@/constants/config";
import { PERSONAS } from "@/constants/personas";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { listBills } from "@/lib/bills";
import { playBase64Mp3 } from "@/lib/audio";
import { syncReminders } from "@/lib/notifications";
import { fetchSample } from "@/lib/proxy";

export default function SettingsScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();
  const { profile, setPersona, setRemindersEnabled, hasAccess } = useSettings();
  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: listBills,
    enabled: !!user,
  });

  const [sampling, setSampling] = useState<string | null>(null);

  const playSample = async (personaId: string) => {
    setSampling(personaId);
    try {
      const res = await fetchSample(personaId as never);
      await playBase64Mp3(res.audioBase64);
    } catch {
      // ignore sample failures silently
    } finally {
      setSampling(null);
    }
  };

  const toggleReminders = async (enabled: boolean) => {
    await setRemindersEnabled(enabled);
    await syncReminders(bills, enabled);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.foreground }]}>Mga Setting</Text>

        <View style={styles.section}>
          <SectionLabel>Persona ni Judith</SectionLabel>
          <View style={styles.list}>
            {PERSONAS.map((p) => {
              const active = profile.persona === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => void setPersona(p.id)}
                  style={[
                    styles.personaRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: active ? p.color : colors.border,
                      borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View style={[styles.personaIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name={p.icon} size={20} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.personaName, { color: colors.foreground }]}>{p.name}</Text>
                    <Text style={[styles.personaDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {p.description}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => void playSample(p.id)}
                    style={[styles.playBtn, { backgroundColor: colors.secondary }]}
                  >
                    <Feather
                      name={sampling === p.id ? "loader" : "play"}
                      size={16}
                      color={colors.foreground}
                    />
                  </Pressable>
                  {active ? <Feather name="check-circle" size={20} color={p.color} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Mga paalala</SectionLabel>
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>Mga reminder</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Paalala bago mag-due ang bill
              </Text>
            </View>
            <Switch
              value={profile.reminders_enabled}
              onValueChange={(v) => void toggleReminders(v)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Subscription</SectionLabel>
          <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <JudithOrb size={48} state="idle" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                {hasAccess ? "Premium aktibo" : "Judith Premium"}
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {hasAccess ? "Salamat sa pag-subscribe!" : `${PRICE_LABEL} — buong access`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="mail" size={18} color={colors.mutedForeground} />
            <Text style={[styles.rowSub, { color: colors.mutedForeground, flex: 1 }]} numberOfLines={1}>
              {user?.email ?? "—"}
            </Text>
          </View>
          <Button label="Mag-logout" variant="ghost" icon="log-out" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 120, gap: 24 },
  title: { fontSize: 28, fontWeight: "800" },
  section: { gap: 12 },
  list: { gap: 10 },
  personaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },
  personaIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  personaName: { fontSize: 16, fontWeight: "700" },
  personaDesc: { fontSize: 13, marginTop: 1 },
  playBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  rowSub: { fontSize: 13, marginTop: 1 },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
