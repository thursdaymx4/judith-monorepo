/**
 * Countries Judith supports, scoped to regions where ElevenLabs has excellent
 * speaking voices. Each maps to a `lang` code in `constants/languages.ts`.
 * `food` + `endearment` power the "Judith only talks bills" jokes and the
 * country-aware "Mom" copy.
 */

export interface Country {
  code: string;
  name: string;
  flag: string;
  cur: string;
  lang: string;
}

export const COUNTRIES: Country[] = [
  // ── Southeast Asia ────────────────────────────────────────────────
  { code: "PH", name: "Philippines", flag: "🇵🇭", cur: "₱", lang: "fil" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", cur: "Rp", lang: "id" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", cur: "RM", lang: "ms" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", cur: "S$", lang: "en" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", cur: "฿", lang: "th" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", cur: "₫", lang: "vi" },
  // ── East & South Asia ─────────────────────────────────────────────
  { code: "JP", name: "Japan", flag: "🇯🇵", cur: "¥", lang: "ja" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", cur: "₩", lang: "ko" },
  { code: "CN", name: "China", flag: "🇨🇳", cur: "¥", lang: "zh" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", cur: "HK$", lang: "yue" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", cur: "NT$", lang: "zh" },
  { code: "IN", name: "India", flag: "🇮🇳", cur: "₹", lang: "hi" },
  // ── North America ─────────────────────────────────────────────────
  { code: "US", name: "United States", flag: "🇺🇸", cur: "$", lang: "en" },
  { code: "CA", name: "Canada", flag: "🇨🇦", cur: "C$", lang: "en" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", cur: "$", lang: "es" },
  // ── Latin America ─────────────────────────────────────────────────
  { code: "BR", name: "Brazil", flag: "🇧🇷", cur: "R$", lang: "pt" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", cur: "$", lang: "es" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", cur: "$", lang: "es" },
  { code: "CL", name: "Chile", flag: "🇨🇱", cur: "$", lang: "es" },
  // ── Western Europe ────────────────────────────────────────────────
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", cur: "£", lang: "en" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", cur: "€", lang: "en" },
  { code: "ES", name: "Spain", flag: "🇪🇸", cur: "€", lang: "es" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", cur: "€", lang: "pt-PT" },
  { code: "FR", name: "France", flag: "🇫🇷", cur: "€", lang: "fr" },
  { code: "DE", name: "Germany", flag: "🇩🇪", cur: "€", lang: "de" },
  { code: "IT", name: "Italy", flag: "🇮🇹", cur: "€", lang: "it" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", cur: "€", lang: "nl" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", cur: "€", lang: "nl" },
  // ── Nordics ───────────────────────────────────────────────────────
  { code: "SE", name: "Sweden", flag: "🇸🇪", cur: "kr", lang: "sv" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", cur: "kr", lang: "da" },
  { code: "NO", name: "Norway", flag: "🇳🇴", cur: "kr", lang: "no" },
  { code: "FI", name: "Finland", flag: "🇫🇮", cur: "€", lang: "fi" },
  // ── Central & Eastern Europe ──────────────────────────────────────
  { code: "PL", name: "Poland", flag: "🇵🇱", cur: "zł", lang: "pl" },
  { code: "CZ", name: "Czechia", flag: "🇨🇿", cur: "Kč", lang: "cs" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰", cur: "€", lang: "sk" },
  { code: "RO", name: "Romania", flag: "🇷🇴", cur: "lei", lang: "ro" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", cur: "лв", lang: "bg" },
  { code: "HR", name: "Croatia", flag: "🇭🇷", cur: "€", lang: "hr" },
  { code: "GR", name: "Greece", flag: "🇬🇷", cur: "€", lang: "el" },
  { code: "HU", name: "Hungary", flag: "🇭🇺", cur: "Ft", lang: "hu" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", cur: "₴", lang: "uk" },
  { code: "RU", name: "Russia", flag: "🇷🇺", cur: "₽", lang: "ru" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷", cur: "₺", lang: "tr" },
  // ── Middle East & Africa ──────────────────────────────────────────
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", cur: "﷼", lang: "ar" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", cur: "د.إ", lang: "afb" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", cur: "E£", lang: "arz" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", cur: "₦", lang: "en" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", cur: "R", lang: "en" },
  // ── Oceania ───────────────────────────────────────────────────────
  { code: "AU", name: "Australia", flag: "🇦🇺", cur: "A$", lang: "en" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", cur: "NZ$", lang: "en" },
];

/** Familiar comfort food per country — drives the "Judith only talks bills" joke. */
export const COUNTRY_FOOD: Record<string, string> = {
  PH: "sinigang",
  ID: "rendang",
  MY: "nasi lemak",
  SG: "laksa",
  TH: "pad thai",
  VN: "pho",
  JP: "ramen",
  KR: "kimchi jjigae",
  CN: "dumplings",
  HK: "dim sum",
  TW: "beef noodle soup",
  IN: "biryani",
  US: "a cheeseburger",
  CA: "poutine",
  MX: "tacos",
  BR: "feijoada",
  AR: "asado",
  CO: "bandeja paisa",
  CL: "empanadas",
  GB: "fish and chips",
  IE: "a fry-up",
  ES: "paella",
  PT: "bacalhau",
  FR: "a croissant",
  DE: "schnitzel",
  IT: "pasta",
  NL: "stamppot",
  BE: "frites",
  SE: "meatballs",
  DK: "smørrebrød",
  NO: "salmon",
  FI: "karjalanpiirakka",
  PL: "pierogi",
  CZ: "svíčková",
  SK: "halušky",
  RO: "sarmale",
  BG: "banitsa",
  HR: "ćevapi",
  GR: "souvlaki",
  HU: "goulash",
  UA: "borscht",
  RU: "pelmeni",
  TR: "kebab",
  SA: "kabsa",
  AE: "shawarma",
  EG: "koshari",
  NG: "jollof rice",
  ZA: "a braai",
  AU: "a meat pie",
  NZ: "a meat pie",
};

/** Country-aware "Mom" endearment (sarcastic / mama copy). */
export const MOM_ENDEARMENT: Record<string, string> = {
  PH: "Anak",
  ID: "Nak",
  MY: "Sayang",
  SG: "Dear",
  TH: "Lûk",
  VN: "Con",
  JP: "Anata",
  KR: "Aga",
  CN: "Bǎobèi",
  HK: "Bǎobèi",
  TW: "Bǎobèi",
  IN: "Beta",
  US: "Honey",
  CA: "Hon",
  MX: "Mija",
  BR: "Querido",
  AR: "Mi amor",
  CO: "Mijo",
  CL: "Mijo",
  GB: "Love",
  IE: "Love",
  ES: "Cariño",
  PT: "Querido",
  FR: "Chéri",
  DE: "Schatz",
  IT: "Tesoro",
  NL: "Schat",
  BE: "Schat",
  SE: "Älskling",
  DK: "Skat",
  NO: "Kjære",
  FI: "Kulta",
  PL: "Kochanie",
  CZ: "Zlatíčko",
  SK: "Zlatko",
  RO: "Dragă",
  BG: "Miloto mi",
  HR: "Dušo",
  GR: "Agápi mou",
  HU: "Drágám",
  UA: "Sonechko",
  RU: "Solnyshko",
  TR: "Canım",
  SA: "Habibi",
  AE: "Habibi",
  EG: "Habibi",
  NG: "Dear",
  ZA: "Dear",
  AU: "Love",
  NZ: "Love",
};

export const DEFAULT_COUNTRY = COUNTRIES[0]!; // Philippines

/**
 * Unique currency symbols derived from COUNTRIES — first country per symbol
 * wins the representative flag/label. Used by the currency picker in Settings.
 */
export const CURRENCIES: Array<{ cur: string; flag: string; label: string }> = (() => {
  const seen = new Set<string>();
  const result: Array<{ cur: string; flag: string; label: string }> = [];
  for (const c of COUNTRIES) {
    if (!seen.has(c.cur)) {
      seen.add(c.cur);
      result.push({ cur: c.cur, flag: c.flag, label: c.name });
    }
  }
  return result;
})();

export function countryByCode(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
}

export function countryFood(code?: string): string {
  return (code && COUNTRY_FOOD[code]) || "dinner";
}

export function momEndearment(code?: string): string {
  return (code && MOM_ENDEARMENT[code]) || "Dear";
}
