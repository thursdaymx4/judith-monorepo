/**
 * FX conversion helper for the receipt-scan flow. Resolves "what ISO code is
 * the user's account in?" + fetches today's mid-market rate to convert a
 * receipt amount denominated in a different currency.
 *
 * Two-layer cache:
 *   1. Server-side 24h cache (one upstream call per pair per day, all users)
 *   2. Client AsyncStorage 24h cache (zero network round-trips for repeat
 *      scans of the same currency pair)
 *
 * Falls back to last-known-good when upstream is down. Falls back to 1:1
 * with a warning when no rate is reachable at all — we never block the
 * receipt-scan flow on FX.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchFxRate } from "@/lib/proxy";

const FX_TTL_MS = 24 * 60 * 60 * 1000;
const FX_CACHE_PREFIX = "judith.fx.";

export interface FxRate {
  rate: number;
  fetchedAt: number;
  source: string;
  stale?: boolean;
}

/**
 * ISO 4217 code for each supported country. Sourced from the COUNTRIES list
 * in constants/countries.ts but flat so we can resolve without a Country
 * object. SG/HK/CA/AU keep their unique codes; ambiguous-symbol countries
 * (MX, AR, CO, CL, etc.) get their right code rather than collapsing to USD.
 */
const COUNTRY_TO_ISO: Record<string, string> = {
  PH: "PHP", ID: "IDR", MY: "MYR", SG: "SGD", TH: "THB", VN: "VND",
  JP: "JPY", KR: "KRW", CN: "CNY", HK: "HKD", TW: "TWD", IN: "INR",
  US: "USD", CA: "CAD", MX: "MXN",
  BR: "BRL", AR: "ARS", CO: "COP", CL: "CLP",
  GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  PT: "EUR", IE: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
  SE: "SEK", NO: "NOK", DK: "DKK", CH: "CHF",
  AU: "AUD", NZ: "NZD", ZA: "ZAR",
  AE: "AED", SA: "SAR", IL: "ILS", TR: "TRY", EG: "EGP",
  KE: "KES", NG: "NGN", GH: "GHS",
  RU: "RUB", UA: "UAH",
};

/**
 * Best-effort ISO 4217 code for the user's country. Defaults to USD when the
 * country code isn't mapped (rare — most ISO-3166 codes that ship Judith are
 * here). Callers can pass an override when they already know the code.
 */
export function userCurrencyCode(countryCode: string | undefined | null): string {
  if (!countryCode) return "USD";
  return COUNTRY_TO_ISO[countryCode.toUpperCase()] ?? "USD";
}

/**
 * Today's rate to convert `from` → `to`. Hits the AsyncStorage cache first,
 * then the server endpoint (which is itself 24h-cached). Returns null only
 * when offline AND no client-cache entry exists — the receipt-scan UI uses
 * that to fall back to "no conversion" with a soft warning.
 */
export async function getFxRate(from: string, to: string): Promise<FxRate | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (!/^[A-Z]{3}$/.test(f) || !/^[A-Z]{3}$/.test(t)) return null;
  if (f === t) return { rate: 1, fetchedAt: Date.now(), source: "identity" };

  const cacheKey = `${FX_CACHE_PREFIX}${f}.${t}`;
  const now = Date.now();

  // Client cache
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const entry = JSON.parse(raw) as FxRate;
      if (now - entry.fetchedAt < FX_TTL_MS) return entry;
    }
  } catch {
    // Storage corrupt — fall through to network.
  }

  // Server fetch
  try {
    const data = await fetchFxRate(f, t);
    if (data && typeof data.rate === "number" && data.rate > 0) {
      AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
      return data;
    }
    throw new Error("bad rate");
  } catch {
    // Network or upstream failed. Serve whatever's in the client cache, even
    // if it's stale — better than blocking the receipt confirm screen.
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const entry = JSON.parse(raw) as FxRate;
        return { ...entry, stale: true };
      }
    } catch {}
    return null;
  }
}

/** Symbol → ISO when only the symbol is known. Same defaults as the Swift
 *  module: ambiguous `$` falls back to USD. */
export function symbolToIso(symbol: string): string | null {
  const map: Record<string, string> = {
    "₱": "PHP", "€": "EUR", "£": "GBP", "¥": "JPY",
    "₹": "INR", "₩": "KRW", "₫": "VND", "฿": "THB",
    RM: "MYR", "R$": "BRL", "S$": "SGD", "HK$": "HKD",
    "C$": "CAD", "A$": "AUD", "NT$": "TWD",
    $: "USD",
  };
  return map[symbol] ?? null;
}
