/** Countries, comfort food + "Mom" endearment — ported 1:1 from spec (§3.5). */

export interface Country {
  code: string;
  name: string;
  flag: string;
  cur: string;
  lang: string;
}

export const COUNTRIES: Country[] = [
  { code: "PH", name: "Philippines", flag: "🇵🇭", cur: "₱", lang: "fil" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", cur: "Rp", lang: "id" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", cur: "₫", lang: "vi" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", cur: "RM", lang: "en" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", cur: "฿", lang: "en" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", cur: "$", lang: "es" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", cur: "₦", lang: "en" },
  { code: "IN", name: "India", flag: "🇮🇳", cur: "₹", lang: "en" },
];

/** Familiar comfort food per country — drives the "Judith only talks bills" joke. */
export const COUNTRY_FOOD: Record<string, string> = {
  PH: "sinigang",
  ID: "rendang",
  VN: "pho",
  MY: "nasi lemak",
  TH: "pad thai",
  MX: "tacos",
  NG: "jollof rice",
  IN: "biryani",
};

/** Country-aware "Mom" endearment (sarcastic / mama copy). */
export const MOM_ENDEARMENT: Record<string, string> = {
  PH: "Anak",
  ID: "Nak",
  VN: "Con",
  MY: "Sayang",
  TH: "Lûk",
  MX: "Mija",
  NG: "Dear",
  IN: "Beta",
};

export const DEFAULT_COUNTRY = COUNTRIES[0]!; // Philippines

export function countryByCode(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
}

export function countryFood(code?: string): string {
  return (code && COUNTRY_FOOD[code]) || "dinner";
}

export function momEndearment(code?: string): string {
  return (code && MOM_ENDEARMENT[code]) || "Dear";
}
