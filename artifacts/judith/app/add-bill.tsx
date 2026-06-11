import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Btn, Chip, Low, Mono, ProviderLogo, RoundBtn, SectionLabel, Txt } from "@/components/ui";
import { CAT_ICONS, PROVIDERS, findDuplicate, fmtCurrency, makeManualBill } from "@/constants/data";
import { getCategoryLabel, getVisibleCategories } from "@/constants/categoryLocale";
import { getProviders, getProviderPlaceholder } from "@/constants/providers";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { safeBack } from "@/lib/navigation";
import { haptics } from "@/lib/haptics";

// CATEGORIES is computed per-render from country — see inside the component
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
/** Two-decimal money formatting — used in input fields only (display is whole-number). */
const to2dp = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AddBillScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { bills, saveBill, deleteBill, showToast, country, money, language } = useJudith();
  const CATEGORIES = getVisibleCategories(country.code);

  const existing = id ? (bills.find((b) => b.id === id) ?? null) : null;
  const isEdit = !!existing;

  const [cat, setCat] = useState<string>(existing?.cat ?? "Electricity");
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [amount, setAmount] = useState(existing?.amount ? to2dp(existing.amount) : "");
  const [dueDay, setDueDay] = useState(existing?.dueDate ? String(existing.dueDate) : "");
  const [dueMonth, setDueMonth] = useState(() => {
    if (existing?.frequency !== "annual" || !existing?.dueLabel) return new Date().getMonth() + 1;
    const m = MONTHS_SHORT.findIndex((s) => existing.dueLabel.startsWith(s));
    return m >= 0 ? m + 1 : new Date().getMonth() + 1;
  });
  const [frequency, setFrequency] = useState<"monthly" | "annual">(existing?.frequency ?? "monthly");
  const [kind, setKind] = useState<"Fixed" | "Variable">(existing?.kind ?? "Fixed");
  const [house, setHouse] = useState(existing?.house ?? "");
  const [isBusiness, setIsBusiness] = useState(existing?.isBusiness ?? false);
  const [businessName, setBusinessName] = useState(existing?.businessName ?? "");
  const existingBizNames = useMemo(
    () => [...new Set(bills.filter((b) => b.isBusiness && b.businessName && b.id !== existing?.id).map((b) => b.businessName!))],
    [bills, existing?.id],
  );
  const [remDays, setRemDays] = useState(existing?.reminderDays ?? 3);
  const [remHour, setRemHour] = useState(existing?.reminderHour ?? 9);
  const [statementDay, setStatementDay] = useState(existing?.statementDay ?? 5);
  const [chargedToCard, setChargedToCard] = useState(existing?.chargedToCard ?? false);
  const [parentCardId, setParentCardId] = useState<string | undefined>(existing?.parentCardId);
  const [err, setErr] = useState("");

  const suggestions = useMemo(() => getProviders(country.code, cat), [country.code, cat]);
  const cardChoices = useMemo(
    () => bills.filter((b) => b.cat === "Credit card" && b.id !== existing?.id),
    [bills, existing?.id],
  );
  const canLinkCard = cat !== "Credit card" && cat !== "Personal loan";

  const amt = Number(amount.replace(/[^0-9.]/g, ""));
  const day = Number(dueDay.replace(/[^0-9]/g, ""));
  const validProvider = provider.trim().length > 0;
  const validAmount = Number.isFinite(amt) && amt > 0;
  const validDay = day >= 1 && day <= 31;
  const valid = validProvider && validAmount && validDay;

  const clearErr = () => { if (err) setErr(""); };

  const save = () => {
    if (!valid) {
      haptics.error();
      setErr(
        !validProvider
          ? "Tell me who this bill is from."
          : !validAmount
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
      dueMonth: frequency === "annual" ? dueMonth : undefined,
      frequency,
      kind,
      house: house.trim() || undefined,
      isBusiness: isBusiness || undefined,
      businessName: isBusiness ? businessName.trim() || undefined : undefined,
      reminderDays: remDays,
      reminderHour: remHour,
      statementDay: cat === "Credit card" ? statementDay : undefined,
      chargedToCard: canLinkCard && chargedToCard ? true : undefined,
      parentCardId: canLinkCard && chargedToCard ? parentCardId : undefined,
    });

    if (isEdit && existing) {
      saveBill({
        ...base,
        id: existing.id,
        status: existing.status,
        amountPaid: existing.amountPaid,
        carryOver: existing.carryOver,
        paymentHistory: existing.paymentHistory,
      });
      haptics.success();
      showToast(`Updated: ${base.provider}`);
    } else {
      const dup = findDuplicate(bills, base);
      if (dup) {
        Alert.alert(
          "Possible duplicate",
          `You already have "${dup.provider}" under ${dup.cat}. Add another one?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Add anyway",
              onPress: () => {
                saveBill(base);
                haptics.success();
                showToast(`Added: ${base.provider}`);
                safeBack(router);
              },
            },
          ],
        );
        return;
      }
      saveBill(base);
      haptics.success();
      showToast(`Added: ${base.provider}`);
    }
    safeBack(router);
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
            haptics.success();
            showToast("Bill deleted");
            safeBack(router);
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

  /* Reusable +/- stepper with bounded, disabled-aware buttons. */
  const Stepper = ({
    value,
    onDec,
    onInc,
    canDec,
    canInc,
    unit,
  }: {
    value: number;
    onDec: () => void;
    onInc: () => void;
    canDec: boolean;
    canInc: boolean;
    unit: string;
  }) => {
    const stepBtn = (active: boolean) => ({
      width: 46,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.hair,
      backgroundColor: t.surface2,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      opacity: active ? 1 : 0.35,
    });
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: t.surface1,
          borderWidth: 1,
          borderColor: t.hair,
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <Pressable
          disabled={!canDec}
          onPress={() => { haptics.light(); onDec(); }}
          style={({ pressed }) => [stepBtn(canDec), pressed && canDec && { transform: [{ scale: 0.94 }] }]}
        >
          <Text style={{ fontSize: 24, color: t.txtHi, lineHeight: 28 }}>−</Text>
        </Pressable>
        <View style={{ alignItems: "center", minWidth: 80 }}>
          <Mono size={26} weight="bold">{value}</Mono>
          <Low size={11} style={{ marginTop: 1 }}>{unit}</Low>
        </View>
        <Pressable
          disabled={!canInc}
          onPress={() => { haptics.light(); onInc(); }}
          style={({ pressed }) => [stepBtn(canInc), pressed && canInc && { transform: [{ scale: 0.94 }] }]}
        >
          <Icon name="plus" size={19} color={t.txtHi} />
        </Pressable>
      </View>
    );
  };

  const freqSuffix = frequency === "monthly" ? "/mo" : "/yr";

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: Math.max(insets.top, 44) + 6 }}>
      {/* header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 22,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.hair2,
        }}
      >
        <RoundBtn icon="x" size={34} onPress={() => safeBack(router)} />
        <View style={{ flex: 1 }}>
          <Txt size={21} weight="bold">{isEdit ? "Edit bill" : "Add a bill"}</Txt>
          <Low size={12} style={{ marginTop: 1 }}>
            {isEdit ? "Update the details below" : "A few quick details and you're set"}
          </Low>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* live preview */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 6,
          }}
        >
          <ProviderLogo provider={provider.trim() || undefined} cat={cat} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={16} weight="semibold" numberOfLines={1}>
              {provider.trim() || "New bill"}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
              <Icon name={(CAT_ICONS[cat] ?? "spark") as never} size={12} color={t.txtLow} />
              <Low size={12}>
                {getCategoryLabel(cat, language)}{validDay ? (frequency === "annual" ? ` · ${MONTHS_SHORT[dueMonth - 1]} ${day}` : ` · due the ${day}${ordinal(day)}`) : ""}
              </Low>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {validAmount ? (
              <Mono size={18} weight="bold" color={t.accent}>{money(amt)}</Mono>
            ) : (
              <Mono size={18} weight="bold" color={t.txtLow}>{country.cur}—</Mono>
            )}
            <Low size={11} style={{ marginTop: 1 }}>{freqSuffix}</Low>
          </View>
        </View>

        {/* ───────── the basics ───────── */}
        <SectionLabel>The basics</SectionLabel>

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
              label={getCategoryLabel(c, language)}
              icon={(CAT_ICONS[c] ?? "spark") as never}
              selected={cat === c}
              onPress={() => { haptics.selection(); setCat(c); clearErr(); }}
            />
          ))}
        </ScrollView>

        {/* provider */}
        <View style={{ marginTop: 18 }}>
          <FieldLabel text="Who is it from?" />
          <TextInput
            value={provider}
            onChangeText={(v) => { setProvider(v); clearErr(); }}
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
                  onPress={() => { haptics.selection(); setProvider(s.name); clearErr(); }}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* amount + due day */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
          <View style={{ flex: 1.35 }}>
            <FieldLabel text="Amount" />
            <View
              style={{
                backgroundColor: t.surface1,
                borderWidth: 1,
                borderColor: validAmount ? t.hair : t.hair,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
              }}
            >
              <Mono size={18} color={t.txtMid}>{country.cur}</Mono>
              <TextInput
                value={amount}
                onChangeText={(v) => { setAmount(fmtCurrency(v)); clearErr(); }}
                onBlur={() => {
                  const n = Number(amount.replace(/[^0-9.]/g, ""));
                  if (amount.trim() && Number.isFinite(n) && n > 0) setAmount(fmtCurrency(to2dp(n)));
                }}
                placeholder="0.00"
                placeholderTextColor={t.txtLow}
                keyboardType="decimal-pad"
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  paddingHorizontal: 8,
                  color: t.txtHi,
                  fontSize: 19,
                  fontFamily: t.fonts.monoBold,
                }}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel text={frequency === "annual" ? "Day" : "Due day"} />
            <TextInput
              value={dueDay}
              onChangeText={(v) => { setDueDay(v.replace(/[^0-9]/g, "").slice(0, 2)); clearErr(); }}
              placeholder="1–31"
              placeholderTextColor={t.txtLow}
              keyboardType="number-pad"
              style={{ ...inputStyle, fontSize: 19, fontFamily: t.fonts.monoBold, textAlign: "center" }}
            />
          </View>
        </View>
        {frequency === "annual" && (
          <View style={{ marginTop: 12 }}>
            <FieldLabel text="Month" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 6, flexDirection: "row" }}>
              {MONTHS_SHORT.map((m, i) => (
                <Chip key={m} label={m} selected={dueMonth === i + 1} onPress={() => { haptics.selection(); setDueMonth(i + 1); }} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ───────── schedule ───────── */}
        <SectionLabel>Schedule</SectionLabel>

        <FieldLabel text="How often?" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Monthly" selected={frequency === "monthly"} onPress={() => { haptics.selection(); setFrequency("monthly"); }} />
          <Chip label="Yearly" selected={frequency === "annual"} onPress={() => { haptics.selection(); setFrequency("annual"); }} />
        </View>

        {/* bill type */}
        <View style={{ marginTop: 18 }}>
          <FieldLabel text="Bill type" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Fixed" selected={kind === "Fixed"} onPress={() => { haptics.selection(); setKind("Fixed"); }} />
            <Chip label="Variable" selected={kind === "Variable"} onPress={() => { haptics.selection(); setKind("Variable"); }} />
          </View>
          <Low size={12} style={{ marginTop: 7 }}>
            {kind === "Fixed"
              ? "Same amount every cycle — subscriptions, loans, rent."
              : "Amount changes each cycle — usage-based like electricity or water."}
          </Low>
        </View>

        {/* CC: statement release day */}
        {cat === "Credit card" && (
          <View style={{ marginTop: 18 }}>
            <FieldLabel text="Statement release day" />
            <Stepper
              value={statementDay}
              canDec={statementDay > 1}
              canInc={statementDay < 28}
              onDec={() => setStatementDay((d) => Math.max(1, d - 1))}
              onInc={() => setStatementDay((d) => Math.min(28, d + 1))}
              unit="of the month"
            />
            <Low size={12} style={{ marginTop: 7 }}>
              When does your bank release your monthly statement? Judith will nudge you
              on that day to update this bill&apos;s amount.
            </Low>
          </View>
        )}

        {/* reminder days stepper */}
        <View style={{ marginTop: 18 }}>
          <FieldLabel text="Remind me before due date" />
          <Stepper
            value={remDays}
            canDec={remDays > 1}
            canInc={remDays < 30}
            onDec={() => setRemDays((d) => Math.max(1, d - 1))}
            onInc={() => setRemDays((d) => Math.min(30, d + 1))}
            unit={remDays === 1 ? "day before" : "days before"}
          />
        </View>

        {/* reminder time-of-day — fires in the device's local timezone, so a
            user who picks "Morning" in Manila keeps getting 9 AM reminders
            after travelling. Four presets cover ~95% of real preferences
            without a full time-picker; we can add custom hours later. */}
        <View style={{ marginTop: 14 }}>
          <FieldLabel text="What time?" />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip label="Morning · 9 AM" selected={remHour === 9}  onPress={() => { haptics.selection(); setRemHour(9); }} />
            <Chip label="Noon · 12 PM"   selected={remHour === 12} onPress={() => { haptics.selection(); setRemHour(12); }} />
            <Chip label="Evening · 6 PM" selected={remHour === 18} onPress={() => { haptics.selection(); setRemHour(18); }} />
            <Chip label="Night · 9 PM"   selected={remHour === 21} onPress={() => { haptics.selection(); setRemHour(21); }} />
          </View>
        </View>

        {/* ───────── organize ───────── */}
        <SectionLabel>Organize</SectionLabel>

        <FieldLabel text="Usage" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Personal" selected={!isBusiness} onPress={() => { haptics.selection(); setIsBusiness(false); }} />
          <Chip label="Business" selected={isBusiness} onPress={() => { haptics.selection(); setIsBusiness(true); }} />
        </View>
        <Low size={12} style={{ marginTop: 7 }}>
          {isBusiness
            ? "This is a work or business expense — you can filter it separately in Insights."
            : "This is a personal or household bill."}
        </Low>

        {isBusiness && (
          <View style={{ marginTop: 14 }}>
            <FieldLabel text="Business name" opt />
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Auto Tomato, Freelance Studio"
              placeholderTextColor={t.txtLow}
              style={inputStyle}
              returnKeyType="done"
            />
            {existingBizNames.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {existingBizNames.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    selected={businessName === name}
                    onPress={() => { haptics.selection(); setBusinessName(businessName === name ? "" : name); }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* auto-charged to a credit card */}
        {canLinkCard && (
          <View style={{ marginTop: 18 }}>
            <FieldLabel text="Auto-charged to a card?" opt />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip
                label="No"
                selected={!chargedToCard}
                onPress={() => { haptics.selection(); setChargedToCard(false); setParentCardId(undefined); }}
              />
              <Chip
                label="Yes, via card"
                icon="card"
                selected={chargedToCard}
                onPress={() => { haptics.selection(); setChargedToCard(true); }}
              />
            </View>
            {chargedToCard && (
              <View style={{ marginTop: 10 }}>
                {cardChoices.length > 0 ? (
                  <>
                    <Low size={12} style={{ marginBottom: 8 }}>Which card pays this?</Low>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {cardChoices.map((c) => (
                        <Chip
                          key={c.id}
                          label={c.provider}
                          icon="card"
                          selected={parentCardId === c.id}
                          onPress={() => { haptics.selection(); setParentCardId(c.id); }}
                        />
                      ))}
                    </View>
                  </>
                ) : (
                  <Low size={12}>
                    No credit cards yet — add one and you can link it here later.
                  </Low>
                )}
              </View>
            )}
            <Low size={12} style={{ marginTop: 7 }}>
              {chargedToCard
                ? "Judith won't nudge you to pay this directly — she'll watch the linked card instead."
                : "Turn this on for bills that auto-bill to a credit card."}
            </Low>
          </View>
        )}

        {/* house / property tag */}
        <View style={{ marginTop: 18 }}>
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 18,
              backgroundColor: t.semantic.urgent + "1a",
              borderWidth: 1,
              borderColor: t.semantic.urgent + "55",
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 13,
            }}
          >
            <Icon name="bell" size={14} color={t.semantic.urgent} />
            <Txt size={13} color={t.semantic.urgent}>{err}</Txt>
          </View>
        )}

        {!isEdit && (
          <Low size={12} style={{ marginTop: 18 }}>
            Judith only tracks this — she never moves your money. You&apos;ll get a nudge before it&apos;s due.
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

/** Ordinal suffix for a day-of-month (1st, 2nd, 3rd, 4th…). */
function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return "st";
  if (rem10 === 2 && rem100 !== 12) return "nd";
  if (rem10 === 3 && rem100 !== 13) return "rd";
  return "th";
}
