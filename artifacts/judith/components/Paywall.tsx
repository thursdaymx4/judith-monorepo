import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { JudithOrb } from "@/components/JudithOrb";
import { Button } from "@/components/ui";
import { PRICE_LABEL } from "@/constants/config";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import {
  getMonthlyPackage,
  isPurchasesConfigured,
  purchasePackage,
  restorePurchases,
} from "@/lib/purchases";

const PERKS = [
  "Walang limitasyong tanong kay Judith",
  "Lahat ng 4 na persona at boses",
  "Maagang paalala bago mag-due",
];

export function Paywall() {
  const colors = useColors();
  const { refresh } = useSettings();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void getMonthlyPackage().then(setPkg);
  }, []);

  const subscribe = async () => {
    if (!pkg) {
      setNote("Hindi pa available ang subscription. Subukan mamaya.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const ok = await purchasePackage(pkg);
      if (ok) await refresh();
      else setNote("Hindi natapos ang subscription.");
    } catch {
      setNote("Na-cancel o nabigo ang subscription.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      if (ok) await refresh();
      else setNote("Walang nahanap na dating subscription.");
    } finally {
      setBusy(false);
    }
  };

  const priceLabel = pkg?.product.priceString ?? PRICE_LABEL;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <JudithOrb size={120} state="speaking" />
      <Text style={[styles.title, { color: colors.foreground }]}>Judith Premium</Text>
      <Text style={[styles.price, { color: colors.primary }]}>{priceLabel}</Text>

      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk} style={styles.perkRow}>
            <Feather name="check-circle" size={18} color={colors.primary} />
            <Text style={[styles.perk, { color: colors.foreground }]}>{perk}</Text>
          </View>
        ))}
      </View>

      <Button
        label={`Mag-subscribe — ${priceLabel}`}
        onPress={subscribe}
        loading={busy}
        style={styles.cta}
      />
      <Button label="I-restore ang subscription" variant="ghost" onPress={restore} />

      {!isPurchasesConfigured ? (
        <Text style={[styles.fine, { color: colors.mutedForeground }]}>
          Idadagdag ang billing kapag na-configure na ang RevenueCat.
        </Text>
      ) : null}
      {note ? (
        <Text style={[styles.fine, { color: colors.destructive }]}>{note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  title: { fontSize: 28, fontWeight: "800" },
  price: { fontSize: 18, fontWeight: "700" },
  perks: { gap: 12, marginVertical: 16, alignSelf: "stretch" },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  perk: { fontSize: 15, flex: 1 },
  cta: { alignSelf: "stretch" },
  fine: { fontSize: 12, textAlign: "center", marginTop: 4, maxWidth: 280 },
});
