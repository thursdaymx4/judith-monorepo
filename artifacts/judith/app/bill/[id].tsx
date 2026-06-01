import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Btn, Card, Low, Mono, ProviderLogo, Screen, SheetHeader, Txt } from "@/components/ui";
import { dueClass } from "@/constants/data";
import { useJudith } from "@/contexts/JudithStore";
import { useTheme } from "@/hooks/useTheme";

export default function BillDetailModal() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bills, money, togglePaid } = useJudith();
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

  return (
    <Screen contentStyle={{ paddingTop: 14 }}>
      <SheetHeader title={bill.provider} onClose={() => router.back()} />
      <View style={{ height: 16 }} />
      <Card style={{ alignItems: "center", gap: 10 }}>
        <ProviderLogo provider={bill.provider} cat={bill.cat} size={56} />
        <Mono size={30} weight="bold" color={t.semantic[cls]}>
          {money(bill.amount)}
        </Mono>
        <Low>
          {bill.cat} · {bill.dueLabel} · in {bill.dueDays}d
        </Low>
      </Card>
      <View style={{ height: 16 }} />
      <Btn
        label={paid ? "Mark as unpaid" : "Mark as paid"}
        variant={paid ? "soft" : "primary"}
        onPress={() => {
          togglePaid(bill.id);
          router.back();
        }}
      />
    </Screen>
  );
}
