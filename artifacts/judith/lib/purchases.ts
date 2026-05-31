import Purchases, {
  type PurchasesPackage,
} from "react-native-purchases";

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
export const ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ?? "premium";
export const isPurchasesConfigured = Boolean(API_KEY);

let configured = false;

export function configurePurchases(): void {
  if (configured || !API_KEY) return;
  try {
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  } catch {
    // Preview API Mode (Expo Go) or missing native module — ignore.
  }
}

export async function hasActiveEntitlement(): Promise<boolean> {
  if (!API_KEY) return false;
  configurePurchases();
  try {
    const info = await Purchases.getCustomerInfo();
    return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}

export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  if (!API_KEY) return null;
  configurePurchases();
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  configurePurchases();
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
}

export async function restorePurchases(): Promise<boolean> {
  if (!API_KEY) return false;
  configurePurchases();
  try {
    const info = await Purchases.restorePurchases();
    return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}
