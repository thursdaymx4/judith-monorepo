import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { JudithOrb } from "@/components/JudithOrb";
import { Button } from "@/components/ui";
import { PERSONAS, type PersonaId } from "@/constants/personas";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { playBase64Mp3 } from "@/lib/audio";
import { fetchSample } from "@/lib/proxy";

type Step = "persona" | "first_bill";

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, setPersona, markOnboarded } = useSettings();

  const [step, setStep] = useState<Step>("persona");
  const [selected, setSelected] = useState<PersonaId>(profile.persona);
  const [sampling, setSampling] = useState<PersonaId | null>(null);
  const [finishing, setFinishing] = useState(false);

  const pickPersona = async (id: PersonaId) => {
    setSelected(id);
    await setPersona(id);
    setSampling(id);
    try {
      const res = await fetchSample(id);
      await playBase64Mp3(res.audioBase64);
    } catch {
      // sample playback is best-effort during onboarding
    } finally {
      setSampling((cur) => (cur === id ? null : cur));
    }
  };

  const finish = async (addBill: boolean) => {
    setFinishing(true);
    try {
      await markOnboarded();
      if (addBill) router.push("/bill/new");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === "persona" ? (
          <>
            <View style={styles.hero}>
              <JudithOrb size={96} state="speaking" />
              <Text style={[styles.title, { color: colors.foreground }]}>
                Piliin si Judith
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Pindutin ang persona para marinig kung paano siya magsasalita.
              </Text>
            </View>

            <View style={styles.list}>
              {PERSONAS.map((p) => {
                const active = selected === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => void pickPersona(p.id)}
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
                      <Text style={[styles.personaName, { color: colors.foreground }]}>
                        {p.name}
                      </Text>
                      <Text
                        style={[styles.personaDesc, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {p.description}
                      </Text>
                    </View>
                    <Feather
                      name={sampling === p.id ? "loader" : active ? "check-circle" : "play"}
                      size={18}
                      color={active ? p.color : colors.mutedForeground}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Button label="Magpatuloy" onPress={() => setStep("first_bill")} />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <JudithOrb size={96} state="idle" />
              <Text style={[styles.title, { color: colors.foreground }]}>
                Idagdag ang unang bill
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Ilagay ang isang bayarin gaya ng Meralco o internet. Paaalalahanan ka
                ni Judith bago pa ito mag-due.
              </Text>
            </View>

            <View style={styles.firstBillSpacer} />

            <Button
              label="Magdagdag ng bill"
              icon="plus"
              loading={finishing}
              onPress={() => void finish(true)}
            />
            <Button
              label="Laktawan muna"
              variant="ghost"
              disabled={finishing}
              onPress={() => void finish(false)}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 20, justifyContent: "center" },
  hero: { alignItems: "center", gap: 8 },
  title: { fontSize: 26, fontWeight: "800", marginTop: 8, textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, maxWidth: 300 },
  list: { gap: 10 },
  personaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  personaIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  personaName: { fontSize: 16, fontWeight: "700" },
  personaDesc: { fontSize: 13, marginTop: 1 },
  firstBillSpacer: { height: 8 },
});
