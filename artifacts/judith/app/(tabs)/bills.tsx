import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
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
import { EmptyState, SectionLabel } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { listBills } from "@/lib/bills";

export default function BillsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const { data: bills = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["bills"],
    queryFn: listBills,
    enabled: !!user,
  });

  const active = bills.filter((b) => b.status !== "paid");
  const paid = bills.filter((b) => b.status === "paid");

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.foreground }]}>Mga Bayarin</Text>
        <Pressable
          onPress={() => router.push("/bill/new")}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <Text style={{ color: colors.mutedForeground }}>Naglo-load…</Text>
        ) : bills.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="Wala pang bayarin"
            subtitle="Pindutin ang + para magdagdag ng unang bill."
          />
        ) : (
          <>
            {active.length > 0 ? (
              <View style={styles.section}>
                <SectionLabel>Aktibo</SectionLabel>
                <View style={styles.list}>
                  {active.map((bill) => (
                    <BillCard key={bill.id} bill={bill} />
                  ))}
                </View>
              </View>
            ) : null}

            {paid.length > 0 ? (
              <View style={styles.section}>
                <SectionLabel>Bayad na</SectionLabel>
                <View style={styles.list}>
                  {paid.map((bill) => (
                    <BillCard key={bill.id} bill={bill} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "800" },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  section: { gap: 12 },
  list: { gap: 10 },
});
