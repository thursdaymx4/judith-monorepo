import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  CATEGORY_META,
  computeNextDue,
  daysUntil,
  urgencyOf,
  type Bill,
} from "@/lib/bills";
import { dueLabel, pesoDisplay } from "@/lib/tagalog";

type FeatherName = keyof typeof Feather.glyphMap;

export function BillCard({ bill }: { bill: Bill }) {
  const colors = useColors();
  const router = useRouter();

  const urgency = urgencyOf(bill);
  const due = computeNextDue(bill);
  const days = due ? daysUntil(due) : null;

  const accent =
    urgency === "overdue" || urgency === "urgent"
      ? colors.urgent
      : urgency === "near"
        ? colors.near
        : urgency === "paid"
          ? colors.mutedForeground
          : colors.ok;

  const meta = CATEGORY_META[bill.category];

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        router.push(`/bill/${bill.id}`);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={meta.icon as FeatherName} size={20} color={accent} />
      </View>

      <View style={styles.middle}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {bill.name}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {bill.provider ? `${bill.provider} · ` : ""}
          {bill.amount_type === "variable" && bill.amount == null
            ? "Variable"
            : pesoDisplay(bill.amount)}
        </Text>
      </View>

      <View style={styles.right}>
        {bill.status === "paid" ? (
          <View style={[styles.pill, { backgroundColor: colors.secondary }]}>
            <Feather name="check" size={13} color={colors.ok} />
            <Text style={[styles.pillText, { color: colors.ok }]}>Bayad na</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.due, { color: accent }]}>
              {days != null ? dueLabel(days) : "Walang due"}
            </Text>
            {due ? (
              <Text style={[styles.dueDate, { color: colors.mutedForeground }]}>
                {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: "700" },
  sub: { fontSize: 13 },
  right: { alignItems: "flex-end", gap: 3 },
  due: { fontSize: 13, fontWeight: "700" },
  dueDate: { fontSize: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: "700" },
});
