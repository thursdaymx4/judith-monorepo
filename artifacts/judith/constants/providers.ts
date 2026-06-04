/**
 * Country-aware provider data, sample bills, and quick-ask helpers.
 * Self-contained — no imports from constants/data to avoid circular deps.
 */

export interface ProviderEntry {
  name: string;
  color: string;
  short: string;
  cat?: string;
  derived?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════
   Provider sets — keyed by ISO country code
   ═══════════════════════════════════════════════════════════════════════ */

const PH: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "Meralco",          color: "#F5821F", short: "M"  },
    { name: "Visayan Electric", color: "#0a6b3b", short: "VE" },
    { name: "Davao Light",      color: "#0067b1", short: "DL" },
    { name: "CEPALCO",          color: "#004B87", short: "CE" },
  ],
  Water: [
    { name: "Maynilad",     color: "#0067B1", short: "M"  },
    { name: "Manila Water", color: "#00A0AF", short: "MW" },
  ],
  Internet: [
    { name: "PLDT Home",    color: "#C8102E", short: "P"  },
    { name: "Converge",     color: "#F47920", short: "C"  },
    { name: "Globe At Home",color: "#0066B3", short: "G"  },
    { name: "Sky Fiber",    color: "#E5006D", short: "S"  },
    { name: "Starlink",     color: "#1a1a2e", short: "SL" },
  ],
  Mobile: [
    { name: "Globe", color: "#0066B3", short: "G"   },
    { name: "Smart", color: "#00A551", short: "S"   },
    { name: "DITO",  color: "#E5202E", short: "D"   },
    { name: "TM",    color: "#FFB81C", short: "TM"  },
    { name: "TNT",   color: "#E5202E", short: "TNT" },
  ],
  "Credit card": [
    { name: "BPI",           color: "#A6192E", short: "BPI" },
    { name: "BDO",           color: "#00529C", short: "BDO" },
    { name: "Metrobank",     color: "#003DA5", short: "MB"  },
    { name: "UnionBank",     color: "#FF6B00", short: "UB"  },
    { name: "RCBC",          color: "#003C71", short: "R"   },
    { name: "Security Bank", color: "#006B3F", short: "SB"  },
    { name: "Citi",          color: "#056DAE", short: "C"   },
  ],
  "Personal loan": [
    { name: "Home Credit", color: "#D50032", short: "HC"    },
    { name: "Pag-IBIG",    color: "#003087", short: "HDMF"  },
    { name: "BPI",         color: "#A6192E", short: "BPI"   },
    { name: "BDO",         color: "#00529C", short: "BDO"   },
    { name: "CIMB PH",     color: "#C00000", short: "CIMB"  },
  ],
};

const US: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "PG&E",          color: "#003C71", short: "PGE" },
    { name: "Con Edison",    color: "#007DB8", short: "CE"  },
    { name: "Duke Energy",   color: "#008080", short: "DE"  },
    { name: "Ameren",        color: "#0063A3", short: "AM"  },
    { name: "ComEd",         color: "#0078AE", short: "CE"  },
    { name: "FPL",           color: "#007DC6", short: "FPL" },
    { name: "Georgia Power", color: "#0066CC", short: "GP"  },
  ],
  Water: [
    { name: "American Water",  color: "#0066CC", short: "AW" },
    { name: "Veolia",          color: "#9AC31C", short: "V"  },
    { name: "Local utility",   color: "#5b6cff", short: "U"  },
  ],
  Internet: [
    { name: "Xfinity",              color: "#000000", short: "X"  },
    { name: "AT&T Fiber",           color: "#00A8E0", short: "AT" },
    { name: "Spectrum",             color: "#0087C2", short: "Sp" },
    { name: "Verizon Fios",         color: "#CD040B", short: "VZ" },
    { name: "T-Mobile Home Internet", color: "#E20074", short: "TM" },
  ],
  Mobile: [
    { name: "AT&T",          color: "#00A8E0", short: "AT"  },
    { name: "Verizon",       color: "#CD040B", short: "VZ"  },
    { name: "T-Mobile",      color: "#E20074", short: "TM"  },
    { name: "Cricket",       color: "#82BC00", short: "CR"  },
    { name: "Boost Mobile",  color: "#FF6600", short: "BM"  },
  ],
  "Credit card": [
    { name: "Chase",            color: "#117ACA", short: "CH" },
    { name: "American Express", color: "#007BC1", short: "AX" },
    { name: "Capital One",      color: "#C70024", short: "C1" },
    { name: "Citi",             color: "#056DAE", short: "C"  },
    { name: "Bank of America",  color: "#E31837", short: "BA" },
    { name: "Discover",         color: "#FF6600", short: "DS" },
    { name: "Wells Fargo",      color: "#CC0000", short: "WF" },
  ],
  "Personal loan": [
    { name: "SoFi",          color: "#1C4474", short: "SF" },
    { name: "LendingClub",   color: "#4CAF50", short: "LC" },
    { name: "Marcus",        color: "#6D1E75", short: "MR" },
    { name: "Upstart",       color: "#1B3B6F", short: "UP" },
    { name: "Avant",         color: "#003087", short: "AV" },
  ],
};

const SG: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "SP Group",      color: "#E60012", short: "SP" },
    { name: "Senoko Energy", color: "#0066B3", short: "SE" },
    { name: "Geneco",        color: "#00A651", short: "GE" },
    { name: "Sembcorp",      color: "#004EA1", short: "SM" },
  ],
  Water: [
    { name: "PUB", color: "#0066CC", short: "PUB" },
  ],
  Internet: [
    { name: "Singtel",      color: "#E60026", short: "ST" },
    { name: "StarHub",      color: "#7A1FA2", short: "SH" },
    { name: "MyRepublic",   color: "#E5202E", short: "MR" },
    { name: "ViewQwest",    color: "#1B75BB", short: "VQ" },
    { name: "M1",           color: "#00A3E0", short: "M1" },
  ],
  Mobile: [
    { name: "Singtel",       color: "#E60026", short: "ST" },
    { name: "StarHub",       color: "#7A1FA2", short: "SH" },
    { name: "M1",            color: "#00A3E0", short: "M1" },
    { name: "Circles.Life",  color: "#FF007F", short: "CL" },
    { name: "GOMO",          color: "#00C800", short: "GM" },
    { name: "TPG",           color: "#FF6F00", short: "TP" },
  ],
  "Credit card": [
    { name: "DBS/POSB",          color: "#E60012", short: "DBS" },
    { name: "OCBC",              color: "#E31837", short: "OCBC"},
    { name: "UOB",               color: "#003DA5", short: "UOB" },
    { name: "Standard Chartered",color: "#0070AC", short: "SC"  },
    { name: "Citibank SG",       color: "#056DAE", short: "C"   },
    { name: "HSBC SG",           color: "#DB0011", short: "HSBC"},
  ],
  "Personal loan": [
    { name: "DBS",     color: "#E60012", short: "DBS" },
    { name: "OCBC",    color: "#E31837", short: "OCBC"},
    { name: "Maybank", color: "#FBBC0C", short: "MB"  },
    { name: "CIMB SG", color: "#C00000", short: "CIMB"},
  ],
};

const AU: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "AGL",             color: "#E63312", short: "AGL" },
    { name: "Origin Energy",   color: "#0066CC", short: "OR"  },
    { name: "EnergyAustralia", color: "#00A651", short: "EA"  },
    { name: "Red Energy",      color: "#E2001A", short: "RE"  },
    { name: "Alinta Energy",   color: "#005698", short: "AL"  },
  ],
  Water: [
    { name: "Sydney Water",      color: "#0066CC", short: "SW" },
    { name: "Melbourne Water",   color: "#003DA5", short: "MW" },
    { name: "Yarra Valley Water",color: "#00843D", short: "YV" },
    { name: "SA Water",          color: "#005DAA", short: "SA" },
  ],
  Internet: [
    { name: "Telstra",           color: "#005DCA", short: "TL" },
    { name: "Optus",             color: "#F26822", short: "OP" },
    { name: "TPG",               color: "#FF6F00", short: "TP" },
    { name: "iiNet",             color: "#1C3F6E", short: "II" },
    { name: "Aussie Broadband",  color: "#00A651", short: "AB" },
  ],
  Mobile: [
    { name: "Telstra",     color: "#005DCA", short: "TL" },
    { name: "Optus",       color: "#F26822", short: "OP" },
    { name: "Vodafone AU", color: "#E60000", short: "VF" },
    { name: "Boost Mobile AU", color: "#FF6600", short: "BM" },
    { name: "Belong",      color: "#005DCA", short: "BL" },
  ],
  "Credit card": [
    { name: "Commonwealth Bank", color: "#FFC72C", short: "CBA" },
    { name: "ANZ",               color: "#007DBA", short: "ANZ" },
    { name: "Westpac",           color: "#DA1710", short: "WP"  },
    { name: "NAB",               color: "#CC0000", short: "NAB" },
    { name: "Macquarie",         color: "#002F6C", short: "MQ"  },
  ],
  "Personal loan": [
    { name: "Commonwealth Bank", color: "#FFC72C", short: "CBA" },
    { name: "ANZ",               color: "#007DBA", short: "ANZ" },
    { name: "SocietyOne",        color: "#1C4474", short: "S1"  },
    { name: "Plenti",            color: "#1DB954", short: "PL"  },
  ],
};

const GB: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "British Gas",   color: "#0067AC", short: "BG" },
    { name: "E.ON",          color: "#E2001A", short: "EON"},
    { name: "EDF Energy",    color: "#003DA5", short: "EDF"},
    { name: "OVO Energy",    color: "#0A5C36", short: "OVO"},
    { name: "Octopus Energy",color: "#FF6C2F", short: "OE" },
    { name: "Scottish Power",color: "#0046AB", short: "SP" },
  ],
  Water: [
    { name: "Thames Water",   color: "#009FE3", short: "TW" },
    { name: "Severn Trent",   color: "#003DA5", short: "ST" },
    { name: "Anglian Water",  color: "#00529B", short: "AW" },
    { name: "Yorkshire Water",color: "#007AC1", short: "YW" },
    { name: "United Utilities",color: "#002F6C",short: "UU" },
  ],
  Internet: [
    { name: "BT",          color: "#9B53F0", short: "BT" },
    { name: "Sky",         color: "#0D3B73", short: "SK" },
    { name: "Virgin Media",color: "#E40101", short: "VM" },
    { name: "TalkTalk",    color: "#59C9E8", short: "TT" },
    { name: "Plusnet",     color: "#E95B0C", short: "PN" },
  ],
  Mobile: [
    { name: "EE",       color: "#00B0CA", short: "EE" },
    { name: "O2",       color: "#0019A5", short: "O2" },
    { name: "Vodafone", color: "#E60000", short: "VF" },
    { name: "Three",    color: "#0082CA", short: "3"  },
    { name: "giffgaff", color: "#3D7E3A", short: "GG" },
    { name: "Sky Mobile",color:"#0D3B73", short: "SM" },
  ],
  "Credit card": [
    { name: "Barclays",        color: "#00AEEF", short: "BC" },
    { name: "HSBC",            color: "#DB0011", short: "HSBC"},
    { name: "Lloyds",          color: "#024638", short: "LB" },
    { name: "NatWest",         color: "#42145F", short: "NW" },
    { name: "Santander UK",    color: "#EC0000", short: "SN" },
    { name: "American Express",color: "#007BC1", short: "AX" },
  ],
  "Personal loan": [
    { name: "Barclays",  color: "#00AEEF", short: "BC" },
    { name: "Lloyds",    color: "#024638", short: "LB" },
    { name: "Zopa",      color: "#4CAF50", short: "ZO" },
    { name: "Monzo",     color: "#FF4D6A", short: "MZ" },
  ],
};

const CA: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "BC Hydro",       color: "#00529B", short: "BC"  },
    { name: "Ontario Hydro",  color: "#003DA5", short: "OH"  },
    { name: "Hydro-Québec",   color: "#0065BD", short: "HQ"  },
    { name: "Epcor",          color: "#003087", short: "EP"  },
    { name: "Fortis Alberta", color: "#004EA1", short: "FA"  },
  ],
  Water: [
    { name: "Local municipality", color: "#5b6cff", short: "M" },
  ],
  Internet: [
    { name: "Bell",      color: "#003DA5", short: "BL" },
    { name: "Rogers",    color: "#E30000", short: "RO" },
    { name: "Telus",     color: "#4B286D", short: "TE" },
    { name: "Shaw",      color: "#0066CC", short: "SH" },
    { name: "Videotron", color: "#E60026", short: "VD" },
    { name: "Cogeco",    color: "#004B87", short: "CG" },
  ],
  Mobile: [
    { name: "Rogers",         color: "#E30000", short: "RO" },
    { name: "Bell",           color: "#003DA5", short: "BL" },
    { name: "Telus",          color: "#4B286D", short: "TE" },
    { name: "Freedom Mobile", color: "#8DC63F", short: "FM" },
    { name: "Fido",           color: "#E30000", short: "FD" },
    { name: "Public Mobile",  color: "#6ABF4B", short: "PM" },
  ],
  "Credit card": [
    { name: "RBC",          color: "#005DA0", short: "RBC" },
    { name: "TD",           color: "#34A853", short: "TD"  },
    { name: "Scotiabank",   color: "#EC0000", short: "SB"  },
    { name: "BMO",          color: "#0079C1", short: "BMO" },
    { name: "CIBC",         color: "#C41F3A", short: "CIBC"},
    { name: "American Express CA", color: "#007BC1", short: "AX" },
  ],
  "Personal loan": [
    { name: "RBC",        color: "#005DA0", short: "RBC" },
    { name: "TD",         color: "#34A853", short: "TD"  },
    { name: "Scotiabank", color: "#EC0000", short: "SB"  },
    { name: "Mogo",       color: "#00C8A0", short: "MO"  },
  ],
};

const MY: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "TNB",    color: "#007AC1", short: "TNB" },
    { name: "SESB",   color: "#003DA5", short: "SESB"},
  ],
  Water: [
    { name: "Air Selangor", color: "#0066CC", short: "AS" },
    { name: "Syabas",       color: "#005698", short: "SY" },
    { name: "SADA",         color: "#003DA5", short: "SD" },
    { name: "SAJ",          color: "#004B87", short: "SAJ"},
  ],
  Internet: [
    { name: "Unifi (TM)", color: "#E60026", short: "UF" },
    { name: "Maxis",      color: "#E60012", short: "MX" },
    { name: "TIME",       color: "#E5202E", short: "TM" },
    { name: "Celcom",     color: "#003087", short: "CL" },
  ],
  Mobile: [
    { name: "Maxis",    color: "#E60012", short: "MX"  },
    { name: "Celcom",   color: "#003087", short: "CL"  },
    { name: "Digi",     color: "#FFE000", short: "DG"  },
    { name: "U Mobile", color: "#8B0000", short: "UM"  },
    { name: "Hotlink",  color: "#E60012", short: "HL"  },
  ],
  "Credit card": [
    { name: "Maybank",     color: "#FBBC0C", short: "MB"  },
    { name: "CIMB MY",     color: "#C00000", short: "CIMB"},
    { name: "Public Bank", color: "#CC0000", short: "PB"  },
    { name: "RHB",         color: "#005DA0", short: "RHB" },
    { name: "Hong Leong",  color: "#003087", short: "HL"  },
  ],
  "Personal loan": [
    { name: "Maybank", color: "#FBBC0C", short: "MB"  },
    { name: "CIMB MY", color: "#C00000", short: "CIMB"},
    { name: "RHB",     color: "#005DA0", short: "RHB" },
  ],
};

const ID: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "PLN", color: "#003DA5", short: "PLN" },
  ],
  Water: [
    { name: "PDAM Jaya",        color: "#0066CC", short: "PDAM"},
    { name: "PDAM Tirta Pakuan",color: "#004B87", short: "TP"  },
  ],
  Internet: [
    { name: "IndiHome",    color: "#CC0000", short: "IH" },
    { name: "MyRepublic",  color: "#E5202E", short: "MR" },
    { name: "Biznet",      color: "#E60026", short: "BZ" },
    { name: "First Media", color: "#003DA5", short: "FM" },
    { name: "Iconnet",     color: "#003087", short: "IC" },
  ],
  Mobile: [
    { name: "Telkomsel",color: "#E60012", short: "TK"  },
    { name: "Indosat",  color: "#F57920", short: "IM"  },
    { name: "XL",       color: "#0041A8", short: "XL"  },
    { name: "Tri",      color: "#0082CA", short: "3"   },
    { name: "Smartfren",color: "#E5202E", short: "SF"  },
  ],
  "Credit card": [
    { name: "BCA",         color: "#006CB7", short: "BCA" },
    { name: "Bank Mandiri",color: "#0C3062", short: "MD"  },
    { name: "BNI",         color: "#E60026", short: "BNI" },
    { name: "BRI",         color: "#003DA5", short: "BRI" },
    { name: "CIMB Niaga",  color: "#C00000", short: "CIMB"},
  ],
  "Personal loan": [
    { name: "BCA",         color: "#006CB7", short: "BCA" },
    { name: "Bank Mandiri",color: "#0C3062", short: "MD"  },
    { name: "Kredivo",     color: "#4CAF50", short: "KR"  },
    { name: "Akulaku",     color: "#1DB954", short: "AK"  },
  ],
};

const IN: Record<string, ProviderEntry[]> = {
  Electricity: [
    { name: "BSES",    color: "#E91E63", short: "BSES"},
    { name: "Tata Power",color: "#0D3692",short: "TP"  },
    { name: "MSEDCL",  color: "#CC0000", short: "MSED"},
    { name: "BESCOM",  color: "#005DA0", short: "BES" },
    { name: "TNEB",    color: "#003087", short: "TNEB"},
  ],
  Water: [
    { name: "Local municipality", color: "#5b6cff", short: "M" },
  ],
  Internet: [
    { name: "JioFiber",    color: "#006EB7", short: "JF" },
    { name: "Airtel",      color: "#FF0000", short: "AT" },
    { name: "ACT Fibernet",color: "#E60026", short: "AC" },
    { name: "BSNL",        color: "#003DA5", short: "BSN"},
  ],
  Mobile: [
    { name: "Jio",     color: "#006EB7", short: "JO" },
    { name: "Airtel",  color: "#FF0000", short: "AT" },
    { name: "Vi",      color: "#E60026", short: "Vi" },
    { name: "BSNL",    color: "#003DA5", short: "BSN"},
  ],
  "Credit card": [
    { name: "HDFC",     color: "#004C8F", short: "HDFC"},
    { name: "ICICI",    color: "#EA712A", short: "ICICI"},
    { name: "SBI",      color: "#22409A", short: "SBI" },
    { name: "Axis",     color: "#C84B31", short: "AX"  },
    { name: "Kotak",    color: "#EF3D40", short: "KO"  },
    { name: "IndusInd", color: "#005DA0", short: "IIB" },
  ],
  "Personal loan": [
    { name: "HDFC",    color: "#004C8F", short: "HDFC" },
    { name: "SBI",     color: "#22409A", short: "SBI"  },
    { name: "Bajaj",   color: "#E30B13", short: "BJ"   },
    { name: "MoneyTap",color: "#4CAF50", short: "MT"   },
  ],
};

/* ── Global subscriptions (country-agnostic) ── */
const SUBSCRIPTION_GLOBAL: ProviderEntry[] = [
  { name: "Netflix",         color: "#E50914", short: "N"  },
  { name: "Spotify",         color: "#1DB954", short: "S"  },
  { name: "YouTube Premium", color: "#FF0000", short: "YT" },
  { name: "Disney+",         color: "#113CCF", short: "D+" },
  { name: "Apple One",       color: "#4d4d4f", short: "AO" },
  { name: "iCloud+",         color: "#3b8bea", short: "iC" },
  { name: "Max",             color: "#0046FF", short: "M"  },
  { name: "Prime Video",     color: "#00A8E1", short: "P"  },
  { name: "Canva",           color: "#00C4CC", short: "C"  },
  { name: "Notion",          color: "#3f3f3f", short: "N"  },
  { name: "Google One",      color: "#4285F4", short: "G"  },
  { name: "Microsoft 365",   color: "#D83B01", short: "MS" },
  { name: "Dropbox",         color: "#0061FF", short: "DB" },
  { name: "ChatGPT Plus",    color: "#10A37F", short: "GP" },
  { name: "Adobe CC",        color: "#FF0000", short: "AC" },
];

/* ── Master lookup ── */
const COUNTRY_PROVIDERS: Record<string, Record<string, ProviderEntry[]>> = {
  PH, US, SG, AU, GB, CA, MY, ID, IN,
};

/* ═══════════════════════════════════════════════════════════════════════
   Public provider helpers
   ═══════════════════════════════════════════════════════════════════════ */

export function getProviders(countryCode: string, cat: string): ProviderEntry[] {
  if (cat === "Subscription") return SUBSCRIPTION_GLOBAL;
  return (
    COUNTRY_PROVIDERS[countryCode]?.[cat] ??
    COUNTRY_PROVIDERS["US"]![cat] ??
    []
  );
}

export function getProviderPlaceholder(countryCode: string, cat: string): string {
  const p = getProviders(countryCode, cat)[0];
  return p ? `e.g. ${p.name}` : "e.g. your provider";
}

/** All providers across all countries — for lookupProvider brand-color search. */
export function getAllProviderEntries(): ProviderEntry[] {
  const seen = new Set<string>();
  const out: ProviderEntry[] = [];
  for (const set of Object.values(COUNTRY_PROVIDERS)) {
    for (const list of Object.values(set)) {
      for (const p of list) {
        if (!seen.has(p.name)) { seen.add(p.name); out.push(p); }
      }
    }
  }
  for (const p of SUBSCRIPTION_GLOBAL) {
    if (!seen.has(p.name)) { seen.add(p.name); out.push(p); }
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   Quick asks — country-aware
   ═══════════════════════════════════════════════════════════════════════ */

export function getQuickAsks(countryCode: string): string[] {
  const elec = getProviders(countryCode, "Electricity")[0]?.name ?? "electricity";
  const cc   = getProviders(countryCode, "Credit card")[0]?.name ?? "credit card";
  return [
    "What's due this week?",
    "How much do I owe this month?",
    `Did I pay ${elec}?`,
    `What's my ${cc} balance?`,
    "When's my next due date?",
  ];
}

/* ═══════════════════════════════════════════════════════════════════════
   Onboarding sample bills — country-aware
   ═══════════════════════════════════════════════════════════════════════ */

export interface OBSample {
  group: number;
  provider: string;
  cat: string;
  icon: string;
  amount: number;
  due: string;
  dueDays: number;
  subtype?: string;
  utter: string;
  toks: string[];
}

export interface OBCardLoan {
  provider: string;
  amount: number;
  due: string;
  dueDays: number;
  utter: string;
  toks: string[];
}

const SAMPLES_PH: OBSample[] = [
  { group: 0, provider: "Ayala Land",    cat: "Rent / Mortgage", subtype: "Rent", icon: "home",       amount: 18000, due: "1st",  dueDays: 1,  utter: "My rent, eighteen thousand, due every 1st.",             toks: ["rent", "eighteen thousand", "1st"] },
  { group: 0, provider: "Meralco",       cat: "Electricity",                      icon: "zap",        amount: 3450,  due: "15th", dueDays: 6,  utter: "My Meralco, around three thousand four fifty, due every 15th.", toks: ["Meralco", "three thousand four fifty", "15th"] },
  { group: 0, provider: "Maynilad",      cat: "Water",                            icon: "droplet",    amount: 890,   due: "22nd", dueDays: 13, utter: "Then Maynilad water, about eight ninety, every 22nd.",       toks: ["Maynilad", "eight ninety", "22nd"] },
  { group: 0, provider: "PLDT Home",     cat: "Internet",                         icon: "wifi",       amount: 1699,  due: "5th",  dueDays: 25, utter: "My PLDT internet, 1,699, on the 5th.",                     toks: ["PLDT", "1,699", "5th"] },
  { group: 1, provider: "Globe Postpaid",cat: "Mobile",                           icon: "smartphone", amount: 1299,  due: "18th", dueDays: 8,  utter: "My Globe phone plan, 1,299, every 18th.",                  toks: ["Globe", "1,299", "18th"] },
  { group: 1, provider: "iCloud+",       cat: "Phone subscription",               icon: "spark",      amount: 149,   due: "1st",  dueDays: 14, utter: "iCloud storage, 149, on the 1st.",                        toks: ["iCloud", "149", "1st"] },
  { group: 1, provider: "Canva Pro",     cat: "Web app",                          icon: "spark",      amount: 199,   due: "9th",  dueDays: 22, utter: "Canva Pro, 199, every 9th?",                              toks: ["Canva", "199", "9th"] },
  { group: 2, provider: "Maxicare",      cat: "Insurance",                        icon: "lock",       amount: 1500,  due: "15th", dueDays: 11, utter: "My Maxicare HMO, 1,500 a month, due every 15th.",           toks: ["Maxicare", "1,500", "15th"] },
  { group: 2, provider: "MAPFRE",        cat: "Insurance",                        icon: "lock",       amount: 800,   due: "1st",  dueDays: 27, utter: "Car insurance with MAPFRE, about nine thousand a year.",     toks: ["MAPFRE", "car insurance", "nine thousand"] },
];

const SAMPLES_US: OBSample[] = [
  { group: 0, provider: "Your Landlord",  cat: "Rent / Mortgage", subtype: "Rent", icon: "home",       amount: 1800, due: "1st",  dueDays: 1,  utter: "My rent, eighteen hundred, due the 1st.",               toks: ["rent", "eighteen hundred", "1st"] },
  { group: 0, provider: "PG&E",           cat: "Electricity",                      icon: "zap",        amount: 120,  due: "15th", dueDays: 6,  utter: "My PG&E, around one twenty, due the 15th.",             toks: ["PG&E", "one twenty", "15th"] },
  { group: 0, provider: "Local utility",  cat: "Water",                            icon: "droplet",    amount: 55,   due: "22nd", dueDays: 13, utter: "Water bill, around fifty-five, every 22nd.",             toks: ["water", "fifty-five", "22nd"] },
  { group: 0, provider: "Xfinity",        cat: "Internet",                         icon: "wifi",       amount: 79,   due: "5th",  dueDays: 25, utter: "My Xfinity internet, seventy-nine, on the 5th.",         toks: ["Xfinity", "seventy-nine", "5th"] },
  { group: 1, provider: "AT&T",           cat: "Mobile",                           icon: "smartphone", amount: 65,   due: "18th", dueDays: 8,  utter: "My AT&T phone plan, sixty-five, every 18th.",            toks: ["AT&T", "sixty-five", "18th"] },
  { group: 1, provider: "iCloud+",        cat: "Phone subscription",               icon: "spark",      amount: 3,    due: "1st",  dueDays: 14, utter: "iCloud Plus, three dollars, on the 1st.",               toks: ["iCloud", "three dollars", "1st"] },
  { group: 1, provider: "Microsoft 365",  cat: "Web app",                          icon: "spark",      amount: 10,   due: "9th",  dueDays: 22, utter: "Microsoft 365, ten dollars, every 9th?",                toks: ["Microsoft", "ten dollars", "9th"] },
  { group: 2, provider: "Blue Shield",    cat: "Insurance",                        icon: "lock",       amount: 380,  due: "1st",  dueDays: 27, utter: "My Blue Shield health insurance, three-eighty a month, due the 1st.", toks: ["Blue Shield", "three-eighty", "1st"] },
  { group: 2, provider: "GEICO",          cat: "Insurance",                        icon: "lock",       amount: 110,  due: "15th", dueDays: 11, utter: "GEICO car insurance, one-ten a month, due the 15th.",    toks: ["GEICO", "one-ten", "15th"] },
];

const SAMPLES_SG: OBSample[] = [
  { group: 0, provider: "Your Landlord", cat: "Rent / Mortgage", subtype: "Rent", icon: "home",       amount: 2500, due: "1st",  dueDays: 1,  utter: "My rent, two thousand five hundred, due the 1st.",          toks: ["rent", "two thousand five hundred", "1st"] },
  { group: 0, provider: "SP Group",     cat: "Electricity",                       icon: "zap",        amount: 120,  due: "15th", dueDays: 6,  utter: "SP Group bill, around one twenty, due the 15th.",           toks: ["SP Group", "one twenty", "15th"] },
  { group: 0, provider: "PUB",          cat: "Water",                             icon: "droplet",    amount: 35,   due: "22nd", dueDays: 13, utter: "PUB water, around thirty-five, every 22nd.",                toks: ["PUB", "thirty-five", "22nd"] },
  { group: 0, provider: "Singtel",      cat: "Internet",                          icon: "wifi",       amount: 50,   due: "5th",  dueDays: 25, utter: "My Singtel fibre, fifty dollars, on the 5th.",              toks: ["Singtel", "fifty", "5th"] },
  { group: 1, provider: "StarHub",      cat: "Mobile",                            icon: "smartphone", amount: 45,   due: "18th", dueDays: 8,  utter: "StarHub mobile, forty-five dollars, every 18th.",           toks: ["StarHub", "forty-five", "18th"] },
  { group: 1, provider: "iCloud+",      cat: "Phone subscription",                icon: "spark",      amount: 4,    due: "1st",  dueDays: 14, utter: "iCloud Plus, four dollars, on the 1st.",                   toks: ["iCloud", "four dollars", "1st"] },
  { group: 1, provider: "Google One",   cat: "Web app",                           icon: "spark",      amount: 3,    due: "9th",  dueDays: 22, utter: "Google One, three dollars, every 9th?",                    toks: ["Google One", "three dollars", "9th"] },
  { group: 2, provider: "Prudential",   cat: "Insurance",                         icon: "lock",       amount: 120,  due: "15th", dueDays: 11, utter: "Prudential health insurance, one-twenty a month, due the 15th.", toks: ["Prudential", "one-twenty", "15th"] },
  { group: 2, provider: "AXA",          cat: "Insurance",                         icon: "lock",       amount: 90,   due: "1st",  dueDays: 27, utter: "AXA car insurance, ninety dollars a month, due the 1st.",   toks: ["AXA", "ninety", "1st"] },
];

const SAMPLES_AU: OBSample[] = [
  { group: 0, provider: "Your Landlord",   cat: "Rent / Mortgage", subtype: "Rent", icon: "home",       amount: 2200, due: "1st",  dueDays: 1,  utter: "My rent, twenty-two hundred, due the 1st.",              toks: ["rent", "twenty-two hundred", "1st"] },
  { group: 0, provider: "AGL",             cat: "Electricity",                      icon: "zap",        amount: 180,  due: "15th", dueDays: 6,  utter: "AGL electricity, around one eighty, due the 15th.",      toks: ["AGL", "one eighty", "15th"] },
  { group: 0, provider: "Sydney Water",    cat: "Water",                            icon: "droplet",    amount: 70,   due: "22nd", dueDays: 13, utter: "Sydney Water, around seventy, every 22nd.",              toks: ["Sydney Water", "seventy", "22nd"] },
  { group: 0, provider: "Telstra",         cat: "Internet",                         icon: "wifi",       amount: 89,   due: "5th",  dueDays: 25, utter: "Telstra internet, eighty-nine, on the 5th.",             toks: ["Telstra", "eighty-nine", "5th"] },
  { group: 1, provider: "Optus",           cat: "Mobile",                           icon: "smartphone", amount: 55,   due: "18th", dueDays: 8,  utter: "Optus mobile, fifty-five, every 18th.",                  toks: ["Optus", "fifty-five", "18th"] },
  { group: 1, provider: "iCloud+",         cat: "Phone subscription",               icon: "spark",      amount: 5,    due: "1st",  dueDays: 14, utter: "iCloud Plus, five dollars, on the 1st.",                toks: ["iCloud", "five dollars", "1st"] },
  { group: 1, provider: "Microsoft 365",   cat: "Web app",                          icon: "spark",      amount: 11,   due: "9th",  dueDays: 22, utter: "Microsoft 365, eleven dollars, every 9th?",             toks: ["Microsoft", "eleven dollars", "9th"] },
  { group: 2, provider: "Medibank",        cat: "Insurance",                        icon: "lock",       amount: 150,  due: "15th", dueDays: 11, utter: "My Medibank health insurance, one-fifty a month, due the 15th.", toks: ["Medibank", "one-fifty", "15th"] },
  { group: 2, provider: "NRMA",            cat: "Insurance",                        icon: "lock",       amount: 120,  due: "1st",  dueDays: 27, utter: "NRMA car insurance, one-twenty a month, due the 1st.",  toks: ["NRMA", "one-twenty", "1st"] },
];

const SAMPLES_GB: OBSample[] = [
  { group: 0, provider: "Your Landlord",  cat: "Rent / Mortgage", subtype: "Rent", icon: "home",       amount: 1400, due: "1st",  dueDays: 1,  utter: "My rent, fourteen hundred, due the 1st.",             toks: ["rent", "fourteen hundred", "1st"] },
  { group: 0, provider: "British Gas",    cat: "Electricity",                      icon: "zap",        amount: 120,  due: "15th", dueDays: 6,  utter: "British Gas, around one twenty, due the 15th.",       toks: ["British Gas", "one twenty", "15th"] },
  { group: 0, provider: "Thames Water",   cat: "Water",                            icon: "droplet",    amount: 45,   due: "22nd", dueDays: 13, utter: "Thames Water, around forty-five, every 22nd.",        toks: ["Thames Water", "forty-five", "22nd"] },
  { group: 0, provider: "BT",             cat: "Internet",                         icon: "wifi",       amount: 40,   due: "5th",  dueDays: 25, utter: "BT broadband, forty pounds, on the 5th.",             toks: ["BT", "forty", "5th"] },
  { group: 1, provider: "EE",             cat: "Mobile",                           icon: "smartphone", amount: 30,   due: "18th", dueDays: 8,  utter: "EE mobile, thirty pounds, every 18th.",               toks: ["EE", "thirty", "18th"] },
  { group: 1, provider: "iCloud+",        cat: "Phone subscription",               icon: "spark",      amount: 3,    due: "1st",  dueDays: 14, utter: "iCloud Plus, three pounds, on the 1st.",             toks: ["iCloud", "three pounds", "1st"] },
  { group: 1, provider: "Microsoft 365",  cat: "Web app",                          icon: "spark",      amount: 8,    due: "9th",  dueDays: 22, utter: "Microsoft 365, eight pounds, every 9th?",              toks: ["Microsoft", "eight pounds", "9th"] },
  { group: 2, provider: "AXA Health",     cat: "Insurance",                        icon: "lock",       amount: 45,   due: "15th", dueDays: 11, utter: "AXA Health, forty-five pounds a month, due the 15th.", toks: ["AXA", "forty-five", "15th"] },
  { group: 2, provider: "Direct Line",    cat: "Insurance",                        icon: "lock",       amount: 65,   due: "1st",  dueDays: 27, utter: "Direct Line car insurance, sixty-five pounds a month, due the 1st.", toks: ["Direct Line", "sixty-five", "1st"] },
];

const SAMPLES_CA: OBSample[] = [
  { group: 0, provider: "Your Landlord",  cat: "Rent / Mortgage", subtype: "Rent", icon: "home",       amount: 2000, due: "1st",  dueDays: 1,  utter: "My rent, two thousand, due the 1st.",                 toks: ["rent", "two thousand", "1st"] },
  { group: 0, provider: "BC Hydro",       cat: "Electricity",                      icon: "zap",        amount: 110,  due: "15th", dueDays: 6,  utter: "BC Hydro, around one ten, due the 15th.",             toks: ["BC Hydro", "one ten", "15th"] },
  { group: 0, provider: "Local municipality", cat: "Water",                        icon: "droplet",    amount: 50,   due: "22nd", dueDays: 13, utter: "Water bill, around fifty, every 22nd.",               toks: ["water", "fifty", "22nd"] },
  { group: 0, provider: "Bell",           cat: "Internet",                         icon: "wifi",       amount: 85,   due: "5th",  dueDays: 25, utter: "Bell internet, eighty-five, on the 5th.",             toks: ["Bell", "eighty-five", "5th"] },
  { group: 1, provider: "Rogers",         cat: "Mobile",                           icon: "smartphone", amount: 65,   due: "18th", dueDays: 8,  utter: "Rogers mobile, sixty-five, every 18th.",              toks: ["Rogers", "sixty-five", "18th"] },
  { group: 1, provider: "iCloud+",        cat: "Phone subscription",               icon: "spark",      amount: 4,    due: "1st",  dueDays: 14, utter: "iCloud Plus, four dollars, on the 1st.",             toks: ["iCloud", "four dollars", "1st"] },
  { group: 1, provider: "Microsoft 365",  cat: "Web app",                          icon: "spark",      amount: 10,   due: "9th",  dueDays: 22, utter: "Microsoft 365, ten dollars, every 9th?",              toks: ["Microsoft", "ten dollars", "9th"] },
  { group: 2, provider: "Manulife",       cat: "Insurance",                        icon: "lock",       amount: 180,  due: "15th", dueDays: 11, utter: "My Manulife health insurance, one-eighty a month, due the 15th.", toks: ["Manulife", "one-eighty", "15th"] },
  { group: 2, provider: "Intact",         cat: "Insurance",                        icon: "lock",       amount: 120,  due: "1st",  dueDays: 27, utter: "Intact car insurance, one-twenty a month, due the 1st.", toks: ["Intact", "one-twenty", "1st"] },
];

const SAMPLES_MAP: Record<string, OBSample[]> = {
  PH: SAMPLES_PH,
  US: SAMPLES_US,
  SG: SAMPLES_SG,
  AU: SAMPLES_AU,
  GB: SAMPLES_GB,
  CA: SAMPLES_CA,
};

export function getSamples(countryCode: string): OBSample[] {
  return SAMPLES_MAP[countryCode] ?? SAMPLES_US;
}

/* ─── Credit card templates ─── */

const CARD_PH: OBCardLoan[] = [
  { provider: "BPI Mastercard", amount: 5200, due: "20th", dueDays: 4,  utter: "My BPI Mastercard, 5,200 due, on the 20th.",    toks: ["BPI", "5,200", "20th"] },
  { provider: "BDO Visa",       amount: 3100, due: "25th", dueDays: 9,  utter: "BDO Visa, around 3,100, the 25th.",             toks: ["BDO", "3,100", "25th"] },
  { provider: "Metrobank",      amount: 2800, due: "10th", dueDays: 23, utter: "Metrobank card, about 2,800, the 10th.",        toks: ["Metrobank", "2,800", "10th"] },
  { provider: "UnionBank",      amount: 1950, due: "15th", dueDays: 6,  utter: "UnionBank, 1,950, every 15th.",                 toks: ["UnionBank", "1,950", "15th"] },
];

const CARD_US: OBCardLoan[] = [
  { provider: "Chase Sapphire", amount: 850,  due: "20th", dueDays: 4,  utter: "My Chase card, 850 due, on the 20th.",         toks: ["Chase", "850", "20th"] },
  { provider: "Capital One",    amount: 420,  due: "25th", dueDays: 9,  utter: "Capital One, around 420, the 25th.",            toks: ["Capital One", "420", "25th"] },
  { provider: "Citi",           amount: 380,  due: "10th", dueDays: 23, utter: "Citi card, about 380, the 10th.",               toks: ["Citi", "380", "10th"] },
  { provider: "Discover",       amount: 290,  due: "15th", dueDays: 6,  utter: "Discover, 290, every 15th.",                    toks: ["Discover", "290", "15th"] },
];

const CARD_SG: OBCardLoan[] = [
  { provider: "DBS/POSB",        amount: 600,  due: "20th", dueDays: 4,  utter: "My DBS card, 600 due, on the 20th.",           toks: ["DBS", "600", "20th"] },
  { provider: "OCBC",            amount: 380,  due: "25th", dueDays: 9,  utter: "OCBC card, around 380, the 25th.",             toks: ["OCBC", "380", "25th"] },
  { provider: "UOB",             amount: 520,  due: "10th", dueDays: 23, utter: "UOB card, about 520, the 10th.",               toks: ["UOB", "520", "10th"] },
  { provider: "Citibank SG",     amount: 290,  due: "15th", dueDays: 6,  utter: "Citi, 290, every 15th.",                       toks: ["Citi", "290", "15th"] },
];

const CARD_AU: OBCardLoan[] = [
  { provider: "Commonwealth Bank", amount: 900,  due: "20th", dueDays: 4,  utter: "My CommBank card, 900 due, on the 20th.",    toks: ["CommBank", "900", "20th"] },
  { provider: "ANZ",               amount: 550,  due: "25th", dueDays: 9,  utter: "ANZ, around 550, the 25th.",                 toks: ["ANZ", "550", "25th"] },
  { provider: "Westpac",           amount: 430,  due: "10th", dueDays: 23, utter: "Westpac, about 430, the 10th.",               toks: ["Westpac", "430", "10th"] },
  { provider: "NAB",               amount: 310,  due: "15th", dueDays: 6,  utter: "NAB, 310, every 15th.",                      toks: ["NAB", "310", "15th"] },
];

const CARD_GB: OBCardLoan[] = [
  { provider: "Barclays",        amount: 450,  due: "20th", dueDays: 4,  utter: "My Barclays card, 450 due, on the 20th.",      toks: ["Barclays", "450", "20th"] },
  { provider: "HSBC",            amount: 320,  due: "25th", dueDays: 9,  utter: "HSBC, around 320, the 25th.",                  toks: ["HSBC", "320", "25th"] },
  { provider: "Lloyds",          amount: 280,  due: "10th", dueDays: 23, utter: "Lloyds card, about 280, the 10th.",            toks: ["Lloyds", "280", "10th"] },
  { provider: "NatWest",         amount: 190,  due: "15th", dueDays: 6,  utter: "NatWest, 190, every 15th.",                    toks: ["NatWest", "190", "15th"] },
];

const CARD_CA: OBCardLoan[] = [
  { provider: "RBC",             amount: 750,  due: "20th", dueDays: 4,  utter: "My RBC card, 750 due, on the 20th.",           toks: ["RBC", "750", "20th"] },
  { provider: "TD",              amount: 480,  due: "25th", dueDays: 9,  utter: "TD card, around 480, the 25th.",               toks: ["TD", "480", "25th"] },
  { provider: "Scotiabank",      amount: 360,  due: "10th", dueDays: 23, utter: "Scotiabank, about 360, the 10th.",             toks: ["Scotiabank", "360", "10th"] },
  { provider: "CIBC",            amount: 240,  due: "15th", dueDays: 6,  utter: "CIBC, 240, every 15th.",                       toks: ["CIBC", "240", "15th"] },
];

const CARD_MAP: Record<string, OBCardLoan[]> = {
  PH: CARD_PH, US: CARD_US, SG: CARD_SG, AU: CARD_AU, GB: CARD_GB, CA: CARD_CA,
};

export function getCardTemplates(countryCode: string): OBCardLoan[] {
  return CARD_MAP[countryCode] ?? CARD_US;
}

/* ─── Loan templates ─── */

const LOAN_PH: OBCardLoan[] = [
  { provider: "Home Credit",     amount: 2400,  due: "3rd",  dueDays: 16, utter: "Home Credit loan, 2,400 a month, on the 3rd.",       toks: ["Home Credit", "2,400", "3rd"] },
  { provider: "Pag-IBIG",        amount: 1800,  due: "7th",  dueDays: 20, utter: "Pag-IBIG housing loan, 1,800, the 7th.",             toks: ["Pag-IBIG", "1,800", "7th"] },
  { provider: "Car loan · BPI",  amount: 12500, due: "12th", dueDays: 2,  utter: "Car loan with BPI, 12,500, the 12th.",               toks: ["BPI", "12,500", "12th"] },
];

const LOAN_US: OBCardLoan[] = [
  { provider: "SoFi",                   amount: 350,  due: "3rd",  dueDays: 16, utter: "SoFi personal loan, 350 a month, on the 3rd.",    toks: ["SoFi", "350", "3rd"] },
  { provider: "Car loan · Chase",       amount: 520,  due: "7th",  dueDays: 20, utter: "Car loan with Chase, 520, the 7th.",              toks: ["Chase", "520", "7th"] },
  { provider: "Mortgage · Wells Fargo", amount: 1950, due: "12th", dueDays: 2,  utter: "Mortgage with Wells Fargo, 1,950, the 12th.",     toks: ["Wells Fargo", "1,950", "12th"] },
];

const LOAN_SG: OBCardLoan[] = [
  { provider: "DBS personal loan", amount: 500,  due: "3rd",  dueDays: 16, utter: "DBS personal loan, 500 a month, on the 3rd.",       toks: ["DBS", "500", "3rd"] },
  { provider: "Car loan · OCBC",   amount: 900,  due: "7th",  dueDays: 20, utter: "Car loan with OCBC, 900, the 7th.",                 toks: ["OCBC", "900", "7th"] },
  { provider: "HDB loan",          amount: 1200, due: "12th", dueDays: 2,  utter: "HDB housing loan, 1,200, the 12th.",                toks: ["HDB", "1,200", "12th"] },
];

const LOAN_AU: OBCardLoan[] = [
  { provider: "Commonwealth Bank",  amount: 450,  due: "3rd",  dueDays: 16, utter: "CommBank personal loan, 450 a month, on the 3rd.", toks: ["CommBank", "450", "3rd"] },
  { provider: "Car loan · ANZ",     amount: 650,  due: "7th",  dueDays: 20, utter: "Car loan with ANZ, 650, the 7th.",                 toks: ["ANZ", "650", "7th"] },
  { provider: "Mortgage · Westpac", amount: 2200, due: "12th", dueDays: 2,  utter: "Mortgage with Westpac, 2,200, the 12th.",          toks: ["Westpac", "2,200", "12th"] },
];

const LOAN_GB: OBCardLoan[] = [
  { provider: "Barclays personal loan", amount: 300,  due: "3rd",  dueDays: 16, utter: "Barclays personal loan, 300 a month, on the 3rd.", toks: ["Barclays", "300", "3rd"] },
  { provider: "Car loan · HSBC",        amount: 400,  due: "7th",  dueDays: 20, utter: "Car loan with HSBC, 400, the 7th.",               toks: ["HSBC", "400", "7th"] },
  { provider: "Mortgage · Nationwide",  amount: 1100, due: "12th", dueDays: 2,  utter: "Mortgage with Nationwide, 1,100, the 12th.",       toks: ["Nationwide", "1,100", "12th"] },
];

const LOAN_CA: OBCardLoan[] = [
  { provider: "RBC personal loan",      amount: 400,  due: "3rd",  dueDays: 16, utter: "RBC personal loan, 400 a month, on the 3rd.",     toks: ["RBC", "400", "3rd"] },
  { provider: "Car loan · TD",          amount: 550,  due: "7th",  dueDays: 20, utter: "Car loan with TD, 550, the 7th.",                 toks: ["TD", "550", "7th"] },
  { provider: "Mortgage · Scotiabank",  amount: 1800, due: "12th", dueDays: 2,  utter: "Mortgage with Scotiabank, 1,800, the 12th.",       toks: ["Scotiabank", "1,800", "12th"] },
];

const LOAN_MAP: Record<string, OBCardLoan[]> = {
  PH: LOAN_PH, US: LOAN_US, SG: LOAN_SG, AU: LOAN_AU, GB: LOAN_GB, CA: LOAN_CA,
};

export function getLoanTemplates(countryCode: string): OBCardLoan[] {
  return LOAN_MAP[countryCode] ?? LOAN_US;
}

/* ═══════════════════════════════════════════════════════════════════════
   Feature-screen demo Q&A — country-aware
   ═══════════════════════════════════════════════════════════════════════ */

export interface DLocal {
  askQ: string;
  askA: string;
  askQ2: string;
  askA2: string;
  askQ3: string;
  askA3: string;
}

type DLocalFn = (cur: string) => DLocal;

const DLOCAL_PH: DLocalFn = (cur) => ({
  askQ:  `\u201cJudith, what\u2019s my total credit card bill next month?\u201d`,
  askA:  `\u201c${cur}8,300 across BPI and BDO \u2014 both due before the 25th. Want a heads-up?\u201d`,
  askQ2: `\u201cJudith, which bills are due this week?\u201d`,
  askA2: `\u201cThree \u2014 Meralco, PLDT and your condo dues. ${cur}5,830 total. Want me to remind you the day before each?\u201d`,
  askQ3: `\u201cJudith, I\u2019ve got ${cur}30,000 left this month \u2014 can I afford ${cur}5,000 for a trip this week?\u201d`,
  askA3: `\u201cYou can, but keep it tight \u2014 ${cur}8,800 is due by Friday. After the trip you\u2019d have ${cur}16,200 to cover the rest. Go, just don\u2019t touch the bill money.\u201d`,
});

const DLOCAL_US: DLocalFn = (cur) => ({
  askQ:  `\u201cJudith, what\u2019s my total credit card bill next month?\u201d`,
  askA:  `\u201c${cur}1,270 across Chase and Capital One \u2014 both due before the 25th. Want a heads-up?\u201d`,
  askQ2: `\u201cJudith, which bills are due this week?\u201d`,
  askA2: `\u201cThree \u2014 PG&E, Xfinity and your rent. ${cur}1,999 total. Want me to remind you the day before each?\u201d`,
  askQ3: `\u201cJudith, I\u2019ve got ${cur}4,000 left this month \u2014 can I afford ${cur}800 for a trip this week?\u201d`,
  askA3: `\u201cYou can, but keep it tight \u2014 ${cur}1,400 is due by Friday. After the trip you\u2019d have ${cur}1,800 to cover the rest. Go, just don\u2019t touch the bill money.\u201d`,
});

const DLOCAL_SG: DLocalFn = (cur) => ({
  askQ:  `\u201cJudith, what\u2019s my total credit card bill next month?\u201d`,
  askA:  `\u201c${cur}1,100 across DBS and OCBC \u2014 both due before the 25th. Want a heads-up?\u201d`,
  askQ2: `\u201cJudith, which bills are due this week?\u201d`,
  askA2: `\u201cThree \u2014 SP Group, Singtel and your rent. ${cur}2,670 total. Want me to remind you the day before each?\u201d`,
  askQ3: `\u201cJudith, I\u2019ve got ${cur}5,000 left this month \u2014 can I afford ${cur}800 for a trip this week?\u201d`,
  askA3: `\u201cYou can, but keep it tight \u2014 ${cur}1,800 is due by Friday. After the trip you\u2019d have ${cur}2,400 to cover the rest. Go, just don\u2019t touch the bill money.\u201d`,
});

const DLOCAL_AU: DLocalFn = (cur) => ({
  askQ:  `\u201cJudith, what\u2019s my total credit card bill next month?\u201d`,
  askA:  `\u201c${cur}1,450 across CommBank and ANZ \u2014 both due before the 25th. Want a heads-up?\u201d`,
  askQ2: `\u201cJudith, which bills are due this week?\u201d`,
  askA2: `\u201cThree \u2014 AGL, Telstra and your rent. ${cur}2,369 total. Want me to remind you the day before each?\u201d`,
  askQ3: `\u201cJudith, I\u2019ve got ${cur}6,000 left this month \u2014 can I afford ${cur}1,000 for a trip this week?\u201d`,
  askA3: `\u201cYou can, but keep it tight \u2014 ${cur}2,289 is due by Friday. After the trip you\u2019d have ${cur}2,711 to cover the rest. Go, just don\u2019t touch the bill money.\u201d`,
});

const DLOCAL_GB: DLocalFn = (cur) => ({
  askQ:  `\u201cJudith, what\u2019s my total credit card bill next month?\u201d`,
  askA:  `\u201c${cur}770 across Barclays and HSBC \u2014 both due before the 25th. Want a heads-up?\u201d`,
  askQ2: `\u201cJudith, which bills are due this week?\u201d`,
  askA2: `\u201cThree \u2014 British Gas, BT and your rent. ${cur}1,560 total. Want me to remind you the day before each?\u201d`,
  askQ3: `\u201cJudith, I\u2019ve got ${cur}3,000 left this month \u2014 can I afford ${cur}500 for a trip this week?\u201d`,
  askA3: `\u201cYou can, but keep it tight \u2014 ${cur}1,190 is due by Friday. After the trip you\u2019d have ${cur}1,310 to cover the rest. Go, just don\u2019t touch the bill money.\u201d`,
});

const DLOCAL_CA: DLocalFn = (cur) => ({
  askQ:  `\u201cJudith, what\u2019s my total credit card bill next month?\u201d`,
  askA:  `\u201c${cur}1,230 across RBC and TD \u2014 both due before the 25th. Want a heads-up?\u201d`,
  askQ2: `\u201cJudith, which bills are due this week?\u201d`,
  askA2: `\u201cThree \u2014 BC Hydro, Bell and your rent. ${cur}2,195 total. Want me to remind you the day before each?\u201d`,
  askQ3: `\u201cJudith, I\u2019ve got ${cur}5,000 left this month \u2014 can I afford ${cur}800 for a trip this week?\u201d`,
  askA3: `\u201cYou can, but keep it tight \u2014 ${cur}1,580 is due by Friday. After the trip you\u2019d have ${cur}2,620 to cover the rest. Go, just don\u2019t touch the bill money.\u201d`,
});

const DLOCAL_MAP: Record<string, DLocalFn> = {
  PH: DLOCAL_PH, US: DLOCAL_US, SG: DLOCAL_SG, AU: DLOCAL_AU, GB: DLOCAL_GB, CA: DLOCAL_CA,
};

export function getDLocal(cur: string, countryCode: string): DLocal {
  const fn = DLOCAL_MAP[countryCode] ?? DLOCAL_US;
  return fn(cur);
}
