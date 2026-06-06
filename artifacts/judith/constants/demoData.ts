/**
 * US demo preset — loads a realistic American household bill set so the
 * app can be screenshotted / demoed without going through onboarding.
 *
 * Load via Settings → "Load demo data" button.
 * Today reference: June 2026.
 */

import type { Bill, BillCycleRecord } from "@/constants/data";

function hist(
  amount: number,
  periods: Array<{ period: string; onTime: boolean }>,
): BillCycleRecord[] {
  return periods.map(({ period, onTime }) => ({
    period,
    charged: amount,
    carriedIn: 0,
    totalDue: amount,
    paid: amount,
    rolledOver: 0,
    onTime,
  }));
}

const FIVE_MONTHS = [
  { period: "2026-05", onTime: true },
  { period: "2026-04", onTime: true },
  { period: "2026-03", onTime: true },
  { period: "2026-02", onTime: true },
  { period: "2026-01", onTime: false },
];

const CHASE_ID = "demo-chase-sapphire";

export const DEMO_BILLS: Bill[] = [
  // ── Overdue (dueDate already passed in June) ────────────────────────
  {
    id: "demo-rent",
    provider: "Landlord",
    cat: "Rent / Mortgage",
    icon: "home",
    subtype: "Rent",
    amount: 2100,
    dueDate: 1,
    dueDays: -5,
    dueLabel: "Jun 1",
    status: "due",
    house: "Main home",
    paymentHistory: hist(2100, FIVE_MONTHS),
  },
  {
    id: "demo-aws",
    provider: "AWS",
    cat: "Web app",
    icon: "globe",
    amount: 156,
    dueDate: 1,
    dueDays: -5,
    dueLabel: "Jun 1",
    status: "due",
    isBusiness: true,
    businessName: "Freelance",
    paymentHistory: hist(156, [
      { period: "2026-05", onTime: true },
      { period: "2026-04", onTime: true },
      { period: "2026-03", onTime: true },
    ]),
  },

  // ── Due soon ─────────────────────────────────────────────────────────
  {
    id: "demo-xfinity",
    provider: "Xfinity",
    cat: "Internet",
    icon: "wifi",
    amount: 89,
    dueDate: 10,
    dueDays: 4,
    dueLabel: "Jun 10",
    status: "due",
    house: "Main home",
    paymentHistory: hist(89, FIVE_MONTHS),
  },
  {
    id: "demo-conedison",
    provider: "Con Edison",
    cat: "Electricity",
    icon: "zap",
    amount: 134,
    dueDate: 14,
    dueDays: 8,
    dueLabel: "Jun 14",
    status: "due",
    kind: "Variable",
    house: "Main home",
    paymentHistory: [
      { period: "2026-05", charged: 98,  carriedIn: 0, totalDue: 98,  paid: 98,  rolledOver: 0, onTime: true  },
      { period: "2026-04", charged: 87,  carriedIn: 0, totalDue: 87,  paid: 87,  rolledOver: 0, onTime: true  },
      { period: "2026-03", charged: 145, carriedIn: 0, totalDue: 145, paid: 145, rolledOver: 0, onTime: true  },
      { period: "2026-02", charged: 162, carriedIn: 0, totalDue: 162, paid: 162, rolledOver: 0, onTime: true  },
      { period: "2026-01", charged: 178, carriedIn: 0, totalDue: 178, paid: 178, rolledOver: 0, onTime: false },
    ],
  },
  {
    id: CHASE_ID,
    provider: "Chase Sapphire",
    cat: "Credit card",
    icon: "card",
    amount: 485,
    dueDate: 15,
    dueDays: 9,
    dueLabel: "Jun 15",
    status: "due",
    statementDay: 1,
    paymentHistory: [
      { period: "2026-05", charged: 412, carriedIn: 0, totalDue: 412, paid: 412, rolledOver: 0, onTime: true  },
      { period: "2026-04", charged: 538, carriedIn: 0, totalDue: 538, paid: 538, rolledOver: 0, onTime: true  },
      { period: "2026-03", charged: 391, carriedIn: 0, totalDue: 391, paid: 391, rolledOver: 0, onTime: true  },
      { period: "2026-02", charged: 467, carriedIn: 0, totalDue: 467, paid: 467, rolledOver: 0, onTime: true  },
      { period: "2026-01", charged: 502, carriedIn: 0, totalDue: 502, paid: 502, rolledOver: 0, onTime: false },
    ],
  },

  // ── Linked to Chase (via card — show in timeline, excluded from sums) ─
  {
    id: "demo-netflix",
    provider: "Netflix",
    cat: "Streaming",
    icon: "spark",
    amount: 22.99,
    dueDate: 1,
    dueDays: -5,
    dueLabel: "Jun 1",
    status: "due",
    chargedToCard: true,
    parentCardId: CHASE_ID,
    paymentHistory: hist(22.99, FIVE_MONTHS),
  },
  {
    id: "demo-spotify",
    provider: "Spotify",
    cat: "Streaming",
    icon: "spark",
    amount: 11.99,
    dueDate: 1,
    dueDays: -5,
    dueLabel: "Jun 1",
    status: "due",
    chargedToCard: true,
    parentCardId: CHASE_ID,
    paymentHistory: hist(11.99, FIVE_MONTHS),
  },
  {
    id: "demo-hulu",
    provider: "Hulu",
    cat: "Streaming",
    icon: "spark",
    amount: 17.99,
    dueDate: 10,
    dueDays: 4,
    dueLabel: "Jun 10",
    status: "due",
    chargedToCard: true,
    parentCardId: CHASE_ID,
    paymentHistory: hist(17.99, FIVE_MONTHS),
  },
  {
    id: "demo-planet-fitness",
    provider: "Planet Fitness",
    cat: "Subscription",
    icon: "spark",
    amount: 24.99,
    dueDate: 20,
    dueDays: 14,
    dueLabel: "Jun 20",
    status: "due",
    chargedToCard: true,
    parentCardId: CHASE_ID,
    paymentHistory: hist(24.99, FIVE_MONTHS),
  },

  // ── Due later this month ──────────────────────────────────────────────
  {
    id: "demo-tmobile",
    provider: "T-Mobile",
    cat: "Mobile",
    icon: "smartphone",
    amount: 85,
    dueDate: 18,
    dueDays: 12,
    dueLabel: "Jun 18",
    status: "due",
    paymentHistory: hist(85, FIVE_MONTHS),
  },
  {
    id: "demo-geico",
    provider: "GEICO",
    cat: "Insurance",
    icon: "lock",
    amount: 147,
    dueDate: 22,
    dueDays: 16,
    dueLabel: "Jun 22",
    status: "due",
    paymentHistory: hist(147, FIVE_MONTHS),
  },
  {
    id: "demo-national-grid",
    provider: "National Grid",
    cat: "Utilities",
    icon: "zap",
    amount: 72,
    dueDate: 25,
    dueDays: 19,
    dueLabel: "Jun 25",
    status: "due",
    kind: "Variable",
    house: "Main home",
    paymentHistory: [
      { period: "2026-05", charged: 65,  carriedIn: 0, totalDue: 65,  paid: 65,  rolledOver: 0, onTime: true },
      { period: "2026-04", charged: 81,  carriedIn: 0, totalDue: 81,  paid: 81,  rolledOver: 0, onTime: true },
      { period: "2026-03", charged: 94,  carriedIn: 0, totalDue: 94,  paid: 94,  rolledOver: 0, onTime: true },
    ],
  },
];

export const DEMO_ASK_HISTORY = [
  {
    role: "user" as const,
    text: "How much do I still owe this month?",
  },
  {
    role: "judith" as const,
    text: "You have $3,218 still due in June across 9 bills. Two are already overdue — your rent ($2,100, 5 days late) and AWS ($156, 5 days late for Freelance) — so $2,256 needs your attention first. Next up: Xfinity ($89) on June 10, then Con Edison ($134) on June 14. The rest are mid-to-late month. Want a breakdown by category?",
  },
  {
    role: "user" as const,
    text: "What's on my Chase Sapphire this month?",
  },
  {
    role: "judith" as const,
    text: "Your Chase Sapphire statement is $485, due June 15 — 9 days out. About $78 of that is auto-charges: Netflix ($23), Spotify ($12), Hulu ($18), and Planet Fitness ($25). The rest is your regular spending. You've paid it on time 4 of the last 5 months — solid record.",
  },
];

export const DEMO_PRESET = {
  bills: DEMO_BILLS,
  asksLeft: 3,
  tier: "chat" as const,
  name: "Alex",
  persona: "funny" as const,
  voiceId: "rachel",
  language: "en",
  theme: "system" as const,
  accent: "mint" as const,
  countryCode: "US",
  currency: "$",
  toggles: {
    dueReminders: true,
    widget: true,
    watch: false,
    nudges: true,
    voiceReplies: true,
  },
  reduceMotion: false,
  faceIdLock: false,
  onboarded: true,
  onbIdx: 0,
  guest: false,
  monthlyIncome: 5500,
  incomeByMonth: {},
  askHistory: DEMO_ASK_HISTORY,
};
