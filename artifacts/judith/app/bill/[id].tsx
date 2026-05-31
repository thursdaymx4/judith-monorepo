import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Paywall } from "@/components/Paywall";
import { Button, SectionLabel } from "@/components/ui";
import { PAYWALL_ENABLED } from "@/constants/config";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import {
  CATEGORY_META,
  createBill,
  deleteBill,
  listBills,
  markPaid,
  markUnpaid,
  snoozeBill,
  unsnoozeBill,
  updateBill,
  type AmountType,
  type Bill,
  type BillCategory,
  type Cadence,
} from "@/lib/bills";

const CATEGORIES = Object.keys(CATEGORY_META) as BillCategory[];
const REMINDER_OPTIONS = [7, 3, 1, 0];

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        chip.base,
        {
          backgroundColor: active ? color : colors.card,
          borderColor: active ? color : colors.border,
        },
      ]}
    >
      <Text style={[chip.text, { color: active ? "#fff" : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export default function BillFormScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasAccess } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const { data: bills = [] } = useQuery({ queryKey: ["bills"], queryFn: listBills });
  const existing: Bill | undefined = isNew ? undefined : bills.find((b) => b.id === id);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<BillCategory>("electricity");
  const [provider, setProvider] = useState("");
  const [amountType, setAmountType] = useState<AmountType>("fixed");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [dueDay, setDueDay] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [offsets, setOffsets] = useState<number[]>([3, 1]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setCategory(existing.category);
    setProvider(existing.provider ?? "");
    setAmountType(existing.amount_type);
    setAmount(existing.amount != null ? String(existing.amount) : "");
    setCadence(existing.cadence);
    setDueDay(existing.due_day != null ? String(existing.due_day) : "");
    setDueDate(existing.due_date ?? "");
    setOffsets(existing.reminder_offsets ?? [3, 1]);
  }, [existing]);

  const toggleOffset = (value: number) => {
    setOffsets((prev) =>
      prev.includes(value) ? prev.filter((o) => o !== value) : [...prev, value].sort((a, b) => b - a),
    );
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bills"] });

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Pangalan", "Maglagay ng pangalan ng bill.");
      return;
    }
    if (cadence === "monthly" && !dueDay) {
      Alert.alert("Due day", "Maglagay ng araw ng buwan (1-31).");
      return;
    }
    if (cadence === "one_time" && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert("Due date", "Gamitin ang format na YYYY-MM-DD.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        provider: provider.trim() || null,
        amount_type: amountType,
        amount: amount ? Number(amount) : null,
        due_day: cadence === "monthly" ? Math.min(Number(dueDay) || 1, 31) : null,
        due_date: cadence === "one_time" ? dueDate : null,
        cadence,
        reminder_offsets: offsets,
        snoozed_until: null,
      };
      if (isNew) await createBill(payload);
      else if (existing) await updateBill(existing.id, payload);
      invalidate();
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Hindi na-save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert("Burahin", `Burahin ang ${existing.name}?`, [
      { text: "Kanselahin", style: "cancel" },
      {
        text: "Burahin",
        style: "destructive",
        onPress: async () => {
          await deleteBill(existing.id);
          invalidate();
          router.back();
        },
      },
    ]);
  };

  const togglePaid = async () => {
    if (!existing) return;
    if (existing.status === "paid") await markUnpaid(existing.id);
    else await markPaid(existing.id);
    invalidate();
    router.back();
  };

  const toggleSnooze = async () => {
    if (!existing) return;
    if (existing.status === "snoozed") await unsnoozeBill(existing.id);
    else await snoozeBill(existing.id, 3);
    invalidate();
    router.back();
  };

  if (PAYWALL_ENABLED && !hasAccess) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Judith Premium" }} />
        <Paywall />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Stack.Screen options={{ title: isNew ? "Bagong Bill" : "I-edit ang Bill" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <SectionLabel>Pangalan</SectionLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="hal. Meralco"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>

          <View style={styles.field}>
            <SectionLabel>Kategorya</SectionLabel>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={CATEGORY_META[c].label}
                  active={category === c}
                  color={colors.primary}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <SectionLabel>Provider (opsyonal)</SectionLabel>
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder="hal. Meralco, PLDT"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>

          <View style={styles.field}>
            <SectionLabel>Uri ng halaga</SectionLabel>
            <View style={styles.chips}>
              <Chip label="Fixed" active={amountType === "fixed"} color={colors.primary} onPress={() => setAmountType("fixed")} />
              <Chip label="Variable" active={amountType === "variable"} color={colors.primary} onPress={() => setAmountType("variable")} />
            </View>
          </View>

          <View style={styles.field}>
            <SectionLabel>
              {amountType === "variable" ? "Huling halaga (opsyonal)" : "Halaga (₱)"}
            </SectionLabel>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>

          <View style={styles.field}>
            <SectionLabel>Dalas</SectionLabel>
            <View style={styles.chips}>
              <Chip label="Buwanan" active={cadence === "monthly"} color={colors.primary} onPress={() => setCadence("monthly")} />
              <Chip label="Isang beses" active={cadence === "one_time"} color={colors.primary} onPress={() => setCadence("one_time")} />
            </View>
          </View>

          {cadence === "monthly" ? (
            <View style={styles.field}>
              <SectionLabel>Araw ng due (1-31)</SectionLabel>
              <TextInput
                value={dueDay}
                onChangeText={setDueDay}
                placeholder="hal. 15"
                keyboardType="number-pad"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>
          ) : (
            <View style={styles.field}>
              <SectionLabel>Petsa ng due (YYYY-MM-DD)</SectionLabel>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="2026-06-15"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>
          )}

          <View style={styles.field}>
            <SectionLabel>Paalala (araw bago mag-due)</SectionLabel>
            <View style={styles.chips}>
              {REMINDER_OPTIONS.map((o) => (
                <Chip
                  key={o}
                  label={o === 0 ? "Sa araw mismo" : `${o} araw`}
                  active={offsets.includes(o)}
                  color={colors.accent}
                  onPress={() => toggleOffset(o)}
                />
              ))}
            </View>
          </View>

          <Button label={isNew ? "I-save ang bill" : "I-update"} onPress={save} loading={busy} />

          {existing ? (
            <>
              <Button
                label={existing.status === "paid" ? "Markahang hindi bayad" : "Markahang bayad na"}
                variant="secondary"
                icon="check"
                onPress={() => void togglePaid()}
              />
              {existing.status !== "paid" ? (
                <Button
                  label={existing.status === "snoozed" ? "Itigil ang snooze" : "I-snooze ng 3 araw"}
                  variant="secondary"
                  icon={existing.status === "snoozed" ? "bell" : "clock"}
                  onPress={() => void toggleSnooze()}
                />
              ) : null}
              <Button label="Burahin ang bill" variant="destructive" icon="trash-2" onPress={remove} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 18 },
  field: { gap: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});

const chip = StyleSheet.create({
  base: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 14, fontWeight: "600" },
});
