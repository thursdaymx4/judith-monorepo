import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

import { Icon } from "@/components/Icon";
import { JudithAvatar } from "@/components/JudithAvatar";
import { Btn, Card, Low, Mono, ProviderLogo, Screen, SheetHeader, Txt } from "@/components/ui";
import { dueClass, isPartialBill, partialPct, totalOwed } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";
import { haptics } from "@/lib/haptics";

export default function BillDetailModal() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bills, money, persona, togglePaid, payPartial, showToast } = useJudith();
  const [showInput, setShowInput] = useState(false);
  const [input, setInput] = useState("");

  const bill = bills.find((b) => b.id === id);

  if (!bill) {
    return (
      <Screen contentStyle={{ paddingTop: 14 }}>
        <SheetHeader title="Bill" onClose={() => router.back()} />
        <View style={{ height: 20 }} />
        <Low>Bill not found.</Low>
      </Screen>
    );
  }

  const cls = dueClass(bill.dueDays);
  const paid = bill.status === "paid";
  const overdue = !paid && bill.dueDays < 0;
  const daysLate = -bill.dueDays;
  const partial = isPartialBill(bill);
  const owed = totalOwed(bill);
  const pct = partialPct(bill);
  const remaining = owed - (bill.amountPaid ?? 0);
  const hasCarryOver = (bill.carryOver ?? 0) > 0;

  const handlePayPartial = () => {
    const amt = parseFloat(input.replace(/,/g, ""));
    if (isNaN(amt) || amt <= 0) return;
    payPartial(bill.id, amt);
    setInput("");
    setShowInput(false);
    haptics.success();
    const rem = owed - amt;
    if (rem > 0) {
      Alert.alert(
        "Payment recorded",
        `${money(rem)} remaining will roll over to next month automatically — nothing else for you to do.`,
        [{ text: "Got it", onPress: () => router.back() }],
      );
    } else {
      router.back();
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 14 }}>
      <SheetHeader title={bill.provider} onClose={() => router.back()} />
      <View style={{ height: 16 }} />

      {/* main card */}
      <Card style={{ alignItems: "center", gap: 10 }}>
        <ProviderLogo provider={bill.provider} cat={bill.cat} size={56} />
        <Mono size={30} weight="bold" color={paid ? t.semantic.ok : t.semantic[cls]}>
          {money(owed)}
        </Mono>
        <Low>
          {bill.cat} · {bill.dueLabel} ·{" "}
          {overdue ? (
            <Low color={t.semantic.overdue}>{daysLate} days late</Low>
          ) : paid ? (
            "paid"
          ) : (
            `in ${bill.dueDays}d`
          )}
        </Low>

        {/* overdue note — supportive, in-persona */}
        {overdue && (
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
              alignSelf: "stretch",
              borderWidth: 1,
              borderColor: t.semantic.overdue + "44",
              backgroundColor: t.semantic.overdue + "10",
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 12,
            }}
          >
            <JudithAvatar persona={persona} size={30} state="idle" />
            <Low size={12} style={{ flex: 1, lineHeight: 17 }}>
              This one slipped past its due date. Pay it now and I’ll mark you
              caught up — no judgment.
            </Low>
          </View>
        )}

        {/* carry-over notice */}
        {hasCarryOver && (
          <View
            style={{
              borderWidth: 1,
              borderColor: t.semantic.near + "55",
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
              alignSelf: "stretch",
            }}
          >
            <Low size={12}>
              Includes{" "}
              <Mono size={12} color={t.semantic.near}>
                {money(bill.carryOver!)}
              </Mono>{" "}
              carried over from last month
            </Low>
          </View>
        )}

        {/* partial payment bar */}
        {(partial || paid) && (
          <>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: t.surface3,
                alignSelf: "stretch",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  backgroundColor: paid ? t.semantic.ok : t.semantic.near,
                  borderRadius: 5,
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignSelf: "stretch",
              }}
            >
              <Low size={12}>
                {pct}% paid · {money(bill.amountPaid ?? 0)}
              </Low>
              {!paid && <Low size={12}>{money(remaining)} remaining</Low>}
            </View>
          </>
        )}
      </Card>

      {/* rollover warning — shows when partial and bill due soon or past */}
      {partial && !paid && (
        <View
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderColor: t.semantic.near + "55",
            borderRadius: 14,
            padding: 14,
            backgroundColor: t.surface1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="trend" size={14} color={t.semantic.near} />
            <Txt size={13} weight="semibold" color={t.semantic.near}>
              {money(remaining)} rolls over automatically
            </Txt>
          </View>
          <Low size={12} style={{ marginTop: 3 }}>
            The unpaid balance carries forward on its own and adds to your next{" "}
            {money(bill.amount)} charge — nothing for you to do.
          </Low>
        </View>
      )}

      {/* partial payment input */}
      {showInput && (
        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: t.hair,
            borderRadius: 14,
            backgroundColor: t.surface2,
            gap: 10,
          }}
        >
          <Low size={12}>Amount paid so far (cumulative total)</Low>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Mono size={24} weight="bold" color={t.txtHi} style={{ marginRight: 3 }}>₱</Mono>
            <TextInput
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              placeholder={Math.round(owed * 0.5).toLocaleString()}
              placeholderTextColor={t.txtLow}
              style={{
                fontFamily: t.fonts.mono,
                fontSize: 24,
                color: t.txtHi,
                paddingVertical: 4,
                flex: 1,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Btn label="Record Partial Payment" onPress={handlePayPartial} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn
                label="Cancel"
                variant="soft"
                onPress={() => {
                  setShowInput(false);
                  setInput("");
                }}
              />
            </View>
          </View>
        </View>
      )}

      {/* action buttons */}
      <View style={{ gap: 10, marginTop: 14 }}>
        <Btn
          label={paid ? "Mark as unpaid" : overdue ? "Mark paid — catch up" : "Mark as fully paid"}
          variant={paid ? "soft" : "primary"}
          onPress={() => {
            if (!paid) haptics.success();
            togglePaid(bill.id);
            router.back();
          }}
        />
        <Btn
          label="Edit bill"
          variant="soft"
          onPress={() => router.push(`/add-bill?id=${bill.id}`)}
        />
        {!paid && (
          <Btn
            label={
              showInput
                ? "Cancel"
                : partial
                  ? "Update partial payment"
                  : "Pay partial amount"
            }
            variant="soft"
            onPress={() => {
              if (showInput) {
                setShowInput(false);
                setInput("");
              } else {
                setInput(bill.amountPaid ? String(bill.amountPaid) : "");
                setShowInput(true);
              }
            }}
          />
        )}
      </View>
    </Screen>
  );
}
