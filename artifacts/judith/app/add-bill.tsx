import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Btn, Chip, Low, Txt } from "@/components/ui";
import { CAT_ICONS, PROVIDERS, makeManualBill } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

const CATEGORIES = Object.keys(PROVIDERS);

export default function AddBillScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saveBill, showToast } = useJudith();

  const [cat, setCat] = useState<string>("Electricity");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "annual">("monthly");
  const [err, setErr] = useState("");

  const suggestions = useMemo(() => PROVIDERS[cat] ?? [], [cat]);

  const amt = Number(amount.replace(/[^0-9.]/g, ""));
  const day = Number(dueDay.replace(/[^0-9]/g, ""));
  const valid =
    provider.trim().length > 0 && Number.isFinite(amt) && amt > 0 && day >= 1 && day <= 31;

  const save = () => {
    if (!valid) {
      setErr(
        provider.trim().length === 0
          ? "Tell me who this bill is from."
          : !(amt > 0)
            ? "Enter the amount."
            : "Enter a due day between 1 and 31.",
      );
      return;
    }
    const bill = makeManualBill({
      provider: provider.trim(),
      cat,
      amount: amt,
      dueDay: day,
      frequency,
    });
    saveBill(bill);
    showToast(`Added: ${bill.provider}`);
    router.back();
  };

  const inputStyle = {
    backgroundColor: t.surface1,
    borderWidth: 1,
    borderColor: t.hair,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: t.txtHi,
    fontSize: 15,
    fontFamily: t.fonts.regular,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: Math.max(insets.top, 44) + 6 }}>
      {/* header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 22,
          marginBottom: 6,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hair,
          }}
        >
          <Icon name="x" size={15} color={t.txtMid} />
        </Pressable>
        <Txt size={22} weight="semibold">
          Add a bill
        </Txt>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* category */}
        <Txt size={13} weight="semibold" color={t.txtMid} style={{ marginBottom: 9 }}>
          Category
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 22 }}
          style={{ marginHorizontal: -22, paddingHorizontal: 22 }}
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              icon={(CAT_ICONS[c] ?? "spark") as never}
              selected={cat === c}
              onPress={() => setCat(c)}
            />
          ))}
        </ScrollView>

        {/* provider */}
        <Txt size={13} weight="semibold" color={t.txtMid} style={{ marginTop: 20, marginBottom: 9 }}>
          Who is it from?
        </Txt>
        <TextInput
          value={provider}
          onChangeText={(v) => {
            setProvider(v);
            if (err) setErr("");
          }}
          placeholder="e.g. Meralco"
          placeholderTextColor={t.txtLow}
          style={inputStyle}
        />
        {suggestions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 22, paddingTop: 10 }}
            style={{ marginHorizontal: -22, paddingHorizontal: 22 }}
          >
            {suggestions.map((s) => (
              <Chip
                key={s.name}
                label={s.name}
                selected={provider.trim() === s.name}
                onPress={() => {
                  setProvider(s.name);
                  if (err) setErr("");
                }}
              />
            ))}
          </ScrollView>
        )}

        {/* amount + due day */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <View style={{ flex: 1.3 }}>
            <Txt size={13} weight="semibold" color={t.txtMid} style={{ marginBottom: 9 }}>
              Amount
            </Txt>
            <TextInput
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                if (err) setErr("");
              }}
              placeholder="0"
              placeholderTextColor={t.txtLow}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={13} weight="semibold" color={t.txtMid} style={{ marginBottom: 9 }}>
              Due day
            </Txt>
            <TextInput
              value={dueDay}
              onChangeText={(v) => {
                setDueDay(v.replace(/[^0-9]/g, "").slice(0, 2));
                if (err) setErr("");
              }}
              placeholder="1–31"
              placeholderTextColor={t.txtLow}
              keyboardType="number-pad"
              style={inputStyle}
            />
          </View>
        </View>

        {/* frequency */}
        <Txt size={13} weight="semibold" color={t.txtMid} style={{ marginTop: 20, marginBottom: 9 }}>
          How often?
        </Txt>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Monthly" selected={frequency === "monthly"} onPress={() => setFrequency("monthly")} />
          <Chip label="Yearly" selected={frequency === "annual"} onPress={() => setFrequency("annual")} />
        </View>

        {!!err && (
          <Txt size={13} color={t.semantic.urgent} style={{ marginTop: 18 }}>
            {err}
          </Txt>
        )}

        <Low size={12} style={{ marginTop: 18 }}>
          Judith only tracks this — she never moves your money. You'll get a nudge before it's due.
        </Low>
      </ScrollView>

      {/* save bar */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 10,
          paddingBottom: insets.bottom + 14,
          borderTopWidth: 1,
          borderTopColor: t.hair,
          backgroundColor: t.surface1,
        }}
      >
        <Btn label="Add bill" icon="plus" onPress={save} style={{ opacity: valid ? 1 : 0.5 }} />
      </View>
    </View>
  );
}
