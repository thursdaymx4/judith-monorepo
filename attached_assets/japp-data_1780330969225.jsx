/* japp-data.jsx — bills, providers + logos, voices, quick-asks, helpers, icons */

/* extended icon set (overrides j-core Icon for the app) */
function Icon({ name, size = 22 }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const P = {
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
    droplet: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
    wifi: <g><path d="M2 8.5a16 16 0 0 1 20 0" /><path d="M5 12.5a11 11 0 0 1 14 0" /><path d="M8.5 16.2a6 6 0 0 1 7 0" /><circle cx="12" cy="20" r="0.6" fill="currentColor" stroke="none" /></g>,
    smartphone: <g><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></g>,
    phone: <path d="M14 16.5a1 1 0 0 0 1.2-.3l.4-.5a2 2 0 0 1 1.6-.7h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.3z" />,
    card: <g><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></g>,
    plus: <g><path d="M12 5v14" /><path d="M5 12h14" /></g>,
    mic: <g><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4" /></g>,
    check: <path d="M20 6 9 17l-5-5" />,
    bell: <g><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></g>,
    watch: <g><rect x="6" y="6" width="12" height="12" rx="3" /><path d="M9 6V3h6v3M9 18v3h6v-3M12 10v2.5l1.5 1" /></g>,
    grid: <g><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></g>,
    chart: <g><path d="M3 3v18h18" /><path d="M7 14v3M12 9v8M17 5v12" /></g>,
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
    arrow: <g><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></g>,
    cal: <g><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" /></g>,
    lock: <g><rect x="4" y="11" width="16" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g>,
    star: <path d="M12 3l2.6 6.3L21 10l-5 4 1.6 6.6L12 17l-5.6 3.6L8 14l-5-4 6.4-.7z" />,
    home: <g><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></g>,
    receipt: <g><path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5z" /><path d="M9 8h6M9 12h6" /></g>,
    gear: <g><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></g>,
    pencil: <g><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></g>,
    chev: <path d="M9 6l6 6-6 6" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    refresh: <g><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /></g>,
    play: <path d="M7 4v16l13-8z" fill="currentColor" stroke="none" />,
    wallet: <g><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" /><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" /><path d="M21 12h-4a2 2 0 1 0 0 4h4z" /></g>,
    snooze: <g><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M5 5l2-2" /></g>,
    camera: <g><path d="M3 8.5A2 2 0 0 1 5 6.5h2L8.5 4h7L17 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.4" /></g>,
    scan: <g><path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17" /><path d="M4 12h16" /></g>,
    sun: <g><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></g>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    trend: <g><path d="M3 17l6-6 4 4 7-7" /><path d="M17 7h4v4" /></g>,
    trenddown: <g><path d="M3 7l6 6 4-4 7 7" /><path d="M17 17h4v-4" /></g>,
    faceCalm: <g><circle cx="12" cy="12" r="9" /><path d="M9 10.5h.01" /><path d="M15 10.5h.01" /><path d="M8.5 14.5q3.5 3 7 0" /></g>,
    faceAnxious: <g><circle cx="12" cy="12" r="9" /><path d="M8 9.2l2 1.1" /><path d="M16 9.2l-2 1.1" /><path d="M9 11.5h.01" /><path d="M15 11.5h.01" /><path d="M8.5 15.5q1.2-1.4 2.3 0 1.2 1.4 2.3 0 1.2-1.4 2.3 0" /></g>,
    pie: <g><path d="M12 2a10 10 0 1 0 10 10h-10z" /><path d="M13 2.5A10 10 0 0 1 21.5 11H13z" /></g>,
    layers: <g><path d="M12 3 3 8l9 5 9-5z" /><path d="M3 12.5l9 5 9-5" /></g>,
    clock: <g><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></g>,
    flame: <path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-3-6 .5 2-1 3.5-1 3.5C15 9 13 3 10.5 2c.7 3-1.5 5-3 7.5C6 11.5 5 13 5 15c0 4.3 3 7 7 7z" />,
    sliders: <g><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></g>,
    flash: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
  };
  return <svg {...c}>{P[name] || P.spark}</svg>;
}

/* ---------- provider database (global subs + local PH) ---------- */
const PROVIDERS = {
  Electricity: [
    { name: "Meralco", color: "#F5821F", short: "M" },
    { name: "Visayan Electric", color: "#0a6b3b", short: "VE" },
    { name: "Davao Light", color: "#0067b1", short: "DL" }
  ],
  Water: [
    { name: "Maynilad", color: "#0067B1", short: "M" },
    { name: "Manila Water", color: "#00A0AF", short: "MW" }
  ],
  Internet: [
    { name: "PLDT Home", color: "#C8102E", short: "P" },
    { name: "Converge", color: "#F47920", short: "C" },
    { name: "Globe At Home", color: "#0066B3", short: "G" },
    { name: "Sky Fiber", color: "#E5006D", short: "S" },
    { name: "Starlink", color: "#1a1a2e", short: "SL" }
  ],
  Mobile: [
    { name: "Globe", color: "#0066B3", short: "G" },
    { name: "Smart", color: "#00A551", short: "S" },
    { name: "DITO", color: "#E5202E", short: "D" },
    { name: "TM", color: "#FFB81C", short: "TM" },
    { name: "TNT", color: "#E5202E", short: "TNT" }
  ],
  Landline: [
    { name: "PLDT", color: "#C8102E", short: "P" },
    { name: "Globe", color: "#0066B3", short: "G" }
  ],
  "Credit card": [
    { name: "BPI", color: "#A6192E", short: "BPI" },
    { name: "BDO", color: "#00529C", short: "BDO" },
    { name: "Metrobank", color: "#003DA5", short: "MB" },
    { name: "UnionBank", color: "#FF6B00", short: "UB" },
    { name: "RCBC", color: "#003C71", short: "R" },
    { name: "Security Bank", color: "#006B3F", short: "SB" },
    { name: "Citi", color: "#056DAE", short: "C" }
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
    { name: "Microsoft 365", color: "#D83B01", short: "MS" }
  ],
  Custom: []
};

/* category accent palette (independent of brand accent, harmonized) */
const CAT_COLORS = {
  "Rent / Mortgage": "oklch(0.7 0.13 300)",
  Electricity: "oklch(0.74 0.16 60)",
  Water: "oklch(0.72 0.13 230)",
  Internet: "oklch(0.70 0.16 292)",
  Mobile: "oklch(0.75 0.14 165)",
  Landline: "oklch(0.68 0.06 250)",
  "Credit card": "oklch(0.68 0.19 22)",
  Subscription: "oklch(0.74 0.15 330)",
  Custom: "oklch(0.70 0.04 260)",
  "TV / Streaming": "oklch(0.74 0.15 330)",
  "Phone subscription": "oklch(0.72 0.13 200)",
  "Web app": "oklch(0.7 0.12 140)",
  "Personal loan": "oklch(0.68 0.17 30)"
};
const CAT_ICONS = {
  Electricity: "zap", Water: "droplet", Internet: "wifi", Mobile: "smartphone",
  Landline: "phone", "Credit card": "card", Subscription: "spark", Custom: "plus"
};

const _FALLBACK_COLORS = ["#5b6cff", "#0aa3a3", "#c0497b", "#7b61ff", "#c98a1b", "#3a7d44", "#b5453a", "#4a6fa5"];
function _hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function _initials(name) {
  const words = name.replace(/[^A-Za-z0-9 +]/g, "").trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* find brand styling for a provider name; derive a stable one if unknown */
function lookupProvider(name) {
  if (!name) return null;
  const flat = [];
  Object.keys(PROVIDERS).forEach((cat) => PROVIDERS[cat].forEach((p) => flat.push({ ...p, cat })));
  const n = name.trim().toLowerCase();
  let hit = flat.find((p) => p.name.toLowerCase() === n)
    || flat.find((p) => n.startsWith(p.name.toLowerCase()) || p.name.toLowerCase().startsWith(n));
  if (hit) return hit;
  return { name, color: _FALLBACK_COLORS[_hash(name) % _FALLBACK_COLORS.length], short: _initials(name), derived: true };
}

/* brand monogram tile; falls back to category icon if no provider */
function ProviderLogo({ provider, cat, size = 38 }) {
  const radius = Math.round(size * 0.29);
  if (!provider) {
    return (
      <span className="logo-tile logo-cat" style={{ width: size, height: size, borderRadius: radius, color: CAT_COLORS[cat] || "var(--txt-mid)" }}>
        <Icon name={CAT_ICONS[cat] || "spark"} size={Math.round(size * 0.5)} />
      </span>
    );
  }
  const info = lookupProvider(provider);
  return (
    <span className="logo-tile" style={{ width: size, height: size, borderRadius: radius, background: info.color, fontSize: Math.max(11, Math.round(size * 0.34)) }}>
      {info.short || _initials(info.name)}
    </span>
  );
}

const APP_BILLS = [
  { id: "rent", provider: "Ayala Land", cat: "Rent / Mortgage", icon: "home", amount: 18000, dueDays: 0, dueDate: 1, dueLabel: "Jun 1", status: "due", house: "Main home" },
  { id: "meralco", provider: "Meralco", cat: "Electricity", icon: "zap", amount: 3450, dueDays: 2, dueDate: 2, dueLabel: "Jun 2", status: "due", house: "Main home" },
  { id: "maynilad", provider: "Maynilad", cat: "Water", icon: "droplet", amount: 890, dueDays: 6, dueDate: 6, dueLabel: "Jun 6", status: "due", house: "Main home" },
  { id: "pldt", provider: "PLDT Home", cat: "Internet", icon: "wifi", amount: 1699, dueDays: 6, dueDate: 6, dueLabel: "Jun 6", status: "due", house: "Main home" },
  { id: "globe", provider: "Globe", cat: "Mobile", icon: "smartphone", amount: 1299, dueDays: 12, dueDate: 12, dueLabel: "Jun 12", status: "due", house: "Main home" },
  { id: "condo-meralco", provider: "Meralco", cat: "Electricity", icon: "zap", amount: 1240, dueDays: 9, dueDate: 9, dueLabel: "Jun 9", status: "due", house: "Condo (rental)" },
  { id: "condo-dues", provider: "Condo Assoc.", cat: "Rent / Mortgage", icon: "home", amount: 4500, dueDays: 14, dueDate: 14, dueLabel: "Jun 14", status: "due", house: "Condo (rental)" },
  { id: "bpi", provider: "BPI", cat: "Credit card", icon: "card", amount: 5200, dueDays: 18, dueDate: 18, dueLabel: "Jun 18", status: "due", house: "Main home" },
  { id: "spotify", provider: "Spotify", cat: "Subscription", icon: "spark", amount: 194, dueDays: 25, dueDate: 25, dueLabel: "Jun 25", status: "paid", house: "Main home" },
  { id: "netflix", provider: "Netflix", cat: "Subscription", icon: "spark", amount: 549, dueDays: 28, dueDate: 28, dueLabel: "Jun 28", status: "due", house: "Main home" }
];
const HOUSES = ["Main home", "Condo (rental)", "Parents’ house"];

const HISTORY = {
  meralco: [{ m: "May", a: 3280 }, { m: "Apr", a: 3510 }, { m: "Mar", a: 2990 }],
  maynilad: [{ m: "May", a: 860 }, { m: "Apr", a: 910 }, { m: "Mar", a: 845 }],
  pldt: [{ m: "May", a: 1699 }, { m: "Apr", a: 1699 }, { m: "Mar", a: 1699 }],
  globe: [{ m: "May", a: 1299 }, { m: "Apr", a: 1299 }],
  bpi: [{ m: "May", a: 4820 }, { m: "Apr", a: 6010 }],
  spotify: [{ m: "May", a: 194 }, { m: "Apr", a: 194 }],
  netflix: [{ m: "May", a: 549 }, { m: "Apr", a: 549 }]
};

/* 6-month total outflow trend (synthesized, ends near current) */
const TREND_6MO = [
  { m: "Jan", a: 11240 }, { m: "Feb", a: 12010 }, { m: "Mar", a: 11580 },
  { m: "Apr", a: 12940 }, { m: "May", a: 12150 }, { m: "Jun", a: 13281 }
];

const VOICES = [
  { id: "rachel", name: "Rachel", desc: "Warm · natural", tag: "Default" },
  { id: "antoni", name: "Antoni", desc: "Calm · confident" },
  { id: "bella", name: "Bella", desc: "Soft · friendly" },
  { id: "domi", name: "Domi", desc: "Bold · energetic" },
  { id: "elli", name: "Elli", desc: "Bright · youthful" }
];

const QUICK_ASKS = [
  "What's due this week?",
  "How much do I owe this month?",
  "Did I pay Meralco?",
  "What's my biggest bill?",
  "When's my next due date?"
];

const peso = (n) => "₱" + Math.round(n).toLocaleString("en-US");
const dueClass = (d) => (d <= 3 ? "urgent" : d <= 7 ? "near" : "ok");

Object.assign(window, {
  Icon, PROVIDERS, CAT_COLORS, CAT_ICONS, lookupProvider, ProviderLogo,
  APP_BILLS, HOUSES, HISTORY, TREND_6MO, VOICES, QUICK_ASKS, peso, dueClass
});
