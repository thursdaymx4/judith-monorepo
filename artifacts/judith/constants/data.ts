/**
 * Bills, providers, history, voices, quick-asks + helpers.
 * Ported 1:1 from the prototype (japp-data.jsx, spec §3).
 */

export type BillStatus = "due" | "paid";
export type BillKind = "Fixed" | "Variable";

export interface Bill {
  id: string;
  provider: string;
  cat: string;
  icon: string;
  amount: number;
  dueDays: number;
  dueDate: number; // day-of-month (1-31)
  dueLabel: string; // "Jun 2"
  status: BillStatus;
  house?: string;
  kind?: BillKind;
  subtype?: "Rent" | "Mortgage";
}

export interface Provider {
  name: string;
  color: string;
  short: string;
  cat?: string;
  derived?: boolean;
}

/* ---------- provider database (global subs + local PH) ---------- */
export const PROVIDERS: Record<string, Provider[]> = {
  Electricity: [
    { name: "Meralco", color: "#F5821F", short: "M" },
    { name: "Visayan Electric", color: "#0a6b3b", short: "VE" },
    { name: "Davao Light", color: "#0067b1", short: "DL" },
  ],
  Water: [
    { name: "Maynilad", color: "#0067B1", short: "M" },
    { name: "Manila Water", color: "#00A0AF", short: "MW" },
  ],
  Internet: [
    { name: "PLDT Home", color: "#C8102E", short: "P" },
    { name: "Converge", color: "#F47920", short: "C" },
    { name: "Globe At Home", color: "#0066B3", short: "G" },
    { name: "Sky Fiber", color: "#E5006D", short: "S" },
    { name: "Starlink", color: "#1a1a2e", short: "SL" },
  ],
  Mobile: [
    { name: "Globe", color: "#0066B3", short: "G" },
    { name: "Smart", color: "#00A551", short: "S" },
    { name: "DITO", color: "#E5202E", short: "D" },
    { name: "TM", color: "#FFB81C", short: "TM" },
    { name: "TNT", color: "#E5202E", short: "TNT" },
  ],
  Landline: [
    { name: "PLDT", color: "#C8102E", short: "P" },
    { name: "Globe", color: "#0066B3", short: "G" },
  ],
  "Credit card": [
    { name: "BPI", color: "#A6192E", short: "BPI" },
    { name: "BDO", color: "#00529C", short: "BDO" },
    { name: "Metrobank", color: "#003DA5", short: "MB" },
    { name: "UnionBank", color: "#FF6B00", short: "UB" },
    { name: "RCBC", color: "#003C71", short: "R" },
    { name: "Security Bank", color: "#006B3F", short: "SB" },
    { name: "Citi", color: "#056DAE", short: "C" },
  ],
  Subscription: [
    { name: "Netflix", color: "#E50914", short: "N" },
    { name: "Spotify", color: "#1DB954", short: "S" },
    { name: "YouTube Premium", color: "#FF0000", short: "YT" },
    { name: "Disney+", color: "#113CCF", short: "D+" },
    { name: "Max", color: "#0046FF", short: "M" },
    { name: "Prime Video", color: "#00A8E1", short: "P" },
    { name: "Apple One", color: "#4d4d4f", short: "" },
    { name: "iCloud+", color: "#3b8bea", short: "iC" },
    { name: "Viu", color: "#F8485E", short: "V" },
    { name: "iWantTFC", color: "#1aa3ff", short: "iW" },
    { name: "Canva", color: "#00C4CC", short: "C" },
    { name: "Notion", color: "#3f3f3f", short: "N" },
    { name: "Google One", color: "#4285F4", short: "G" },
    { name: "Microsoft 365", color: "#D83B01", short: "MS" },
  ],
  Custom: [],
};

export const CAT_ICONS: Record<string, string> = {
  Electricity: "zap",
  Water: "droplet",
  Internet: "wifi",
  Mobile: "smartphone",
  Landline: "phone",
  "Credit card": "card",
  Subscription: "spark",
  Custom: "plus",
};

const FALLBACK_COLORS = [
  "#5b6cff",
  "#0aa3a3",
  "#c0497b",
  "#7b61ff",
  "#c98a1b",
  "#3a7d44",
  "#b5453a",
  "#4a6fa5",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 +]/g, "").trim().split(/\s+/);
  if (words.length === 1) return (words[0] ?? "").slice(0, 1).toUpperCase();
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

/** Find brand styling for a provider name; derive a stable one if unknown. */
export function lookupProvider(name?: string): Provider | null {
  if (!name) return null;
  const flat: Provider[] = [];
  Object.keys(PROVIDERS).forEach((cat) =>
    PROVIDERS[cat]!.forEach((p) => flat.push({ ...p, cat })),
  );
  const n = name.trim().toLowerCase();
  const hit =
    flat.find((p) => p.name.toLowerCase() === n) ||
    flat.find(
      (p) =>
        n.startsWith(p.name.toLowerCase()) ||
        p.name.toLowerCase().startsWith(n),
    );
  if (hit) return hit;
  return {
    name,
    color: FALLBACK_COLORS[hash(name) % FALLBACK_COLORS.length]!,
    short: initials(name),
    derived: true,
  };
}

export const APP_BILLS: Bill[] = [
  { id: "rent", provider: "Ayala Land", cat: "Rent / Mortgage", icon: "home", amount: 18000, dueDays: 0, dueDate: 1, dueLabel: "Jun 1", status: "due", house: "Main home" },
  { id: "meralco", provider: "Meralco", cat: "Electricity", icon: "zap", amount: 3450, dueDays: 2, dueDate: 2, dueLabel: "Jun 2", status: "due", house: "Main home" },
  { id: "maynilad", provider: "Maynilad", cat: "Water", icon: "droplet", amount: 890, dueDays: 6, dueDate: 6, dueLabel: "Jun 6", status: "due", house: "Main home" },
  { id: "pldt", provider: "PLDT Home", cat: "Internet", icon: "wifi", amount: 1699, dueDays: 6, dueDate: 6, dueLabel: "Jun 6", status: "due", house: "Main home" },
  { id: "globe", provider: "Globe", cat: "Mobile", icon: "smartphone", amount: 1299, dueDays: 12, dueDate: 12, dueLabel: "Jun 12", status: "due", house: "Main home" },
  { id: "condo-meralco", provider: "Meralco", cat: "Electricity", icon: "zap", amount: 1240, dueDays: 9, dueDate: 9, dueLabel: "Jun 9", status: "due", house: "Condo (rental)" },
  { id: "condo-dues", provider: "Condo Assoc.", cat: "Rent / Mortgage", icon: "home", amount: 4500, dueDays: 14, dueDate: 14, dueLabel: "Jun 14", status: "due", house: "Condo (rental)" },
  { id: "bpi", provider: "BPI", cat: "Credit card", icon: "card", amount: 5200, dueDays: 18, dueDate: 18, dueLabel: "Jun 18", status: "due", house: "Main home" },
  { id: "spotify", provider: "Spotify", cat: "Subscription", icon: "spark", amount: 194, dueDays: 25, dueDate: 25, dueLabel: "Jun 25", status: "paid", house: "Main home" },
  { id: "netflix", provider: "Netflix", cat: "Subscription", icon: "spark", amount: 549, dueDays: 28, dueDate: 28, dueLabel: "Jun 28", status: "due", house: "Main home" },
];

export const HOUSES = ["Main home", "Condo (rental)", "Parents' house"];

export interface HistoryPoint {
  m: string;
  a: number;
}

export const HISTORY: Record<string, HistoryPoint[]> = {
  meralco: [{ m: "May", a: 3280 }, { m: "Apr", a: 3510 }, { m: "Mar", a: 2990 }],
  maynilad: [{ m: "May", a: 860 }, { m: "Apr", a: 910 }, { m: "Mar", a: 845 }],
  pldt: [{ m: "May", a: 1699 }, { m: "Apr", a: 1699 }, { m: "Mar", a: 1699 }],
  globe: [{ m: "May", a: 1299 }, { m: "Apr", a: 1299 }],
  bpi: [{ m: "May", a: 4820 }, { m: "Apr", a: 6010 }],
  spotify: [{ m: "May", a: 194 }, { m: "Apr", a: 194 }],
  netflix: [{ m: "May", a: 549 }, { m: "Apr", a: 549 }],
};

/* 6-month total outflow trend (synthesized, ends near current). */
export const TREND_6MO: HistoryPoint[] = [
  { m: "Jan", a: 11240 },
  { m: "Feb", a: 12010 },
  { m: "Mar", a: 11580 },
  { m: "Apr", a: 12940 },
  { m: "May", a: 12150 },
  { m: "Jun", a: 13281 },
];

export interface Voice {
  id: string;
  name: string;
  desc: string;
  tag?: string;
}

export const VOICES: Voice[] = [
  { id: "rachel", name: "Rachel", desc: "Warm · natural", tag: "Default" },
  { id: "antoni", name: "Antoni", desc: "Calm · confident" },
  { id: "bella", name: "Bella", desc: "Soft · friendly" },
  { id: "domi", name: "Domi", desc: "Bold · energetic" },
  { id: "elli", name: "Elli", desc: "Bright · youthful" },
];

export const QUICK_ASKS = [
  "What's due this week?",
  "How much do I owe this month?",
  "Did I pay Meralco?",
  "What's my biggest bill?",
  "When's my next due date?",
];

/** Money formatter — currency symbol from the selected country. */
export function formatMoney(n: number, symbol = "₱"): string {
  return symbol + Math.round(n).toLocaleString("en-US");
}

/** Default ₱ formatter (prototype `peso`). */
export const peso = (n: number): string => formatMoney(n);

/** Urgency bucket from days-until-due. */
export const dueClass = (d: number): "urgent" | "near" | "ok" =>
  d <= 3 ? "urgent" : d <= 7 ? "near" : "ok";
