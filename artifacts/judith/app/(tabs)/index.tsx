import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BillCard } from "@/components/BillCard";
import { JudithOrb } from "@/components/JudithOrb";
import { EmptyState, SectionLabel } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import {
  computeNextDue,
  daysUntil,
  listBills,
  type Bill,
} from "@/lib/bills";
import { syncReminders } from "@/lib/notifications";
import { pesoDisplay } from "@/lib/tagalog";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Magandang umaga";
  if (h < 18) return "Magandang hapon";
  return "Magandang gabi";
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useSettings();

  const { data: bills = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["bills"],
    queryFn: listBills,
    enabled: !!user,
  });

  useEffect(() => {
    void syncReminders(bills, profile.reminders_enabled);
  }, [bills, profile.reminders_enabled]);

  const { monthTotal, weekTotal, upcoming } = useMemo(() => {
    const now = new Date();
    const unpaid = bills.filter((b) => b.status !== "paid");
    const withDue = unpaid
      .map((b) => ({ bill: b, due: computeNextDue(b, now) }))
      .filter((x): x is { bill: Bill; due: Date } => !!x.due)
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    const fixedAmount = (bill: Bill) =>
      bill.amount_type === "fixed" && bill.amount ? bill.amount : 0;

    const month = withDue.reduce((sum, { bill, due }) => {
      const d = daysUntil(due, now);
      const sameMonth =
        due.getMonth() === now.getMonth() &&
        due.getFullYear() === now.getFullYear();
      return d >= 0 && sameMonth ? sum + fixedAmount(bill) : sum;
    }, 0);

    const week = withDue.reduce((sum, { bill, due }) => {
      const d = daysUntil(due, now);
      return d >= 0 && d <= 7 ? sum + fixedAmount(bill) : sum;
    }, 0);

    return {
      monthTotal: month,
      weekTotal: week,
      upcoming: withDue.map((x) => x.bill).slice(0, 5),
    };
  }, [bills]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()}</Text>
            <Text style={[styles.appName, { color: colors.foreground }]}>Judith</Text>
          </View>
          <JudithOrb size={64} state="idle" />
        </View>

        <View style={styles.cards}>
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
              Due ngayong buwan
            </Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {pesoDisplay(monthTotal)}
            </Text>
          </View>
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
              Due sa 7 araw
            </Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {pesoDisplay(weekTotal)}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/(tabs)/ask")}
          style={({ pressed }) => [
            styles.askBanner,
            { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.askTitle}>Tanungin si Judith</Text>
            <Text style={styles.askSub}>"Magkano ang bill ko ngayong buwan?"</Text>
          </View>
          <JudithOrb size={52} state="speaking" />
        </Pressable>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <SectionLabel>Mga paparating</SectionLabel>
            {bills.length > 0 ? (
              <Pressable onPress={() => router.push("/(tabs)/bills")}>
                <Text style={[styles.link, { color: colors.primary }]}>Tingnan lahat</Text>
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <Text style={{ color: colors.mutedForeground }}>Naglo-load…</Text>
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="Wala pang bayarin"
              subtitle="Magdagdag ng bill para simulan ang pagbabantay ni Judith."
            />
          ) : (
            <View style={styles.list}>
              {upcoming.map((bill) => (
                <BillCard key={bill.id} bill={bill} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 120, gap: 20 },
  header: { flexDirection: "row", alignItems: "center" },
  greeting: { fontSize: 15 },
  appName: { fontSize: 30, fontWeight: "800" },
  cards: { flexDirection: "row", gap: 12 },
  summary: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4 },
  summaryLabel: { fontSize: 12, fontWeight: "600" },
  summaryValue: { fontSize: 20, fontWeight: "800" },
  summarySub: { fontSize: 13, fontWeight: "700" },
  askBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  askTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  askSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2 },
  section: { gap: 12 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { fontSize: 13, fontWeight: "700" },
  list: { gap: 10 },
});
