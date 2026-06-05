/**
 * Bills, providers, history, voices, quick-asks + helpers.
 * Ported 1:1 from the prototype (japp-data.jsx, spec §3).
 */

export type BillStatus = "due" | "paid";
export type BillKind = "Fixed" | "Variable";

/** One closed billing cycle — populated when a cycle completes (paid or rolled over). */
export interface BillCycleRecord {
  /** "YYYY-MM" for monthly bills, "YYYY" for annual */
  period: string;
  /** Base charge for this cycle (excludes carry-in) */
  charged: number;
  /** Balance rolled in from the previous cycle */
  carriedIn: number;
  /** Total due = charged + carriedIn */
  totalDue: number;
  /** Amount actually paid this cycle */
  paid: number;
  /** Unpaid balance forwarded to the next cycle */
  rolledOver: number;
  /** true = paid on/before due date; false = paid late; null = cycle closed without full payment */
  onTime: boolean | null;
}

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
  /** Billing cadence. Defaults to monthly when omitted. */
  frequency?: "monthly" | "annual";
  /** Amount paid so far this cycle (0 or omitted = not yet paid). */
  amountPaid?: number;
  /** Unpaid balance rolled forward from the previous cycle. */
  carryOver?: number;
  /** Days before due date to send a reminder (default 3). */
  reminderDays?: number;
  /**
   * Day of the month the credit card statement is released (1–28).
   * Only relevant when cat === "Credit card".
   * Judith nudges the user on this day to update the bill amount.
   */
  statementDay?: number;
  /** Closed billing cycles, most-recent-first. Capped at 24. */
  paymentHistory?: BillCycleRecord[];
  /** True when this bill is a business/work expense (default: personal). */
  isBusiness?: boolean;
  /** True when this charge is auto-billed to a credit card the user also tracks. */
  chargedToCard?: boolean;
  /** The `id` of the linked credit-card bill that covers this charge. */
  parentCardId?: string;
}

/** Total owed this cycle = current charge + any rolled-over balance. */
export function totalOwed(b: Pick<Bill, "amount" | "carryOver">): number {
  return b.amount + (b.carryOver ?? 0);
}

/**
 * Outstanding balance on a credit-card statement that hasn't been re-billed yet
 * — used for the current statement AND any future month until the next statement
 * arrives. Unlike a recurring utility, a credit card is a revolving balance, not
 * a fresh charge each month:
 *   • paid in full  → 0 (stays settled until the user enters the next statement)
 *   • partial       → the unpaid remainder carries forward
 *   • untouched     → the full statement, shown as an estimate
 * Settling resets via updateBillAmount (amountPaid → 0, amount → new statement).
 */
export function ccOutstanding(
  b: Pick<Bill, "amount" | "carryOver" | "amountPaid">,
): number {
  return Math.max(0, totalOwed(b) - (b.amountPaid ?? 0));
}

/**
 * Sum of recurring charges linked to a credit card that will re-bill onto its
 * statement in a given month. Monthly linked charges land every month; annual
 * ones only in their next-occurrence month (`today + dueDays`). Used to project
 * a card's FUTURE statement — those charges are re-billed each cycle even after
 * the current statement is settled.
 */
export function ccLinkedRecurringForMonth(
  card: Pick<Bill, "id">,
  allBills: Bill[],
  year: number,
  monthIndex: number,
  today: Date,
): number {
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  return allBills
    .filter((b) => b.parentCardId === card.id && isPaidViaCard(b))
    .filter((b) => {
      if (b.dueDate > dim) return false; // e.g. day 30 in a 28-day month
      if (b.frequency === "annual") {
        const nextDue = new Date(today.getTime());
        nextDue.setDate(nextDue.getDate() + b.dueDays);
        return nextDue.getFullYear() === year && nextDue.getMonth() === monthIndex;
      }
      return true; // monthly → every month
    })
    .reduce((s, b) => s + b.amount, 0);
}

/**
 * Projected outstanding for a credit card in a FUTURE month: the current
 * statement's unpaid remainder carries over (ccOutstanding) PLUS any recurring
 * charges linked to the card that re-bill that month. So a fully-paid card with
 * a monthly ₱2,500 linked charge projects ₱2,500 next month, not ₱0. The user
 * overrides this estimate when the real statement arrives (updateBillAmount).
 */
export function ccProjectedFuture(
  card: Bill,
  allBills: Bill[],
  year: number,
  monthIndex: number,
  today: Date,
): number {
  return ccOutstanding(card) + ccLinkedRecurringForMonth(card, allBills, year, monthIndex, today);
}

/**
 * True when this bill is auto-charged to a linked credit card the user also
 * tracks. Its cost is already captured by that card's statement total, so it
 * must be EXCLUDED from every money sum (due totals, calendar totals, spend
 * breakdown) to avoid double-counting. The bill still appears in lists/timeline,
 * tagged "via card", so the user can see what makes up the card balance.
 */
export function isPaidViaCard(b: Pick<Bill, "chargedToCard" | "parentCardId">): boolean {
  // Require an actual linked card. If "via card" was set but no card was chosen
  // (or the linked card was deleted), there is no statement covering this charge,
  // so it must keep counting toward totals rather than silently disappearing.
  return !!b.chargedToCard && !!b.parentCardId;
}

/** Percentage of this cycle's total already paid (0–100). */
export function partialPct(
  b: Pick<Bill, "amount" | "carryOver" | "amountPaid" | "status">,
): number {
  if (b.status === "paid") return 100;
  const owed = totalOwed(b);
  if (owed <= 0 || !b.amountPaid) return 0;
  return Math.min(100, Math.round((b.amountPaid / owed) * 100));
}

/** True when a payment has been recorded but the bill isn't fully settled. */
export function isPartialBill(
  b: Pick<Bill, "status" | "amountPaid">,
): boolean {
  return b.status !== "paid" && (b.amountPaid ?? 0) > 0;
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
  Insurance: [
    { name: "Maxicare", color: "#0057A8", short: "MX" },
    { name: "PhilHealth", color: "#007041", short: "PH" },
    { name: "Sun Life", color: "#FFCC00", short: "SL" },
    { name: "Manulife", color: "#00A758", short: "MN" },
    { name: "AXA", color: "#1A1446", short: "AX" },
    { name: "Prudential", color: "#ED1C24", short: "PR" },
    { name: "FWD", color: "#E6007E", short: "FWD" },
    { name: "BPI MS", color: "#A6192E", short: "BPI" },
    { name: "GEICO", color: "#007CBB", short: "GC" },
    { name: "Blue Shield", color: "#003087", short: "BS" },
    { name: "Medibank", color: "#E4002B", short: "MB" },
    { name: "Direct Line", color: "#CC0000", short: "DL" },
  ],
  "Web app": [
    { name: "Canva", color: "#00C4CC", short: "CV" },
    { name: "Notion", color: "#3f3f3f", short: "N" },
    { name: "ChatGPT", color: "#10A37F", short: "AI" },
    { name: "Figma", color: "#F24E1E", short: "Fg" },
    { name: "Slack", color: "#4A154B", short: "Sl" },
    { name: "Zoom", color: "#2D8CFF", short: "Z" },
    { name: "GitHub", color: "#24292F", short: "GH" },
    { name: "Dropbox", color: "#0061FF", short: "Db" },
    { name: "Adobe CC", color: "#FF0000", short: "Ad" },
    { name: "Grammarly", color: "#15C39A", short: "Gr" },
    { name: "Loom", color: "#625DF5", short: "Lo" },
    { name: "Airtable", color: "#2D7FF9", short: "At" },
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
  "Web app": "globe",
  Insurance: "lock",
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
  { id: "skycable", provider: "Sky Cable", cat: "TV / Streaming", icon: "spark", amount: 699, dueDays: -2, dueDate: 30, dueLabel: "May 30", status: "due", house: "Main home" },
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

/**
 * Returns an existing bill that looks like a duplicate of the candidate.
 * Match = same provider (case-insensitive trim) AND same category.
 */
export function findDuplicate(
  bills: Bill[],
  candidate: { provider: string; cat: string },
): Bill | undefined {
  const norm = (s: string) => s.trim().toLowerCase();
  return bills.find(
    (b) => norm(b.provider) === norm(candidate.provider) && b.cat === candidate.cat,
  );
}

/** Money formatter — currency symbol from the selected country. */
export function formatMoney(n: number, symbol = "₱"): string {
  return symbol + Math.round(n).toLocaleString("en-US");
}

/** Default ₱ formatter (prototype `peso`). */
export const peso = (n: number): string => formatMoney(n);

/** Urgency bucket from days-until-due. */
export const dueClass = (d: number): "overdue" | "urgent" | "near" | "ok" =>
  d < 0 ? "overdue" : d <= 3 ? "urgent" : d <= 7 ? "near" : "ok";

/** Humanized days-until-due, long form (notification / sentence copy). */
export const dueText = (d: number): string =>
  d < 0
    ? `overdue by ${-d} ${-d === 1 ? "day" : "days"}`
    : d === 0
      ? "due today"
      : d === 1
        ? "due tomorrow"
        : `due in ${d} days`;

/** Compact days-until-due (chips, widgets, timeline rows). */
export const dueShort = (d: number): string =>
  d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `in ${d}d`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Live next-occurrence for a store Bill, computed fresh from its day-of-month
 * (`dueDate`) — never the stored `dueDays`/`dueLabel`, which drift over time and
 * are explicitly treated as stale by the store. Monthly bills roll to next month
 * only once the due day has fully passed: a bill due *today* stays today (matches
 * the calendar). Annual bills keep their stored dueDays, which already points at
 * the real annual occurrence.
 */
export function nextOccurrence(
  b: Pick<Bill, "dueDate" | "dueDays" | "dueLabel" | "frequency">,
  today: Date = new Date(),
): { dueDays: number; dueLabel: string } {
  if (b.frequency === "annual") return { dueDays: b.dueDays, dueLabel: b.dueLabel };
  const base = startOfDay(today);
  const dayFor = (y: number, m: number) => Math.min(b.dueDate, daysInMonth(y, m));
  let candidate = new Date(base.getFullYear(), base.getMonth(), dayFor(base.getFullYear(), base.getMonth()));
  if (candidate < base) {
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    candidate = new Date(y, m, dayFor(y, m));
  }
  const dueDays = Math.round((candidate.getTime() - base.getTime()) / 86_400_000);
  const sameYear = candidate.getFullYear() === base.getFullYear();
  const dueLabel = sameYear
    ? `${MONTHS[candidate.getMonth()]} ${candidate.getDate()}`
    : `${MONTHS[candidate.getMonth()]} ${candidate.getDate()}, ${candidate.getFullYear()}`;
  return { dueDays, dueLabel };
}

/**
 * Signed days from `today` to the bill's due day in the CURRENT calendar month.
 * Unlike {@link nextOccurrence}, this does NOT roll forward: a monthly bill whose
 * due day already passed this month returns a NEGATIVE value (overdue), matching
 * the calendar's current-month `viewedDueDays`. Use this for surfaces that show an
 * overdue state (home timeline, watch summary). Annual bills keep their stored
 * dueDays. The due day is clamped to the number of days in the month.
 */
export function currentCycleDue(
  b: Pick<Bill, "dueDate" | "dueDays" | "dueLabel" | "frequency">,
  today: Date = new Date(),
): { dueDays: number; dueLabel: string } {
  if (b.frequency === "annual") return { dueDays: b.dueDays, dueLabel: b.dueLabel };
  const base = startOfDay(today);
  const day = Math.min(b.dueDate, daysInMonth(base.getFullYear(), base.getMonth()));
  const target = new Date(base.getFullYear(), base.getMonth(), day);
  const dueDays = Math.round((target.getTime() - base.getTime()) / 86_400_000);
  return { dueDays, dueLabel: `${MONTHS[target.getMonth()]} ${target.getDate()}` };
}

/** A subscription detected from a screenshot, before it becomes a Bill. */
export interface ScannedSubscription {
  provider: string;
  amount: number | null;
  dueDay: number | null;
  frequency: "monthly" | "annual";
  /** Exact next renewal date (YYYY-MM-DD) when the screenshot showed one. */
  nextDue?: string | null;
}

/**
 * Resolve the next renewal date for a scanned subscription.
 * Prefers the exact `nextDue` date; otherwise rolls the day-of-month forward
 * to the next monthly (or yearly, for annual) occurrence.
 */
function resolveNextDue(sub: ScannedSubscription, today: Date): Date {
  const base = startOfDay(today);
  if (sub.nextDue) {
    const parsed = new Date(`${sub.nextDue}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      // Never surface a date already in the past — roll it forward by cadence.
      let d = startOfDay(parsed);
      while (d < base) {
        d = sub.frequency === "annual"
          ? new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())
          : new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), daysInMonth(d.getFullYear(), d.getMonth() + 1)));
      }
      return d;
    }
  }
  const day = sub.dueDay && sub.dueDay >= 1 && sub.dueDay <= 31 ? sub.dueDay : 20;
  const dayFor = (y: number, m: number) => Math.min(day, daysInMonth(y, m));
  let candidate = new Date(base.getFullYear(), base.getMonth(), dayFor(base.getFullYear(), base.getMonth()));
  if (candidate < base) {
    // No exact date: advance by the subscription's own cadence. Annual rolls a
    // full year (we only know the day-of-month, so keep the month); monthly
    // rolls to next month.
    if (sub.frequency === "annual") {
      const y = base.getFullYear() + 1;
      const m = base.getMonth();
      candidate = new Date(y, m, dayFor(y, m));
    } else {
      const y = base.getFullYear();
      const m = base.getMonth() + 1;
      candidate = new Date(y, m, dayFor(y, m));
    }
  }
  return candidate;
}

/**
 * Build a store Bill from a voice-extracted add_bill action.
 * Computes the next occurrence of dueDay relative to today.
 */
export function makeBillFromAction(
  a: { provider: string; cat: string; amount: number; dueDay: number },
  today: Date = new Date(),
): Bill {
  const base = startOfDay(today);
  const day = Math.max(1, Math.min(31, Math.round(a.dueDay)));
  const dayFor = (y: number, m: number) => Math.min(day, daysInMonth(y, m));
  let candidate = new Date(base.getFullYear(), base.getMonth(), dayFor(base.getFullYear(), base.getMonth()));
  if (candidate < base) {
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    candidate = new Date(y, m, dayFor(y, m));
  }
  const dueDays = Math.max(0, Math.round((startOfDay(candidate).getTime() - base.getTime()) / 86_400_000));
  const dueLabel = `${MONTHS[candidate.getMonth()]} ${candidate.getDate()}`;
  const icon = CAT_ICONS[a.cat] ?? "spark";
  return {
    id: `voice-${Date.now()}`,
    provider: a.provider.trim() || "Bill",
    cat: a.cat || "Other",
    icon,
    amount: Math.max(0, a.amount),
    dueDays,
    dueDate: day,
    dueLabel,
    status: "due",
    kind: "Fixed",
    frequency: "monthly",
  };
}

/**
 * Build a store Bill from manual entry. Computes the next occurrence of the
 * given due day relative to today, honoring monthly vs annual cadence.
 */
export function makeManualBill(
  a: {
    provider: string;
    cat: string;
    amount: number;
    dueDay: number;
    frequency?: "monthly" | "annual";
    kind?: "Fixed" | "Variable";
    house?: string;
    isBusiness?: boolean;
    reminderDays?: number;
    statementDay?: number;
    chargedToCard?: boolean;
    parentCardId?: string;
  },
  today: Date = new Date(),
): Bill {
  const base = startOfDay(today);
  const day = Math.max(1, Math.min(31, Math.round(a.dueDay)));
  const dayFor = (y: number, m: number) => Math.min(day, daysInMonth(y, m));
  let candidate = new Date(base.getFullYear(), base.getMonth(), dayFor(base.getFullYear(), base.getMonth()));
  if (candidate < base) {
    if (a.frequency === "annual") {
      const y = base.getFullYear() + 1;
      const m = base.getMonth();
      candidate = new Date(y, m, dayFor(y, m));
    } else {
      const y = base.getFullYear();
      const m = base.getMonth() + 1;
      candidate = new Date(y, m, dayFor(y, m));
    }
  }
  const dueDays = Math.max(0, Math.round((startOfDay(candidate).getTime() - base.getTime()) / 86_400_000));
  const sameYear = candidate.getFullYear() === base.getFullYear();
  const dueLabel = sameYear
    ? `${MONTHS[candidate.getMonth()]} ${candidate.getDate()}`
    : `${MONTHS[candidate.getMonth()]} ${candidate.getDate()}, ${candidate.getFullYear()}`;
  const icon = CAT_ICONS[a.cat] ?? "spark";
  return {
    id: `manual-${Date.now()}`,
    provider: a.provider.trim() || "Bill",
    cat: a.cat || "Custom",
    icon,
    amount: Math.max(0, a.amount),
    dueDays,
    dueDate: day,
    dueLabel,
    status: "due",
    kind: a.kind ?? "Fixed",
    frequency: a.frequency ?? "monthly",
    ...(a.house ? { house: a.house } : {}),
    ...(a.isBusiness ? { isBusiness: true } : {}),
    ...(a.reminderDays != null ? { reminderDays: a.reminderDays } : {}),
    ...(a.statementDay != null ? { statementDay: a.statementDay } : {}),
    ...(a.chargedToCard ? { chargedToCard: true } : {}),
    ...(a.parentCardId ? { parentCardId: a.parentCardId } : {}),
  };
}

/** Build a store Bill from a verified scanned subscription. */
export function makeSubscriptionBill(
  sub: ScannedSubscription,
  idSuffix: string,
  today: Date = new Date(),
): Bill {
  const due = resolveNextDue(sub, today);
  const dueDays = Math.max(
    0,
    Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / 86_400_000),
  );
  const sameYear = due.getFullYear() === today.getFullYear();
  const dueLabel =
    sub.frequency === "annual" && !sameYear
      ? `${MONTHS[due.getMonth()]} ${due.getDate()}, ${due.getFullYear()}`
      : `${MONTHS[due.getMonth()]} ${due.getDate()}`;
  return {
    id: `sub-${idSuffix}`,
    provider: sub.provider,
    cat: "Subscription",
    icon: "spark",
    amount: sub.amount ?? 0,
    dueDays,
    dueDate: due.getDate(),
    dueLabel,
    status: "due",
    kind: "Fixed",
    frequency: sub.frequency,
  };
}
