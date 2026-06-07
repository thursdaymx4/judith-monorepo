import React, { useEffect } from "react";
import Purchases, { type CustomerInfo } from "react-native-purchases";

import { useJudith } from "@/contexts/JudithStore";
import { CHAT_ENTITLEMENT_ID, VOICE_ENTITLEMENT_ID, isPurchasesConfigured } from "@/lib/purchases";

/**
 * SubscriptionProvider
 *
 * Listens to real-time RevenueCat CustomerInfo updates and keeps the
 * JudithStore tier in sync. Must be rendered inside the JudithStore provider
 * (i.e. inside <JudithProvider>) at the root of the app.
 *
 * Mirrors the pattern from the @replit/revenuecat skill while re-using
 * JudithStore as the single source of truth (avoids a parallel
 * subscription context).
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { subscribe } = useJudith();

  useEffect(() => {
    if (!isPurchasesConfigured) return;

    const listener = (info: CustomerInfo) => {
      const active = info.entitlements.active;
      const updatedTier = active[VOICE_ENTITLEMENT_ID]
        ? ("voice" as const)
        : active[CHAT_ENTITLEMENT_ID]
          ? ("chat" as const)
          : ("free" as const);
      subscribe(updatedTier);
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  // subscribe is stable (from JudithStore atom dispatch), no need to re-register
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
