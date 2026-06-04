import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Btn, Chip, Low, Mono, Txt } from "@/components/ui";
import { CAT_ICONS, PROVIDERS, makeManualBill } from "@/constants/data";
import { getProviders, getProviderPlaceholder } from "@/constants/providers";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

const CATEGORIES = Object.keys(PROVIDERS);

export default function AddBillScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { bills, saveBill, deleteBill, showToast, country } = useJudith();

  const existing = id ? (bills.find((b) => b.id === id) ?? null) : null;
  const isEdit = !!existing;

  const [cat, setCat] = useState<string>(existing?.cat ?? "Electricity");
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [amount, setAmount] = useState(existing?.amount ? String(existing.amount) : "");
  const [dueDay, setDueDay] = useState(existing?.dueDate ? String(existing.dueDate) : "");
  const [frequency, setFrequency] = useState<"monthly" | "annual">(existing?.frequency ?? "monthly");
  const [kind, setKind] = useState<"Fixed" | "Variable">(existing?.kind ?? "Fixed");
  const [house, setHouse] = useState(existing?.house ?? "");
  const [remDays, setRemDays] = useState(existing?.reminderDays ?? 3);
  const [err, setErr] = useState("");

  const suggestions = useMemo(() => getProviders(country.code, cat), [country.code, cat]);

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
    const base = makeManualBill({
      provider: provider.trim(),
      cat,
      amount: amt,
      dueDay: day,
      frequency,
      kind,
      house: house.trim() || undefined,
      reminderDays: remDays,
    });

    if (isEdit && existing) {
      saveBill({
        ...base,
        id: existing.id,
        status: existing.status,
        amountPaid: existing.amountPaid,
        carryOver: existing.carryOver,
      });
      showToast(`Updated: ${base.provider}`);
    } else {
      saveBill(base);
      showToast(`Added: ${base.provider}`);
    }
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete this bill?",
      `${existing?.provider ?? "This bill"} will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteBill(existing!.id);
            showToast("Bill deleted");
            router.back();
          },
        },
      ],
    );
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

  const FieldLabel = ({ text, opt }: { text: string; opt?: boolean }) => (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 9 }}>
      <Txt size={13} weight="semibold" color={t.txtMid}>{text}</Txt>
      {opt && <Low size={11}>optional</Low>}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: Math.max(insets.top, 44) + 6 }}>
      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 22, marginBottom: 6 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 32, height: 32, borderRadius: 16,
            alignItems: "center", justifyContent: "center",
            backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hair,
          }}
        >
          <Icon name="x" size={15} color={t.txtMid} />
        </Pressable>
        <Txt size={22} weight="semibold">{isEdit ? "Edit bill" : "Add a bill"}</Txt>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* category */}
        <FieldLabel text="Category" />
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
              onPress={() => { setCat(c); if (err) setErr(""); }}
            />
          ))}
        </ScrollView>

        {/* provider */}
        <View style={{ marginTop: 20 }}>
          <FieldLabel text="Who is it from?" />
          <TextInput
            value={provider}
            onChangeText={(v) => { setProvider(v); if (err) setErr(""); }}
            placeholder={getProviderPlaceholder(country.code, cat)}
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
                  onPress={() => { setProvider(s.name); if (err) setErr(""); }}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* amount + due day */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <View style={{ flex: 1.3 }}>
            <FieldLabel text="Amount" />
            <View
              style={{
                ...inputStyle,
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 0,
                paddingHorizontal: 0,
              }}
            >
              <View style={{ paddingLeft: 14, justifyContent: "center" }}>
                <Mono size={15} color={t.txtMid}>₱</Mono>
              </View>
              <TextInput
                value={amount}
                onChangeText={(v) => { setAmount(v); if (err) setErr(""); }}
                placeholder="0"
                placeholderTextColor={t.txtLow}
                keyboardType="numeric"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  color: t.txtHi,
                  fontSize: 15,
                  fontFamily: t.fonts.regular,
                }}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel text="Due day" />
            <TextInput
              value={dueDay}
              onChangeText={(v) => { setDueDay(v.replace(/[^0-9]/g, "").slice(0, 2)); if (err) setErr(""); }}
              placeholder="1–31"
              placeholderTextColor={t.txtLow}
              keyboardType="number-pad"
              style={inputStyle}
            />
          </View>
        </View>

        {/* frequency */}
        <View style={{ marginTop: 20 }}>
          <FieldLabel text="How often?" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Monthly" selected={frequency === "monthly"} onPress={() => setFrequency("monthly")} />
            <Chip label="Yearly" selected={frequency === "annual"} onPress={() => setFrequency("annual")} />
          </View>
        </View>

        {/* bill type */}
        <View style={{ marginTop: 20 }}>
          <FieldLabel text="Bill type" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Fixed" selected={kind === "Fixed"} onPress={() => setKind("Fixed")} />
            <Chip label="Variable" selected={kind === "Variable"} onPress={() => setKind("Variable")} />
          </View>
          <Low size={12} style={{ marginTop: 7 }}>
            {kind === "Fixed"
              ? "Same amount every cycle — subscriptions, loans, rent."
              : "Amount changes each cycle — usage-based like electricity or water."}
          </Low>
        </View>

        {/* reminder days stepper */}
        <View style={{ marginTop: 20 }}>
          <FieldLabel text="Remind me before due date" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Pressable
              onPress={() => setRemDays((d) => Math.max(1, d - 1))}
              style={{
                width: 42, height: 42, borderRadius: 13, borderWidth: 1,
                borderColor: t.hair, backgroundColor: t.surface2,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 22, color: t.txtMid, lineHeight: 26 }}>−</Text>
            </Pressable>
            <View style={{ alignItems: "center", minWidth: 64 }}>
              <Mono size={24} weight="bold">{remDays}</Mono>
              <Low size={11} style={{ marginTop: 1 }}>{remDays === 1 ? "day before" : "days before"}</Low>
            </View>
            <Pressable
              onPress={() => setRemDays((d) => Math.min(30, d + 1))}
              style={{
                width: 42, height: 42, borderRadius: 13, borderWidth: 1,
                borderColor: t.hair, backgroundColor: t.surface2,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="plus" size={18} color={t.txtMid} />
            </Pressable>
          </View>
        </View>

        {/* house / property tag */}
        <View style={{ marginTop: 20 }}>
          <FieldLabel text="Property / home tag" opt />
          <TextInput
            value={house}
            onChangeText={setHouse}
            placeholder="e.g. Main house, Condo, Province"
            placeholderTextColor={t.txtLow}
            style={inputStyle}
          />
          <Low size={12} style={{ marginTop: 7 }}>
            Tag this bill to a property if you track more than one home.
          </Low>
        </View>

        {!!err && (
          <Txt size={13} color={t.semantic.urgent} style={{ marginTop: 18 }}>
            {err}
          </Txt>
        )}

        {!isEdit && (
          <Low size={12} style={{ marginTop: 18 }}>
            Judith only tracks this — she never moves your money. You'll get a nudge before it's due.
          </Low>
        )}
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
          gap: 10,
        }}
      >
        <Btn
          label={isEdit ? "Save changes" : "Add bill"}
          icon={isEdit ? "check" : "plus"}
          onPress={save}
          style={{ opacity: valid ? 1 : 0.5 }}
        />
        {isEdit && (
          <Btn label="Delete this bill" variant="ghost" onPress={confirmDelete} />
        )}
      </View>
    </View>
  );
}
