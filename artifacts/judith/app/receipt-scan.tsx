/**
 * Receipt scan screen.
 *
 * Self-contained: the user opens this screen and chooses to take a photo or
 * upload one from their library. The image runs through the on-device Vision
 * pipeline first (judith-receipt-vision); only low-confidence results get
 * forwarded to the Claude vision fallback. Match against the user's bills
 * decides whether to offer mark-paid / partial-payment / update-amount /
 * add-as-new — the user always gets the final say.
 */
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { Btn, Low, Mono, ProviderLogo, RoundBtn, SectionLabel, Txt } from "@/components/ui";
import { makeManualBill, currentCycleDue, type Bill } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { safeBack } from "@/lib/navigation";
import { scanReceipt, type ScanSource } from "@/lib/receiptScan";
import { matchReceiptToBill, type ReceiptIntent } from "@/lib/matchReceiptToBill";

type ScreenState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "result"; provider: string; amount: string; date: string; source: ScanSource }
  | { kind: "error"; message: string };

const todayIso = (): string => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const intentTitle = (intent: ReceiptIntent, bill?: Bill): string => {
  switch (intent) {
    case "mark_paid":
      return bill ? `Mark ${bill.provider} paid?` : "Mark this bill paid?";
    case "partial_payment":
      return bill ? `Log a partial payment on ${bill.provider}?` : "Log a partial payment?";
    case "update_amount":
      return bill ? `Update ${bill.provider}'s amount?` : "Update the bill amount?";
    case "create_new":
      return "Add as a new bill?";
  }
};

const intentBlurb = (intent: ReceiptIntent, scanAmount: number, money: (n: number) => string): string => {
  switch (intent) {
    case "mark_paid":
      return `Judith will mark it paid for ${money(scanAmount)}.`;
    case "partial_payment":
      return `Judith will log a ${money(scanAmount)} payment toward the outstanding balance.`;
    case "update_amount":
      return `Judith will update the stored amount to ${money(scanAmount)} so reminders match the new statement.`;
    case "create_new":
      return `No existing bill matched. We can add this as a one-time bill instead.`;
  }
};

export default function ReceiptScanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    bills,
    markPaid,
    payPartial,
    updateBillAmount,
    saveBill,
    showToast,
    money,
  } = useJudith();

  const [state, setState] = useState<ScreenState>({ kind: "idle" });

  const match = useMemo(() => {
    if (state.kind !== "result") return null;
    const amount = Number(state.amount);
    return matchReceiptToBill(
      {
        provider: state.provider || null,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        date: state.date || null,
      },
      bills,
    );
  }, [state, bills]);

  const runScan = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      setState({ kind: "error", message: "Couldn't read that photo. Try again." });
      return;
    }
    setState({ kind: "scanning" });
    try {
      const scan = await scanReceipt(asset.base64, asset.mimeType || "image/jpeg");
      setState({
        kind: "result",
        provider: scan.provider ?? "",
        amount: scan.amount != null ? String(scan.amount) : "",
        date: scan.date ?? todayIso(),
        source: scan.source,
      });
    } catch (err) {
      setState({
        kind: "error",
        message: `Judith couldn't read that receipt: ${String((err as Error)?.message ?? err)}`,
      });
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setState({
        kind: "error",
        message: "Camera access is needed to take a photo. Try uploading from your library instead.",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await runScan(result.assets[0]);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setState({
        kind: "error",
        message: "Photo library access is needed. Try taking a photo instead.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await runScan(result.assets[0]);
  };

  const openPicker = () => {
    Alert.alert("Scan a Receipt", "Where's the receipt?", [
      { text: "Take Photo", onPress: () => void pickFromCamera() },
      { text: "Upload from Library", onPress: () => void pickFromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const confirm = () => {
    if (state.kind !== "result" || !match) return;
    const amount = Number(state.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount before confirming");
      return;
    }

    switch (match.intent) {
      case "mark_paid":
        if (match.bill) {
          markPaid(match.bill.id);
          showToast(`${match.bill.provider} marked as paid`);
        }
        break;
      case "partial_payment":
        if (match.bill) {
          payPartial(match.bill.id, amount);
          showToast(`Logged ${money(amount)} on ${match.bill.provider}`);
        }
        break;
      case "update_amount":
        if (match.bill) {
          updateBillAmount(match.bill.id, amount);
          showToast(`${match.bill.provider} updated to ${money(amount)}`);
        }
        break;
      case "create_new": {
        const bill = makeManualBill({
          provider: state.provider.trim() || "Receipt",
          cat: "Other",
          amount,
          dueDay: new Date().getDate(),
          kind: "Fixed",
          frequency: "once",
        });
        saveBill(bill);
        // Optimistically mark the just-created bill paid since the user is
        // literally holding the receipt — match the existing "log payment"
        // mental model rather than leaving a phantom unpaid bill behind.
        markPaid(bill.id);
        showToast(`Added & marked paid: ${bill.provider}`);
        break;
      }
    }

    safeBack(router);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.kind === "idle") {
    return (
      <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top + 8 }}>
        <Header onClose={() => safeBack(router)} />
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: t.surface1,
                borderWidth: 1,
                borderColor: t.hair,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="receipt" size={32} color={t.accent} />
            </View>
            <Txt size={20} weight="bold" color={t.txtHi}>
              Scan a receipt
            </Txt>
            <Txt size={14} color={t.txtMid} style={{ textAlign: "center", maxWidth: 280 }}>
              Snap the receipt or upload one — Judith reads it on-device and matches it to a bill.
            </Txt>
          </View>

          <Btn label="Take Photo" icon="camera" onPress={pickFromCamera} />
          <Btn label="Upload from Library" icon="receipt" variant="soft" onPress={pickFromLibrary} />

          <Low size={12} style={{ textAlign: "center", marginTop: 12 }}>
            Photos stay on your phone unless we can&apos;t read them — then a one-time read goes to Judith&apos;s server (never stored).
          </Low>
        </ScrollView>
      </View>
    );
  }

  if (state.kind === "scanning") {
    return (
      <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top + 8 }}>
        <Header onClose={() => safeBack(router)} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={t.accent} size="large" />
          <Txt size={14} color={t.txtMid}>Reading the receipt…</Txt>
        </View>
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top + 8 }}>
        <Header onClose={() => safeBack(router)} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          <Icon name="x" size={36} color={t.txtMid} />
          <Txt size={15} color={t.txtMid} style={{ textAlign: "center" }}>
            {state.message}
          </Txt>
          <Btn label="Try Again" onPress={openPicker} style={{ marginTop: 12 }} />
        </View>
      </View>
    );
  }

  // state.kind === "result"
  const scanAmount = Number(state.amount);
  const matchedBill = match?.bill;
  const intent = match?.intent ?? "create_new";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <Header onClose={() => safeBack(router)} />
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: 4 }}>
            <Icon name="receipt" size={26} color={t.accent} />
            <Txt size={18} weight="bold" color={t.txtHi}>
              {intentTitle(intent, matchedBill)}
            </Txt>
            {Number.isFinite(scanAmount) && scanAmount > 0 ? (
              <Txt size={13} color={t.txtMid} style={{ textAlign: "center", paddingHorizontal: 12 }}>
                {intentBlurb(intent, scanAmount, money)}
              </Txt>
            ) : null}
          </View>

          {matchedBill ? <BillCard bill={matchedBill} money={money} /> : null}

          <View style={{ gap: 12 }}>
            <SectionLabel>From the receipt</SectionLabel>

            <View style={{ gap: 6 }}>
              <Low size={11}>Merchant</Low>
              <TextInput
                value={state.provider}
                onChangeText={(provider) =>
                  setState((s) => (s.kind === "result" ? { ...s, provider } : s))
                }
                placeholder="Who issued the receipt?"
                placeholderTextColor={t.txtLow}
                style={{
                  fontFamily: t.fonts.medium,
                  fontSize: 16,
                  color: t.txtHi,
                  backgroundColor: t.surface1,
                  borderWidth: 1,
                  borderColor: t.hair,
                  borderRadius: t.radius.md,
                  padding: 14,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Low size={11}>Amount</Low>
              <TextInput
                value={state.amount}
                onChangeText={(amount) =>
                  setState((s) => (s.kind === "result" ? { ...s, amount } : s))
                }
                placeholder="0"
                placeholderTextColor={t.txtLow}
                keyboardType="decimal-pad"
                style={{
                  fontFamily: t.fonts.bold,
                  fontSize: 20,
                  color: t.txtHi,
                  backgroundColor: t.surface1,
                  borderWidth: 1,
                  borderColor: t.hair,
                  borderRadius: t.radius.md,
                  padding: 14,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Low size={11}>Date (YYYY-MM-DD)</Low>
              <TextInput
                value={state.date}
                onChangeText={(date) =>
                  setState((s) => (s.kind === "result" ? { ...s, date } : s))
                }
                placeholder={todayIso()}
                placeholderTextColor={t.txtLow}
                autoCapitalize="none"
                style={{
                  fontFamily: t.fonts.medium,
                  fontSize: 15,
                  color: t.txtHi,
                  backgroundColor: t.surface1,
                  borderWidth: 1,
                  borderColor: t.hair,
                  borderRadius: t.radius.md,
                  padding: 14,
                }}
              />
            </View>

            <Low size={11} style={{ marginTop: 2 }}>
              Read {state.source === "on-device" ? "on your iPhone" : "with Judith's vision (this one needed extra help)"}.
            </Low>
          </View>

          <View style={{ gap: 10, marginTop: 8 }}>
            <Btn label="Confirm" icon="check" onPress={confirm} />
            <Btn label="Skip" variant="ghost" onPress={() => safeBack(router)} />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Header({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 8,
      }}
    >
      <RoundBtn icon="x" onPress={onClose} />
      <Text style={{ fontFamily: t.fonts.semibold, color: t.txtHi, fontSize: 16 }}>
        Receipt
      </Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

function BillCard({ bill, money }: { bill: Bill; money: (n: number) => string }) {
  const t = useTheme();
  const cycle = currentCycleDue(bill);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        backgroundColor: t.surface1,
        borderWidth: 1,
        borderColor: t.hair,
        borderRadius: t.radius.md,
      }}
    >
      <ProviderLogo provider={bill.provider} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15} weight="semibold" color={t.txtHi}>
          {bill.provider}
        </Txt>
        <Low size={12}>
          {cycle.dueLabel} · {bill.cat}
        </Low>
      </View>
      <Mono size={15} color={t.txtHi}>
        {money(bill.amount)}
      </Mono>
    </View>
  );
}
