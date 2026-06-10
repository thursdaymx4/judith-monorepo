import { Router, type IRouter, type Request, type Response } from "express";
import {
  bearerToken,
  getSupabaseAdmin,
  getUserFromToken,
} from "../lib/supabaseAdmin";
import { getAnthropic, ANTHROPIC_MODEL, ANTHROPIC_HAIKU_MODEL } from "../lib/anthropic";
import { transcribe, synthesize, listVoices } from "../lib/elevenlabs";
import { isSafeForTTS } from "../lib/moderation";
import {
  DEFAULT_VOICE_IDS,
  getVoiceId,
  getSpeakingSpeed,
  systemPrompt,
  type PersonaId,
} from "../lib/personas";
import {
  englishDate,
  englishWeekday,
} from "../lib/normalize";
import { logger } from "../lib/logger";
import { getOnbAudio, setOnbAudio, getSampleAudio, getSampleUrl, setSampleAudio } from "../lib/audioCache";
import {
  askLimiter,
  sttTtsLimiter,
  sampleVoicesLimiter,
  parseLimiter,
  sampleOnboardingLimiter,
  askOnboardingLimiter,
  sttTtsOnboardingLimiter,
  askOnboardingGlobalCap,
  parseGlobalCap,
  sttTtsOnboardingGlobalCap,
  sampleOnboardingGlobalCap,
} from "../middleware/rateLimit";

const router: IRouter = Router();

const PERSONAS: PersonaId[] = ["professional", "funny", "sarcastic", "mom", "marites", "britney"];

function coercePersona(value: unknown): PersonaId {
  return PERSONAS.includes(value as PersonaId)
    ? (value as PersonaId)
    : "professional";
}

interface BillRow {
  name: string;
  category: string;
  provider: string | null;
  amount_type: string;
  amount: number | null;
  due_day: number | null;
  due_date: string | null;
  cadence: string;
  status: string;
  reminder_offsets: number[] | null;
  snoozed_until: string | null;
  is_business?: boolean | null;
}

/**
 * Parses a YYYY-MM-DD string sent by the client (device-local date) and returns
 * a Date in the server's local midnight. Falls back to server's now() if the
 * string is absent or malformed — better than crashing.
 */
/**
 * Extracts an <<ACTION:{...}>> tag appended by the AI at the end of its reply.
 * Returns the action object and the reply text stripped of the tag (used for TTS).
 */
function parseAction(raw: string): { cleanText: string; action: Record<string, unknown> | null } {
  const match = /<<ACTION:(\{[^>]+\})>>\s*$/.exec(raw);
  if (!match) return { cleanText: raw.trim(), action: null };
  try {
    const action = JSON.parse(match[1]!) as Record<string, unknown>;
    return { cleanText: raw.slice(0, match.index).trim(), action };
  } catch {
    return { cleanText: raw.trim(), action: null };
  }
}

function parseLocalDate(raw: unknown): Date {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function nextDueDate(bill: BillRow, today: Date): Date | null {
  if (bill.cadence === "one_time") {
    return bill.due_date ? new Date(`${bill.due_date}T00:00:00`) : null;
  }
  if (!bill.due_day) return null;
  const base = startOfDay(today);
  const dayFor = (y: number, m: number) =>
    Math.min(bill.due_day!, daysInMonth(y, m));
  let candidate = new Date(
    base.getFullYear(),
    base.getMonth(),
    dayFor(base.getFullYear(), base.getMonth()),
  );
  if (candidate < base) {
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    candidate = new Date(y, m, dayFor(y, m));
  }
  return candidate;
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Builds an accurate, English-normalized context block from the user's bills. */
function buildBillsContext(bills: BillRow[], today: Date, cur = "₱"): string {
  if (bills.length === 0) {
    return "The user has no bills saved yet.";
  }

  const lines: string[] = [];
  let dueThisWeek = 0;
  let dueThisMonth = 0;
  let nextLabel = "";
  let nextDays = Number.POSITIVE_INFINITY;

  const enriched = bills
    .map((b) => ({ bill: b, due: nextDueDate(b, today) }))
    .sort((a, b) => {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.getTime() - b.due.getTime();
    });

  for (const { bill, due } of enriched) {
    const provider = bill.provider ? ` (${bill.provider})` : "";
    const amount =
      bill.amount_type === "variable"
        ? bill.amount != null
          ? `variable, last known ${curStr(cur, bill.amount)}`
          : "variable amount, not yet known"
        : curStr(cur, bill.amount ?? 0);

    const bizTag = bill.is_business ? " [BUSINESS]" : " [PERSONAL]";

    if (bill.status === "paid") {
      lines.push(`- ${bill.name}${provider} [${bill.category}]${bizTag} — already PAID. Amount: ${amount}.`);
      continue;
    }

    if (!due) {
      lines.push(`- ${bill.name}${provider} [${bill.category}]${bizTag} — no due date set. Amount: ${amount}.`);
      continue;
    }

    const days = daysBetween(today, due);
    const when =
      days === 0 ? "due TODAY" : days < 0 ? `OVERDUE by ${Math.abs(days)} day(s)` : `due in ${days} day(s)`;
    lines.push(
      `- ${bill.name}${provider} [${bill.category}]${bizTag} — ${amount}, due on ${englishDate(due)} (${englishWeekday(due)}), ${when}.`,
    );

    if (days >= 0 && bill.amount != null && bill.amount_type === "fixed") {
      if (days <= 7) dueThisWeek += bill.amount;
      if (due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear()) {
        dueThisMonth += bill.amount;
      }
    }
    if (days >= 0 && days < nextDays) {
      nextDays = days;
      nextLabel = `${bill.name} on ${englishDate(due)} (${englishWeekday(due)})`;
    }
  }

  const summary: string[] = [
    `Today is ${englishDate(today)} (${englishWeekday(today)}).`,
    `Total of fixed bills due within 7 days: ${curStr(cur, dueThisWeek)}.`,
    `Total of fixed bills due this month: ${curStr(cur, dueThisMonth)}.`,
  ];
  if (nextLabel) summary.push(`Next bill due: ${nextLabel}.`);

  return `${summary.join("\n")}\n\nBILLS:\n${lines.join("\n")}`;
}

interface ClientBill {
  /** Stable bill id — used to identify the exact bill for edit actions. */
  id?: string | null;
  provider?: string | null;
  cat?: string | null;
  amount?: number | null;
  dueDays?: number | null;
  dueLabel?: string | null;
  status?: string | null;
  /** "YYYY-MM" of the bill's next due date. */
  dueMonth?: string | null;
  /** True when this bill is tagged as a business/work expense. */
  isBusiness?: boolean | null;
  /** Name of the business this bill belongs to (when isBusiness is true). */
  businessName?: string | null;
  /** True when this charge is auto-billed to a credit card the user tracks. */
  chargedToCard?: boolean | null;
  /** Name of the credit card this charge is auto-billed to, if known. */
  cardName?: string | null;
  /** True for next-month projected entries — future estimates, not yet billed. */
  isProjection?: boolean | null;
  /** Amount already paid toward this bill in the current cycle. Present only when > 0. */
  paidThisPeriod?: number | null;
  /** Original full amount before partial payment was subtracted. Lets Judith
   *  answer "how much have I paid?" — `amount` field is the REMAINING balance. */
  originalTotal?: number | null;
}

function curStr(cur: string, n: number): string {
  return `${cur}${Math.round(n).toLocaleString("en-US")}`;
}

function nextPaydayDate(today: Date, cycle?: string, day?: number, semi?: [number, number], weekday?: number): Date | null {
  if (!cycle) return null;
  if (cycle === "monthly" && day != null) {
    const lastOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const effectiveDay = (y: number, m: number) => day === 31 ? lastOfMonth(y, m) : Math.min(day, lastOfMonth(y, m));
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), effectiveDay(today.getFullYear(), today.getMonth()));
    if (thisMonth >= today) return thisMonth;
    const nm = today.getMonth() + 1 > 11 ? 0 : today.getMonth() + 1;
    const ny = nm === 0 ? today.getFullYear() + 1 : today.getFullYear();
    return new Date(ny, nm, effectiveDay(ny, nm));
  }
  if (cycle === "semi-monthly" && semi != null) {
    const [d1, d2] = semi;
    const lastOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const eff = (d: number, y: number, m: number) => d === 31 ? lastOfMonth(y, m) : Math.min(d, lastOfMonth(y, m));
    const candidates = [0, 1].flatMap((offset) => {
      const m = (today.getMonth() + offset) % 12;
      const y = today.getFullYear() + Math.floor((today.getMonth() + offset) / 12);
      return [new Date(y, m, eff(d1, y, m)), new Date(y, m, eff(d2, y, m))];
    });
    const future = candidates.filter((d) => d >= today).sort((a, b) => a.getTime() - b.getTime());
    return future[0] ?? null;
  }
  if (cycle === "weekly" && weekday != null) {
    const todayWd = today.getDay();
    const diff = (weekday - todayWd + 7) % 7;
    const next = new Date(today);
    next.setDate(today.getDate() + (diff === 0 ? 0 : diff));
    return next;
  }
  return null;
}

function buildClientContext(bills: ClientBill[], today: Date, cur = "₱", monthlyIncome?: number, incomeByMonth?: Record<string, number>, payCycle?: string, paydayDay?: number, paydaySemi?: [number, number], paydayWeekday?: number, localWeekday?: string): string {
  /** Effective income for a given month key — use override if set, otherwise the default. */
  const incomeFor = (monthKey: string): number | undefined => {
    const override = incomeByMonth?.[monthKey];
    if (override != null && override > 0) return override;
    return monthlyIncome != null && monthlyIncome > 0 ? monthlyIncome : undefined;
  };
  // Card-linked charges are auto-paid via a credit card the user ALSO tracks as
  // its own bill, so the card's statement already covers that money. Summing both
  // double-counts. Exclude these from every money SUM (the card statement is the
  // single payable) but keep them in the list so Judith can still talk about them.
  // A charge only counts as "via card" when its parent card is known (cardName
  // resolved); a dangling link keeps counting so real money never vanishes.
  const isViaCard = (b: ClientBill) => !!b.chargedToCard && !!b.cardName;
  const payable = bills.filter((b) => !isViaCard(b));
  const viaCard = bills.filter(isViaCard);

  // Mirror the home screen's timelineBills scope: only bills due within this
  // calendar month (or already overdue). Bills with dueDays > daysLeftInMonth
  // (e.g. annual bills due in December) are excluded from all current-month
  // totals and category sums — exactly as the home screen omits them.
  const daysLeftInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
  const isThisMonth = (b: ClientBill) => !b.isProjection && (b.dueDays ?? 0) <= daysLeftInMonth;

  // Projections are future-month estimates — exclude from "due now" totals.
  // Also cap at daysLeftInMonth so annual future bills don't inflate the sum.
  const due = payable.filter((b) => b.status !== "paid" && isThisMonth(b));
  const total = due.reduce((s, b) => s + (b.amount ?? 0), 0);
  const dueThisWeek = due
    .filter((b) => (b.dueDays ?? 0) >= 0 && (b.dueDays ?? 0) <= 7)
    .reduce((s, b) => s + (b.amount ?? 0), 0);

  // Month keys needed by both monthLines and the income-remaining section.
  const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

  // Per-month totals so the AI can answer "what's my total in July/August?"
  // accurately — payable bills only, so auto-charged card bills aren't double-counted.
  const monthMap = new Map<string, { total: number; count: number }>();
  for (const b of payable) {
    if (b.dueMonth && b.amount != null) {
      const entry = monthMap.get(b.dueMonth) ?? { total: 0, count: 0 };
      monthMap.set(b.dueMonth, { total: entry.total + b.amount, count: entry.count + 1 });
    }
  }
  const monthLines = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { total, count }]) => {
      const [yr, mo] = key.split("-").map(Number);
      const label = new Date(yr!, (mo ?? 1) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      const isFuture = key > curMonthKey;
      const paidCount = payable.filter((b) => b.dueMonth === key && b.status === "paid").length;
      const unpaidCount = count - paidCount;
      const estTag = isFuture ? " — ESTIMATED (recurring bills projected, not yet billed)" : "";
      return `- ${label}: ${curStr(cur, total)} estimated total${estTag} (${count} bill${count === 1 ? "" : "s"}, ${paidCount} paid, ${unpaidCount} upcoming)`;
    });

  // Business totals — scoped to this month (same daysLeftInMonth gate as home screen).
  const bizUnpaid = payable.filter((b) => b.isBusiness && b.status !== "paid" && isThisMonth(b));
  const bizTotal = bizUnpaid.reduce((s, b) => s + (b.amount ?? 0), 0);

  // Business bills that are auto-charged to a card — excluded from payment totals
  // but real spending; the user should know the full business cost when they ask.
  const bizViaCard = viaCard.filter((b) => b.isBusiness && isThisMonth(b));
  const bizViaCardTotal = bizViaCard.reduce((s, b) => s + (b.amount ?? 0), 0);

  // Per-business breakdown — group all business bills (payable + via-card) by name.
  // Keep payable vs via-card providers in SEPARATE lists (with amounts) so the AI
  // can name exactly which bills a business must pay directly vs which are already
  // auto-charged. Without this split the model "gap-fills" a business whose bills
  // are all via-card (₱0 payable) by grabbing an unrelated payable bill from a
  // DIFFERENT business (e.g. answering "Auto Tomato" with CCSC's Laundry).
  const bizNameMap = new Map<string, {
    payable: number;
    viaCard: number;
    payableItems: { name: string; amount: number }[];
    viaCardItems: { name: string; amount: number; card: string | null }[];
  }>();
  for (const b of [...bizUnpaid, ...bizViaCard]) {
    const key = b.businessName?.trim() || "(untagged)";
    const entry = bizNameMap.get(key) ?? { payable: 0, viaCard: 0, payableItems: [], viaCardItems: [] };
    if (isViaCard(b)) {
      entry.viaCard += b.amount ?? 0;
      entry.viaCardItems.push({ name: b.provider ?? "Bill", amount: b.amount ?? 0, card: b.cardName ?? null });
    } else {
      entry.payable += b.amount ?? 0;
      entry.payableItems.push({ name: b.provider ?? "Bill", amount: b.amount ?? 0 });
    }
    bizNameMap.set(key, entry);
  }

  // Per-category totals including via-card (for "how much does X category cost me" answers).
  // Keyed by cat name; splits into payable and viaCard sub-totals.
  // Projections (isProjection=true) are excluded — they are next-month estimates and must
  // NOT be summed into the current-month category totals (would double-count every recurring bill).
  // Per-provider breakdown stored alongside the totals so catLines can include
  // individual amounts — this lets the AI read the answer directly without
  // re-counting from the BILLS section (which has current + projection duplicates).
  // Scoped to this month (isThisMonth) so annual/future bills don't inflate
  // category totals beyond what the home screen shows.
  const catMap = new Map<string, { payable: number; viaCard: number; items: { name: string; amount: number }[] }>();
  for (const b of bills.filter((b) => isThisMonth(b) && b.status !== "paid")) {
    const cat = b.cat ?? "Other";
    const entry = catMap.get(cat) ?? { payable: 0, viaCard: 0, items: [] };
    if (isViaCard(b)) {
      entry.viaCard += b.amount ?? 0;
    } else {
      entry.payable += b.amount ?? 0;
    }
    entry.items.push({ name: b.provider ?? "Bill", amount: b.amount ?? 0 });
    catMap.set(cat, entry);
  }

  const lines = bills.map((b) => {
    const days = b.dueDays ?? 0;
    // Compute the actual calendar date for this bill so the AI always knows the
    // exact date+weekday without having to do mental arithmetic from "today".
    // new Date(y, m, d + offset) handles month overflow correctly in JS.
    const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
    const dueDateStr = b.dueLabel ?? englishDate(dueDate);
    const dueWkday = englishWeekday(dueDate);
    const when = b.isProjection
      ? `due ~${b.dueLabel ?? "next month"} (estimated — not yet billed)`
      : days === 0
        ? `due TODAY — ${dueDateStr} (${dueWkday})`
        : days < 0
          ? `OVERDUE by ${Math.abs(days)} day(s) — was due ${dueDateStr} (${dueWkday})`
          : `due in ${days} day(s) — on ${dueDateStr} (${dueWkday})`;
    const bizTag = b.isBusiness
      ? (b.businessName ? ` [BUSINESS: ${b.businessName}]` : " [BUSINESS]")
      : " [PERSONAL]";
    // Only tag charges that are actually excluded from the totals (resolved card
    // link). A dangling link is still counted, so tagging it would mislead.
    const cardTag = isViaCard(b) ? ` [AUTO-CHARGED to ${b.cardName}]` : "";
    const estTag = b.isProjection ? " [ESTIMATED NEXT MONTH]" : "";
    const idTag = b.id ? `[id:${b.id}] ` : "";
    const paid = b.paidThisPeriod ?? 0;
    const orig = b.originalTotal ?? 0;
    const paidTag = paid > 0 && orig > 0
      ? ` [PARTIALLY PAID this month: ${curStr(cur, paid)} of ${curStr(cur, orig)} — amount shown is REMAINING balance]`
      : "";
    return `- ${idTag}${b.provider ?? "Bill"} (${b.cat ?? "Other"})${bizTag}${cardTag}${estTag}${paidTag}: ${curStr(cur, b.amount ?? 0)}, ${when}, ${b.status ?? "upcoming"}.`;
  });

  // ── Pre-computed income-remaining figures ──────────────────────────────
  // The AI must read these; it must NEVER subtract totals from income itself.
  const overdueAmt = due.filter((b) => (b.dueDays ?? 0) < 0).reduce((s, b) => s + (b.amount ?? 0), 0);

  const incomeLines: string[] = [];
  const curIncome = incomeFor(curMonthKey);
  const nxtIncome = incomeFor(nextMonthKey);
  const hasAnyIncome = curIncome != null || nxtIncome != null;

  if (hasAnyIncome) {
    const curEntry = monthMap.get(curMonthKey);
    const nxtEntry = monthMap.get(nextMonthKey);
    const nxtBills = nxtEntry?.total ?? 0;
    const nxtLabel = nextDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    if (curEntry && curIncome != null) {
      const leftThisMonth = curIncome - curEntry.total;
      incomeLines.push(
        `This month: ${curStr(cur, curIncome)} income − ${curStr(cur, curEntry.total)} bills = ${curStr(cur, leftThisMonth)} left${leftThisMonth < 0 ? " (bills exceed income this month)" : ""}.`,
      );
    }

    if (nxtIncome != null) {
      const leftNextMonth = nxtIncome - nxtBills;
      incomeLines.push(
        `Next month (${nxtLabel}, ESTIMATED — recurring bills projected, not yet billed): ${curStr(cur, nxtIncome)} income − ${curStr(cur, nxtBills)} estimated bills = ${curStr(cur, leftNextMonth)} estimated left.`,
      );
    }
    if (overdueAmt > 0) {
      incomeLines.push(
        `Important: ${curStr(cur, overdueAmt)} in overdue bills from this month are still unpaid — those must also be settled and will reduce real cash available next month.`,
      );
    }
  }

  // Describe income situation for AI context: variable vs fixed
  const hasVariable = incomeByMonth != null && Object.keys(incomeByMonth).length > 0;
  const payCycleLabel = payCycle === "semi-monthly" ? "twice a month (semi-monthly)"
    : payCycle === "weekly" ? "every week"
    : "once a month";
  const payCycleSuffix = payCycle ? ` User gets paid ${payCycleLabel}.` : "";

  // Compute next payday and how many days away it is
  const nextPayday = nextPaydayDate(today, payCycle, paydayDay, paydaySemi, paydayWeekday);
  const paydayLine = (() => {
    if (!nextPayday) return null;
    const msPerDay = 86_400_000;
    const diffDays = Math.round((nextPayday.getTime() - today.getTime()) / msPerDay);
    const dateStr = nextPayday.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    if (diffDays === 0) return `Next payday: TODAY (${dateStr}).`;
    if (diffDays === 1) return `Next payday: TOMORROW (${dateStr}).`;
    return `Next payday: ${dateStr} (${diffDays} days from now).`;
  })();

  const incomeHeader = hasVariable
    ? `User has VARIABLE monthly income. Default: ${monthlyIncome != null && monthlyIncome > 0 ? curStr(cur, monthlyIncome) : "not set"}/month. Overrides: ${Object.entries(incomeByMonth ?? {}).map(([k, v]) => `${k}: ${curStr(cur, v)}`).join(", ")}.${payCycleSuffix}`
    : monthlyIncome != null && Number.isFinite(monthlyIncome) && monthlyIncome > 0
      ? `User's estimated monthly take-home income: ${curStr(cur, monthlyIncome)}.${payCycleSuffix}`
      : payCycle
        ? `User's monthly income: not set. User gets paid ${payCycleLabel}.`
        : null;

  // Build overdue summary for the prominent alert block at the top of context.
  const overdueBills = due.filter((b) => (b.dueDays ?? 0) < 0);
  const overdueCount = overdueBills.length;

  const parts: string[] = [
    ...(overdueCount > 0
      ? [
          `⚠️ OVERDUE ALERT (read this FIRST, every time): ${overdueCount} bill${overdueCount === 1 ? " is" : "s are"} OVERDUE — ${curStr(cur, overdueAmt)} total unpaid past due. You MUST address this before answering anything else. No relief, safety, or positive framing is allowed while overdue bills exist. Forbidden phrases include: "Ligtas ka", "Wala naman", "Clear ka", "Pahinga muna", "nothing to worry about", "you're good", "haha", "hehe", or any equivalent in any language.`,
          "",
        ]
      : []),
    `Today is ${englishDate(today)} (${localWeekday?.trim() || englishWeekday(today)}).`,
    ...(incomeHeader ? [incomeHeader] : []),
    ...(paydayLine ? [paydayLine] : []),
    `Total still due (unpaid): ${curStr(cur, total)}.`,
    `Total of bills due within 7 days: ${curStr(cur, dueThisWeek)}.`,
    bizUnpaid.length > 0
      ? `Business bills still unpaid (directly payable): ${bizUnpaid.length} bill${bizUnpaid.length === 1 ? "" : "s"} totalling ${curStr(cur, bizTotal)}.`
      : "Business bills still unpaid (directly payable): none.",
    bizViaCard.length > 0
      ? `Business bills auto-charged to cards: ${bizViaCard.length} bill${bizViaCard.length === 1 ? "" : "s"} totalling ${curStr(cur, bizViaCardTotal)} (${bizViaCard.map((b) => b.provider).join(", ")}). These are already inside those card statements and must NOT be added to payment totals, but MUST be included when the user asks about their total business spending or business cost.`
      : "Business bills auto-charged to cards: none.",
    (bizUnpaid.length > 0 || bizViaCard.length > 0)
      ? `Combined business total (informational — payable + auto-charged): ${curStr(cur, bizTotal + bizViaCardTotal)}.`
      : "",
    bizNameMap.size > 0
      ? `Business breakdown by entity: ${[...bizNameMap.entries()].map(([name, { payable: p, viaCard: vc, payableItems, viaCardItems }]) => {
          const total = p + vc;
          const payList = payableItems.length > 0 ? payableItems.map((i) => `${i.name} ${curStr(cur, i.amount)}`).join(", ") : "none";
          const vcList = viaCardItems.length > 0 ? viaCardItems.map((i) => `${i.name} ${curStr(cur, i.amount)}${i.card ? ` via ${i.card}` : ""}`).join(", ") : "none";
          return `"${name}" = ${curStr(cur, total)} total (${curStr(cur, p)} directly payable + ${curStr(cur, vc)} auto-charged to cards). Directly payable bills (nothing else belongs to "${name}"): ${payList}. Auto-charged bills: ${vcList}`;
        }).join(" | ")}.`
      : "",
  ].filter(Boolean);

  if (incomeLines.length > 0) {
    parts.push(
      "",
      "INCOME REMAINING (pre-computed — use these figures exactly, do NOT subtract totals from income yourself):",
      ...incomeLines,
    );
  }

  if (viaCard.length > 0) {
    parts.push(
      "",
      `IMPORTANT — auto-charged bills: ${viaCard.length} bill${viaCard.length === 1 ? " is" : "s are"} automatically charged to a credit card the user ALSO tracks (tagged [AUTO-CHARGED to <card>] below). TWO RULES: (1) NEVER add auto-charged amounts to "what's due / what do I owe" totals — the card statement already covers them. (2) ALWAYS include auto-charged amounts when the user asks about spending by category, by business tag, or "how much does X cost me" — these are real costs and the user deserves the full picture. State the card name so they know where the charge lands (e.g. "₱1,500 via BPI").`,
    );
  }

  // Category breakdown including via-card — the AI MUST use these pre-computed totals
  // for any "how much do I spend on X?" or "what's my total for X category?" question.
  // Per-provider amounts are included so the AI doesn't need to re-derive from the BILLS
  // section (which contains current + projection duplicates for every recurring bill).
  const catLines = [...catMap.entries()]
    .sort(([, a], [, b]) => (b.payable + b.viaCard) - (a.payable + a.viaCard))
    .map(([cat, { payable: p, viaCard: vc, items }]) => {
      const total = p + vc;
      const breakdown = items.map((i) => `${i.name} ${curStr(cur, i.amount)}`).join(", ");
      // Always state the directly-payable amount explicitly — even when it's ₱0.
      // Otherwise the model "fills the gap" for all-via-card categories by grabbing
      // an unrelated payable bill from another category (e.g. Laundry → Web app).
      const vcNote = vc > 0
        ? ` (${curStr(cur, p)} directly payable + ${curStr(cur, vc)} auto-charged to cards)`
        : "";
      return `- ${cat}: ${curStr(cur, total)} total${vcNote}. Complete list of bills in this category (nothing else belongs here): ${breakdown}.`;
    });

  parts.push(
    "",
    "MONTHLY TOTALS (payable bills only — excludes auto-charged card bills):",
    monthLines.join("\n"),
    "",
    "SPENDING BY CATEGORY (includes auto-charged card bills — use for category/business cost questions). When asked about ONE category, answer with that category's total and ONLY the bills in its 'Complete list' — never add a bill listed under a different category, and if 'directly payable' is ₱0 then there is NO direct-pay bill to name:",
    catLines.join("\n"),
    "",
    "WHEN ASKED ABOUT ONE BUSINESS (e.g. \"how much do I still need to pay for <business>\"): use ONLY that exact entity's line in 'Business breakdown by entity' above. The amount they must pay SEPARATELY is that entity's 'directly payable' figure — name only the bills in its 'Directly payable bills' list; auto-charged bills are already covered by their card statements (mention them as such if relevant). NEVER name, count, or substitute a bill that belongs to a DIFFERENT business or category. If that entity's 'directly payable' is ₱0, there is NOTHING to pay separately — say so plainly (the auto-charged bills are settled via the cards); do NOT grab a payable bill from another business to fill the gap.",
    "",
    "BILLS ([BUSINESS]/[PERSONAL]; [AUTO-CHARGED to X] = auto-paid via that card, already counted inside its statement, NOT added to the payment totals):",
    lines.join("\n"),
  );

  return parts.join("\n");
}

async function loadUserData(userId: string) {
  const admin = getSupabaseAdmin();
  const [profileRes, billsRes] = await Promise.all([
    admin.from("profiles").select("persona, voice_id").eq("id", userId).maybeSingle(),
    admin.from("bills").select("*").eq("user_id", userId),
  ]);
  const persona = coercePersona(profileRes.data?.persona);
  const voiceId: string =
    (profileRes.data?.voice_id as string | null) || DEFAULT_VOICE_IDS[persona];
  const bills = (billsRes.data ?? []) as BillRow[];
  return { persona, voiceId, bills };
}

/** Returns the authenticated Supabase user, or a guest sentinel when no
 *  valid token is present. The guest fallback is temporary while we diagnose
 *  a custom-domain Supabase URL mismatch between client and server — without
 *  it every ask fails. Re-tighten this once the URL config is reconciled. */
async function requireUser(req: Request, res: Response) {
  const token = bearerToken(req.headers.authorization);
  if (token) {
    const user = await getUserFromToken(token);
    if (user) return user;
    logger.warn("[auth] token present but rejected — falling back to guest");
  }
  // Guest sentinel: rate limiters fall back to IP-keying for this caller.
  // The /delete-account route still explicitly rejects guests, so this does
  // not re-open destructive operations.
  return { id: "guest", email: undefined, role: "guest" } as const;
}
// POST /api/judith/delete-account -> { ok: true }
// Permanently removes the authenticated user's bills, profile, and auth account.
router.post("/delete-account", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    if (user.id === "guest") {
      res.status(401).json({ error: "Sign in required to delete an account" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { error: billsErr } = await admin
      .from("bills")
      .delete()
      .eq("user_id", user.id);
    if (billsErr) throw billsErr;
    await admin.from("profiles").delete().eq("id", user.id);
    const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
    if (authErr) throw authErr;
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete-account failed");
    res.status(500).json({ error: "Account deletion failed" });
  }
});

// POST /api/judith/stt  { audioBase64, mimeType } -> { text }
router.post("/stt", sttTtsLimiter, async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const { audioBase64, mimeType, language } = req.body ?? {};
    if (typeof audioBase64 !== "string" || !audioBase64) {
      res.status(400).json({ error: "audioBase64 is required" });
      return;
    }
    const buffer = Buffer.from(audioBase64, "base64");
    const text = await transcribe(
      buffer,
      typeof mimeType === "string" ? mimeType : "audio/m4a",
      typeof language === "string" ? language : undefined,
    );
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "stt failed");
    res.status(500).json({ error: "Transcription failed" });
  }
});

// POST /api/judith/ask  { text } -> { reply, audioBase64, mime }
function pickModel(question: string, historyLen: number): string {
  const isComplex = historyLen > 3
    || question.length > 120
    || /compare|project|forecast|breakdown|trend|analysis|next.{0,10}month|across|budget|pattern|versus|\bvs\b/i.test(question);
  return isComplex ? ANTHROPIC_MODEL : ANTHROPIC_HAIKU_MODEL;
}

router.post("/ask", askLimiter, async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const { text, bills: bodyBills, persona: bodyPersona, localDate, localWeekday: rawLocalWeekday, language, includeVoice, currency, countryName, countryCode, monthlyIncome, incomeByMonth, payCycle, paydayDay, paydaySemi, paydayWeekday, history: bodyHistory } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const today = parseLocalDate(localDate);
    const cur: string = typeof currency === "string" && currency.trim() ? currency.trim() : "₱";
    const country: string = typeof countryName === "string" && countryName.trim() ? countryName.trim() : "the Philippines";
    const cCode: string | undefined = typeof countryCode === "string" && countryCode.trim() ? countryCode.trim() : undefined;

    // Bills MUST come from the client. Never fall back to loading another
    // user's data from Supabase — that would be a cross-user data leak.
    if (!Array.isArray(bodyBills)) {
      res.status(400).json({ error: "bills array is required" });
      return;
    }

    const persona: PersonaId = coercePersona(bodyPersona);
    const voiceId: string = getVoiceId(persona, typeof language === "string" ? language : undefined, cCode);
    const income: number | undefined = typeof monthlyIncome === "number" && monthlyIncome > 0 ? monthlyIncome : undefined;
    const incomeMo: Record<string, number> | undefined =
      incomeByMonth != null && typeof incomeByMonth === "object" && !Array.isArray(incomeByMonth)
        ? Object.fromEntries(
            Object.entries(incomeByMonth as Record<string, unknown>)
              .filter(([, v]) => typeof v === "number" && (v as number) > 0)
              .map(([k, v]) => [k, v as number]),
          )
        : undefined;
    const cycle: string | undefined = ["monthly", "semi-monthly", "weekly"].includes(payCycle) ? payCycle as string : undefined;
    const safeDay: number | undefined = typeof paydayDay === "number" && paydayDay >= 1 && paydayDay <= 31 ? paydayDay : undefined;
    const safeSemi: [number, number] | undefined =
      Array.isArray(paydaySemi) && paydaySemi.length === 2 &&
      typeof paydaySemi[0] === "number" && typeof paydaySemi[1] === "number" &&
      paydaySemi[0] >= 1 && paydaySemi[1] > paydaySemi[0] && paydaySemi[1] <= 31
        ? [paydaySemi[0] as number, paydaySemi[1] as number]
        : undefined;
    const safeWeekday: number | undefined = typeof paydayWeekday === "number" && paydayWeekday >= 0 && paydayWeekday <= 6 ? paydayWeekday : undefined;
    const safeLocalWeekday = typeof rawLocalWeekday === "string" && rawLocalWeekday.trim() ? rawLocalWeekday.trim() : undefined;
    const context: string = buildClientContext(bodyBills as ClientBill[], today, cur, income, incomeMo, cycle, safeDay, safeSemi, safeWeekday, safeLocalWeekday);

    // Sanitize conversation history sent by the client. Cap at 5 turns to control cost.
    type AnthropicMessage = { role: "user" | "assistant"; content: string };
    const historyMessages: AnthropicMessage[] = [];
    if (Array.isArray(bodyHistory)) {
      for (const turn of bodyHistory.slice(-5)) {
        if (
          turn && typeof turn === "object" &&
          (turn.role === "user" || turn.role === "assistant") &&
          typeof turn.text === "string" && turn.text.trim()
        ) {
          historyMessages.push({ role: turn.role as "user" | "assistant", content: turn.text.trim() });
        }
      }
    }

    const anthropic = getAnthropic();
    const model = pickModel(text, historyMessages.length);
    // Plain string system prompt. Prompt caching reverted — could be
    // breaking the Anthropic SDK response shape. Restore later behind a flag.
    const systemStr = `${systemPrompt(persona, typeof language === "string" ? language : undefined, country, cur, cCode)}\n\nBILL CONTEXT (the only source of truth):\n${context}`;
    const msgs: AnthropicMessage[] = [...historyMessages, { role: "user", content: text.trim() }];
    const ttsLang = typeof language === "string" ? language : undefined;

    const doTts = async (reply: string) => {
      if (includeVoice === false) return { audioBase64: null as string | null, mime: "audio/mpeg", ttsOk: false, ttsChars: 0, ttsMs: 0 };
      const ttsStart = Date.now();
      let audioBase64: string | null = null;
      let mime = "audio/mpeg";
      let ttsOk = false;
      let ttsChars = 0;
      try {
        const [safe, audio] = await Promise.all([
          isSafeForTTS(reply),
          synthesize(reply, voiceId, { live: true, speed: getSpeakingSpeed(persona), language: ttsLang }).catch(() => null),
        ]);
        if (!safe) {
          logger.warn("tts skipped — moderation flagged reply");
        } else if (audio) {
          audioBase64 = audio.base64;
          mime = audio.mime;
          ttsOk = true;
          ttsChars = reply.length;
        }
      } catch (ttsErr) {
        logger.error({ err: ttsErr }, "tts failed during ask");
      }
      return { audioBase64, mime, ttsOk, ttsChars, ttsMs: Date.now() - ttsStart };
    };

    const doLog = (reply: string, ttsOk: boolean, ttsChars: number, inputTokens: number, outputTokens: number, llmMs: number, ttsMs: number, totalMs: number, usedModel: string) => {
      getSupabaseAdmin()
        .from("ask_logs")
        .insert({
          user_id: user.id,
          persona,
          language: typeof language === "string" ? language : "en",
          input_chars: text.trim().length,
          reply_chars: reply.length,
          tts_ok: ttsOk,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          llm_ms: llmMs,
          tts_ms: ttsMs,
          total_ms: totalMs,
          model: usedModel,
        })
        .then(({ error }) => {
          if (error) logger.warn({ err: error }, "ask_logs insert failed");
        });
    };

    if (req.body?.stream === true) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const llmStart = Date.now();
      let rawText = "";
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        const stream = anthropic.messages.stream({ model, max_tokens: 200, system: systemStr, messages: msgs });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const chunk = event.delta.text;
            rawText += chunk;
            res.write(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`);
          }
        }
        const final = await stream.finalMessage();
        inputTokens = final.usage.input_tokens;
        outputTokens = final.usage.output_tokens;
      } catch (streamErr) {
        logger.error({ err: streamErr }, "ask stream failed");
        try { res.write(`data: ${JSON.stringify({ type: "error" })}\n\n`); } catch {}
        res.end();
        return;
      }
      const llmMs = Date.now() - llmStart;

      const { cleanText: reply, action } = parseAction(rawText.trim());
      const { audioBase64, mime, ttsOk, ttsChars, ttsMs } = await doTts(reply);
      const totalMs = Date.now() - llmStart;
      res.write(`data: ${JSON.stringify({ type: "done", reply, action: action ?? null, audioBase64, mime })}\n\n`);
      res.end();
      doLog(reply, ttsOk, ttsChars, inputTokens, outputTokens, llmMs, ttsMs, totalMs, model);
      return;
    }

    // Non-streaming path — used by Watch and clients that don't support SSE.
    const llmStart = Date.now();
    const message = await anthropic.messages.create({ model, max_tokens: 200, system: systemStr, messages: msgs });
    const llmMs = Date.now() - llmStart;

    const rawReply = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();
    const { cleanText: reply, action } = parseAction(rawReply);
    const { audioBase64, mime, ttsOk, ttsChars, ttsMs } = await doTts(reply);
    const totalMs = Date.now() - llmStart;

    res.json({ reply, audioBase64, mime, action });
    doLog(reply, ttsOk, ttsChars, message.usage.input_tokens, message.usage.output_tokens, llmMs, ttsMs, totalMs, model);
  } catch (err) {
    logger.error({ err }, "ask failed");
    res.status(500).json({ error: "Judith could not respond right now" });
  }
});


// POST /api/judith/tts  { text, persona? } -> { audioBase64, mime }
router.post("/tts", sttTtsLimiter, async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const { text, persona, voiceId: bodyVoiceId, language, countryCode } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const { voiceId, persona: profilePersona } = await loadUserData(user.id);
    const chosen = persona ? coercePersona(persona) : profilePersona;
    const lang = typeof language === "string" ? language : undefined;
    const cCode = typeof countryCode === "string" && countryCode.trim() ? countryCode.trim() : undefined;
    const voice =
      typeof bodyVoiceId === "string" && bodyVoiceId
        ? bodyVoiceId
        : persona
          ? getVoiceId(chosen, lang, cCode)
          : voiceId;
    if (!(await isSafeForTTS(text.trim()))) {
      logger.warn("tts request blocked — moderation flagged user-submitted text");
      res.status(400).json({ error: "Content not suitable for speech synthesis" });
      return;
    }
    const audio = await synthesize(text.trim(), voice, { live: false, speed: getSpeakingSpeed(chosen) });
    res.json({ audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "tts failed");
    res.status(500).json({ error: "Speech synthesis failed" });
  }
});

// GET /api/judith/sample?persona=  -> { text, audioBase64, mime }
const SAMPLE_LINES_FIL: Record<PersonaId, string> = {
  professional:
    "Si Judith 'to. Bantayan ko ang lahat ng due dates mo — wala kang mapapala sa late fees, so ayusin natin 'yan.",
  funny:
    "Uy! Si Judith — 'yung pinaka-responsible mong kaibigan pagdating sa bills. Hindi ka na late, promise. Mostly.",
  sarcastic:
    "Si Judith 'to. Oo, nagpapa-alaala ako ng bills mo. Kasi ikaw? Ikaw talaga. Sige, tara na.",
  mom:
    "Anak, si Judith 'to. Nandito na ako, 'wag kang mag-alala. Bantayan ko ang mga bayarin mo — walang makakalusot sa akin, ha.",
  marites:
    "Besh, chismis muna! Si Judith 'to — at alam ko na lahat ng bills mo! Grabe, 'di ba? Wala kang makakalimutan, promise. Mag-update ka ha!",
  britney:
    "Judith. Bills mo, due dates, amounts — naka-track na lahat. 'Yun lang.",
};

const SAMPLE_LINES_EN: Record<PersonaId, string> = {
  professional:
    "I'm Judith — your due date assistant. I track every bill so you're never hit with a late fee again.",
  funny:
    "Hi! I'm Judith — basically your most financially responsible friend. You're welcome, by the way.",
  sarcastic:
    "Judith here. I remind you about your bills. Because apparently that's something someone has to do.",
  mom:
    "Hi there — I'm Judith. I'll keep an eye on all your bills for you. Don't worry, I've got everything covered.",
  marites:
    "Oh my gosh, hi! It's Judith! I literally know everything about your bills — and trust me, we need to talk!",
  britney:
    "Judith. Bills, amounts, due dates — tracked. Pay them on time. That's the deal.",
};

const SAMPLE_LINES_ILO: Record<PersonaId, string> = {
  professional: "Kablaaw, siak ni Judith. Ipalagipko kenka sakbay ti aldaw ti panagbayadmo.",
  funny: "Kablaaw! Siak ni Judith — ti pinaka-responsible nga kaibigan pagdating iti bills. Adda ak ditoy!",
  sarcastic: "Siak ni Judith. Ilagiputek dagiti bills mo. Wen, kasapulan ti maysa.",
  mom: "Ading, siak ni Judith. Bantayan ko dagiti bills mo — saan ka ag-alaala.",
  marites: "Hoy! Siak ni Judith — amok amin dagiti bills mo! Nakakaingganyo, 'di ba?",
  britney: "Judith. Bills mo, due dates — naka-track amin.",
};

const SAMPLE_LINES_CEB: Record<PersonaId, string> = {
  professional: "Uy, si Judith ni. Pahinumduman tika sa dili pa ma-due ang imong bayranan.",
  funny: "Uy! Si Judith ni — ang pinaka-responsible nimong amigo sa bills. Naa ko, promise!",
  sarcastic: "Si Judith ni. Pahinumduman tika sa imong bills. Kay ikaw? Kinahanglan nimo.",
  mom: "Anak, si Judith ni. Bantayan ko ang imong mga bayad — ayaw kabalaka.",
  marites: "Hoy! Si Judith ni — nahibal-an nako tanan imong bills! Grabe, 'di ba?",
  britney: "Judith. Imong bills, due dates — tracked.",
};

const SAMPLE_LINES_HIL: Record<PersonaId, string> = {
  professional: "Kumusta, si Judith ko. Pahibaluon ko ikaw antes mag-due ang imo bayaron.",
  funny: "Kumusta! Si Judith ko — ang pinaka-responsible nga abyan mo sa bills. Nag-abot na!",
  sarcastic: "Si Judith ko. Pahibaluon ko ikaw sa imo mga bayad. Oo, kinahanglan nimo.",
  mom: "Anak, si Judith ko. Bantayan ko ang imo mga bayad — indi mag-alala.",
  marites: "Hoy! Si Judith ko — nahibaluan ko na tanan imo bills! Makapainteres, 'di ba?",
  britney: "Judith. Imo bills, due dates — tracked.",
};

const FILIPINO_LANG_CODES = new Set(["fil", "ceb", "ilo", "hil"]);

type PersonaSamples = Partial<Record<PersonaId, string>>;

const SAMPLE_LINES_BY_LANG: Record<string, PersonaSamples> = {
  es: {
    professional:
      "Soy Judith, tu asistente de fechas de vencimiento. Me encargo de que nunca te pille por sorpresa una mora.",
    funny:
      "¡Hola! Soy Judith — básicamente tu amiga más responsable con el dinero. De nada, por cierto.",
    sarcastic:
      "Judith aquí. Te recuerdo tus facturas. Porque al parecer alguien tiene que hacerlo.",
    mom: "Hola, soy Judith. Voy a vigilar todas tus facturas. No te preocupes, lo tengo todo bajo control.",
    marites:
      "¡Dios mío, hola! ¡Soy Judith! Literalmente sé todo sobre tus facturas — y tenemos que hablar.",
  },
  pt: {
    professional:
      "Sou a Judith, sua assistente de datas de vencimento. Cuido para que você nunca seja pega de surpresa por uma multa.",
    funny:
      "Oi! Sou a Judith — basicamente sua amiga mais responsável com dinheiro. De nada, aliás.",
    sarcastic:
      "Judith aqui. Te lembro das suas contas. Porque aparentemente alguém tem que fazer isso.",
    mom: "Oi, sou a Judith. Vou cuidar de todas as suas contas. Não se preocupe, tenho tudo sob controle.",
    marites:
      "Meu Deus, oi! Sou a Judith! Literalmente sei tudo sobre suas contas — e a gente precisa conversar.",
  },
  "pt-PT": {
    professional:
      "Sou a Judith, a tua assistente de datas de vencimento. Trato de que nunca sejas apanhada de surpresa por uma mora.",
    funny:
      "Olá! Sou a Judith — basicamente a tua amiga mais responsável a nível financeiro. De nada, por acaso.",
    sarcastic:
      "Judith aqui. Lembro-te das tuas faturas. Porque ao que parece alguém tem de o fazer.",
    mom: "Olá, sou a Judith. Vou vigiar todas as tuas faturas. Não te preocupes, tenho tudo sob controlo.",
    marites:
      "Meu Deus, olá! Sou a Judith! Literalmente sei tudo sobre as tuas faturas — e temos de falar.",
  },
  fr: {
    professional:
      "Je suis Judith, votre assistante de dates d'échéance. Je veille à ce que vous ne soyez jamais surpris par des pénalités de retard.",
    funny:
      "Bonjour! Je suis Judith — en gros votre amie la plus responsable côté finances. De rien, au passage.",
    sarcastic:
      "Judith ici. Je vous rappelle vos factures. Parce qu'apparemment quelqu'un doit le faire.",
    mom: "Bonjour, je suis Judith. Je vais surveiller toutes vos factures. Ne vous inquiétez pas, j'ai tout sous contrôle.",
    marites:
      "Mon Dieu, bonjour! C'est Judith! Je sais littéralement tout sur vos factures — et on doit vraiment parler.",
  },
  de: {
    professional:
      "Ich bin Judith, Ihre Fälligkeitsdaten-Assistentin. Ich sorge dafür, dass Sie nie von einem Zahlungsverzug überrascht werden.",
    funny:
      "Hi! Ich bin Judith — sozusagen Ihre finanziell verantwortungsvollste Freundin. Bitte sehr, übrigens.",
    sarcastic:
      "Judith hier. Ich erinnere Sie an Ihre Rechnungen. Weil das anscheinend jemand tun muss.",
    mom: "Hallo, ich bin Judith. Ich behalte all Ihre Rechnungen im Blick. Machen Sie sich keine Sorgen, ich habe alles unter Kontrolle.",
    marites:
      "Oh mein Gott, hallo! Ich bin Judith! Ich weiß buchstäblich alles über Ihre Rechnungen — und wir müssen reden.",
  },
  it: {
    professional:
      "Sono Judith, la tua assistente per le scadenze di pagamento. Mi assicuro che tu non venga mai colta di sorpresa da una mora.",
    funny:
      "Ciao! Sono Judith — praticamente la tua amica più responsabile con i soldi. Prego, tra l'altro.",
    sarcastic:
      "Qui Judith. Ti ricordo le tue bollette. Perché apparentemente qualcuno deve farlo.",
    mom: "Ciao, sono Judith. Terrò d'occhio tutte le tue bollette. Non preoccuparti, ho tutto sotto controllo.",
    marites:
      "Madonna, ciao! Sono Judith! Letteralmente so tutto delle tue bollette — e dobbiamo parlare.",
  },
  nl: {
    professional:
      "Ik ben Judith, uw assistent voor vervaldatums. Ik zorg ervoor dat u nooit verrast wordt door een late betaling.",
    funny:
      "Hoi! Ik ben Judith — eigenlijk uw meest financieel verantwoordelijke vriendin. Graag gedaan, trouwens.",
    sarcastic:
      "Judith hier. Ik herinner u aan uw rekeningen. Omdat dat blijkbaar iemand moet doen.",
    mom: "Hoi, ik ben Judith. Ik houd al uw rekeningen in de gaten. Maak u geen zorgen, ik heb alles onder controle.",
    marites:
      "Oh mijn god, hoi! Ik ben Judith! Ik weet letterlijk alles over uw rekeningen — en we moeten praten.",
  },
  pl: {
    professional:
      "Jestem Judith, twoją asystentką terminów płatności. Dbam o to, żebyś nigdy nie była zaskoczona opłatą za spóźnienie.",
    funny:
      "Cześć! Jestem Judith — w zasadzie twoja najbardziej odpowiedzialna finansowo przyjaciółka. Proszę bardzo, przy okazji.",
    sarcastic:
      "Judith tu. Przypominam ci o twoich rachunkach. Bo podobno ktoś musi to robić.",
    mom: "Cześć, jestem Judith. Będę pilnować wszystkich twoich rachunków. Nie martw się, mam wszystko pod kontrolą.",
    marites:
      "O Boże, cześć! Jestem Judith! Dosłownie wiem wszystko o twoich rachunkach — i musimy porozmawiać.",
  },
  sv: {
    professional:
      "Jag är Judith, din assistent för förfallodatum. Jag ser till att du aldrig överraskas av en förseningsavgift.",
    funny:
      "Hej! Jag är Judith — i princip din mest ekonomiskt ansvarsfulla vän. Varsågod, förresten.",
    sarcastic:
      "Judith här. Jag påminner dig om dina räkningar. För tydligen måste någon göra det.",
    mom: "Hej, jag är Judith. Jag håller koll på alla dina räkningar. Oroa dig inte, jag har allt under kontroll.",
    marites:
      "Åh vad kul, hej! Det är Judith! Jag vet bokstavligen allt om dina räkningar — och vi måste prata.",
  },
  da: {
    professional:
      "Jeg er Judith, din assistent for forfaldsdatoer. Jeg sørger for, at du aldrig overraskes af et gebyr for forsinket betaling.",
    funny:
      "Hej! Jeg er Judith — dybest set din mest økonom-ansvarlige veninde. Selv tak, i øvrigt.",
    sarcastic:
      "Judith her. Jeg minder dig om dine regninger. Fordi nogen åbenbart er nødt til det.",
    mom: "Hej, jeg er Judith. Jeg holder øje med alle dine regninger. Bekymr dig ikke, jeg har styr på det hele.",
    marites:
      "Åh gud, hej! Det er Judith! Jeg ved bogstaveligt talt alt om dine regninger — og vi er nødt til at tale.",
  },
  no: {
    professional:
      "Jeg er Judith, din assistent for forfallsdatoer. Jeg sørger for at du aldri overraskes av et gebyr for forsinket betaling.",
    funny:
      "Hei! Jeg er Judith — i bunn og grunn din mest økonomisk ansvarlige venn. Vær så god, forresten.",
    sarcastic:
      "Judith her. Jeg minner deg på regningene dine. For tilsynelatende må noen gjøre det.",
    mom: "Hei, jeg er Judith. Jeg holder øye med alle regningene dine. Ikke bekymre deg, jeg har alt under kontroll.",
    marites:
      "Å Gud, hei! Det er Judith! Jeg vet bokstavelig talt alt om regningene dine — og vi må snakke.",
  },
  fi: {
    professional:
      "Olen Judith, eräpäiväavustajasi. Huolehdin siitä, että sinulle ei tule koskaan yllätyksenä myöhästymismaksu.",
    funny:
      "Hei! Olen Judith — käytännössä taloudellisin vastuullisin ystäväsi. Ole hyvä, muuten.",
    sarcastic:
      "Judith täällä. Muistutan sinua laskuistasi. Koska ilmeisesti jonkun täytyy tehdä se.",
    mom: "Hei, olen Judith. Pidän silmällä kaikkia laskujasi. Älä huoli, minulla on kaikki hallinnassa.",
    marites:
      "Voi Luoja, hei! Judith täällä! Tiedän kirjaimellisesti kaiken laskuistasi — ja meidän täytyy puhua.",
  },
  cs: {
    professional:
      "Jsem Judith, vaše asistentka pro termíny splatnosti. Starám se o to, abyste nikdy nebyla překvapena poplatkem za pozdní platbu.",
    funny:
      "Ahoj! Jsem Judith — v podstatě vaše nejfinančně odpovědnější kamarádka. Prosím, mimochodem.",
    sarcastic:
      "Judith tady. Připomínám vám vaše účty. Protože to zjevně musí někdo dělat.",
    mom: "Ahoj, jsem Judith. Budu hlídat všechny vaše účty. Nebojte se, mám vše pod kontrolou.",
    marites:
      "Bože, ahoj! Jsem Judith! Doslova vím vše o vašich účtech — a musíme si promluvit.",
  },
  sk: {
    professional:
      "Som Judith, vaša asistentka pre termíny splatnosti. Starám sa o to, aby vás nikdy neprekvapil poplatok za oneskorenú platbu.",
    funny:
      "Ahoj! Som Judith — v podstate vaša najfinančne zodpovednejšia kamarátka. Prosím, mimochodom.",
    sarcastic:
      "Judith tu. Pripomínam vám vaše účty. Pretože to zjavne musí niekto robiť.",
    mom: "Ahoj, som Judith. Budem strážiť všetky vaše účty. Nebojte sa, mám všetko pod kontrolou.",
    marites:
      "Bože, ahoj! Som Judith! Doslova viem všetko o vašich účtoch — a musíme sa porozprávať.",
  },
  ro: {
    professional:
      "Sunt Judith, asistenta ta pentru termenele de plată. Mă asigur că nu ești niciodată surprinsă de o penalitate de întârziere.",
    funny:
      "Bună! Sunt Judith — practic prietena ta cea mai responsabilă financiar. Cu plăcere, apropo.",
    sarcastic:
      "Judith aici. Îți amintesc de facturile tale. Pentru că aparent cineva trebuie să o facă.",
    mom: "Bună, sunt Judith. Voi ține un ochi pe toate facturile tale. Nu te îngrijora, am totul sub control.",
    marites:
      "Doamne, bună! Sunt Judith! Știu literalmente totul despre facturile tale — și trebuie să vorbim.",
  },
  bg: {
    professional:
      "Аз съм Джудит, вашият асистент за падежи на плащане. Грижа се да не бъдете никога изненадана от такса за закъснение.",
    funny:
      "Здравей! Аз съм Джудит — на практика най-финансово отговорната ти приятелка. Моля, между другото.",
    sarcastic:
      "Джудит тук. Напомням ти за сметките ти. Защото очевидно някой трябва да го прави.",
    mom: "Здравей, аз съм Джудит. Ще следя всичките ти сметки. Не се притеснявай, имам всичко под контрол.",
    marites:
      "Боже мой, здравей! Аз съм Джудит! Буквално знам всичко за сметките ти — и трябва да поговорим.",
  },
  hr: {
    professional:
      "Ja sam Judith, vaša asistentka za rokove plaćanja. Brinem se da vas nikada ne iznenadi naknada za kašnjenje.",
    funny:
      "Bok! Ja sam Judith — u biti vaša najfinancijski odgovornija prijateljica. Nema na čemu, usput.",
    sarcastic:
      "Judith ovdje. Podsjećam vas na vaše račune. Jer očito netko to mora raditi.",
    mom: "Bok, ja sam Judith. Pazit ću na sve vaše račune. Ne brinite, sve imam pod kontrolom.",
    marites:
      "Bože moj, bok! Ja sam Judith! Doslovno znam sve o vašim računima — i moramo razgovarati.",
  },
  el: {
    professional:
      "Είμαι η Τζούντιθ, η βοηθός σου για τις ημερομηνίες λήξης. Φροντίζω να μην σε εκπλήσσει ποτέ μια χρέωση καθυστέρησης.",
    funny:
      "Γεια! Είμαι η Τζούντιθ — ουσιαστικά η πιο οικονομικά υπεύθυνη φίλη σου. Παρακαλώ, παρεμπιπτόντως.",
    sarcastic:
      "Τζούντιθ εδώ. Σου θυμίζω τους λογαριασμούς σου. Επειδή προφανώς κάποιος πρέπει να το κάνει.",
    mom: "Γεια, είμαι η Τζούντιθ. Θα παρακολουθώ όλους τους λογαριασμούς σου. Μην ανησυχείς, τα έχω όλα υπό έλεγχο.",
    marites:
      "Θεέ μου, γεια! Είμαι η Τζούντιθ! Ξέρω κυριολεκτικά τα πάντα για τους λογαριασμούς σου — και πρέπει να μιλήσουμε.",
  },
  hu: {
    professional:
      "Judith vagyok, a fizetési határidő-asszisztensed. Gondoskodom arról, hogy soha ne lepjen meg késedelmi díj.",
    funny:
      "Szia! Judith vagyok — lényegében a legjobban pénzügyileg felelős barátod. Szívesen, egyébként.",
    sarcastic:
      "Judith itt. Emlékeztetlek a számláidra. Mert nyilván valakinek meg kell tennie.",
    mom: "Szia, Judith vagyok. Szemmel tartom az összes számládat. Ne aggódj, mindent kézben tartok.",
    marites:
      "Istenem, szia! Judith vagyok! Szó szerint mindent tudok a számláidról — és beszélnünk kell.",
  },
  uk: {
    professional:
      "Я Джудіт, ваш помічник з термінів платежів. Стежу за тим, щоб вас ніколи не застав зненацька штраф за прострочення.",
    funny:
      "Привіт! Я Джудіт — по суті ваша найбільш фінансово відповідальна подруга. Будь ласка, до речі.",
    sarcastic:
      "Джудіт тут. Нагадую вам про ваші рахунки. Бо очевидно хтось це має робити.",
    mom: "Привіт, я Джудіт. Буду стежити за всіма вашими рахунками. Не хвилюйтеся, у мене все під контролем.",
    marites:
      "Боже мій, привіт! Я Джудіт! Буквально знаю все про ваші рахунки — і нам потрібно поговорити.",
  },
  ru: {
    professional:
      "Я Джудит, ваш помощник по срокам платежей. Слежу за тем, чтобы вас никогда не застали врасплох просроченные платежи.",
    funny:
      "Привет! Я Джудит — по сути ваша самая финансово ответственная подруга. Пожалуйста, кстати.",
    sarcastic:
      "Джудит здесь. Напоминаю вам о ваших счетах. Потому что очевидно кто-то должен это делать.",
    mom: "Привет, я Джудит. Буду следить за всеми вашими счетами. Не беспокойтесь, у меня всё под контролем.",
    marites:
      "Боже мой, привет! Я Джудит! Буквально знаю всё о ваших счетах — и нам нужно поговорить.",
  },
  tr: {
    professional:
      "Ben Judith, vade tarihi asistanınım. Asla geç ödeme ücreti sürpriziyle karşılaşmamanızı sağlıyorum.",
    funny:
      "Merhaba! Ben Judith — temelde en mali sorumlu arkadaşınız. Rica ederim, bu arada.",
    sarcastic:
      "Judith burada. Faturalarınızı hatırlatıyorum. Çünkü bunu birinin yapması gerekiyor.",
    mom: "Merhaba, ben Judith. Tüm faturalarınıza göz kulak olacağım. Merak etmeyin, her şey kontrol altında.",
    marites:
      "Tanrım, merhaba! Ben Judith! Faturalarınız hakkında kelimenin tam anlamıyla her şeyi biliyorum — ve konuşmamız gerek.",
  },
  ar: {
    professional:
      "أنا جوديث، مساعدتك لمواعيد الاستحقاق. أحرص على ألا تُفاجئك رسوم التأخير أبداً.",
    funny:
      "مرحباً! أنا جوديث — بالأساس صديقتك الأكثر مسؤولية مالياً. عفواً، بالمناسبة.",
    sarcastic:
      "جوديث هنا. أذكّرك بفواتيرك. لأن أحداً ما يجب أن يفعل ذلك.",
    mom: "مرحباً، أنا جوديث. سأتابع جميع فواتيرك. لا تقلقي، أنا أتحكم في كل شيء.",
    marites:
      "يا إلهي، مرحباً! أنا جوديث! أعرف حرفياً كل شيء عن فواتيرك — وعلينا أن نتحدث.",
  },
  arz: {
    professional:
      "أنا جوديث، المساعدة بتاعتك لمواعيد الاستحقاق. بتأكد إنك متتفاجئيش بمصاريف التأخير أبداً.",
    funny:
      "أهلاً! أنا جوديث — أساساً صاحبتك الأكثر مسؤولية مالياً. على إيه، بالمناسبة.",
    sarcastic:
      "جوديث هنا. بفكّرك بفواتيرك. لأن حد لازم يعمل كده.",
    mom: "أهلاً، أنا جوديث. هتابع كل فواتيرك. متقلقيش، أنا مسيطرة على كل حاجة.",
    marites:
      "يا سلام، أهلاً! أنا جوديث! بعرف حرفياً كل حاجة عن فواتيرك — ولازم نتكلم.",
  },
  apc: {
    professional:
      "أنا جوديث، مساعدتك لمواعيد الاستحقاق. بحرص إنك ما تتفاجئي بغرامات التأخير أبداً.",
    funny:
      "مرحبا! أنا جوديث — بالأساس رفيقتك الأكثر مسؤولية مالياً. عفواً، بالمناسبة.",
    sarcastic:
      "جوديث هون. عم بذكّرك بفواتيرك. لأنه واضح في حدا لازم يعمل هيك.",
    mom: "مرحبا، أنا جوديث. رح تابع كل فواتيرك. ما تقلقي، عندي كل شي تحت السيطرة.",
    marites:
      "يا إلهي، مرحبا! أنا جوديث! بعرف حرفياً كل شي عن فواتيرك — ولازم نحكي.",
  },
  afb: {
    professional:
      "أنا جوديث، مساعدتك لمواعيد الاستحقاق. أضمن ما تتفاجئين من رسوم التأخير أبداً.",
    funny:
      "هلا! أنا جوديث — بالأساس صديقتك الأكثر مسؤولية مالياً. عفواً، بالمناسبة.",
    sarcastic:
      "جوديث هني. أذكّرك بفواتيرك. لأنه واضح في أحد لازم يسوي هذا.",
    mom: "هلا، أنا جوديث. راح أتابع جميع فواتيرك. لا تقلقين، كل شي تحت السيطرة.",
    marites:
      "يا الله، هلا! أنا جوديث! أعرف حرفياً كل شي عن فواتيرك — ولازم نتكلم.",
  },
  hi: {
    professional:
      "मैं जूडिथ हूँ, आपकी देय तिथि सहायक। मैं सुनिश्चित करती हूँ कि आप कभी भी विलंब शुल्क से चौंके नहीं।",
    funny:
      "नमस्ते! मैं जूडिथ हूँ — basically आपकी सबसे financially जिम्मेदार दोस्त। वैसे, शुक्रिया।",
    sarcastic:
      "जूडिथ यहाँ। आपको बिलों की याद दिला रही हूँ। क्योंकि जाहिर है कोई तो यह करेगा।",
    mom: "नमस्ते, मैं जूडिथ हूँ। मैं आपके सभी बिलों पर नज़र रखूँगी। चिंता मत करो, सब कुछ मेरे हाथ में है।",
    marites:
      "भगवान, नमस्ते! मैं जूडिथ हूँ! मुझे आपके सभी बिलों के बारे में सच में सब कुछ पता है — और हमें बात करनी होगी।",
  },
  ta: {
    professional:
      "நான் ஜூடித், உங்கள் தவணை தேதி உதவியாளர். நீங்கள் தாமதக் கட்டணத்தால் ஒருபோதும் அதிர்ச்சியடையாமல் பார்த்துக்கொள்கிறேன்.",
    funny:
      "வணக்கம்! நான் ஜூடித் — basically உங்கள் மிகவும் நிதி பொறுப்பான தோழி. நன்றி சொல்ல வேண்டாம்!",
    sarcastic:
      "ஜூடித் இங்கே. உங்கள் கட்டணங்களை நினைவூட்டுகிறேன். ஏனெனில் யாராவது செய்ய வேண்டும்.",
    mom: "வணக்கம், நான் ஜூடித். உங்கள் அனைத்து கட்டணங்களையும் கவனிப்பேன். கவலைப்படாதீர்கள், எல்லாம் என் கட்டுப்பாட்டில் உள்ளது.",
    marites:
      "ஐயோ, வணக்கம்! நான் ஜூடித்! உங்கள் கட்டணங்களைப் பற்றி எல்லாம் தெரியும் — நாம் பேசவேண்டும்.",
  },
  ja: {
    professional:
      "ジュディスです。お支払い期日のアシスタントとして、延滞料金で驚かされることがないよう管理します。",
    funny:
      "こんにちは！ジュディスです — 基本的に、あなたの一番お金に責任感のある友達です。どういたしまして、ちなみに。",
    sarcastic:
      "ジュディスです。請求書を思い出させます。誰かがやらないといけないので。",
    mom: "こんにちは、ジュディスです。あなたの請求書をすべて見守ります。心配しないで、全部任せてください。",
    marites:
      "えー、こんにちは！ジュディスです！あなたの請求書について本当に全部知ってますよ — ちょっとお話しましょう！",
  },
  ko: {
    professional:
      "저는 주디스예요, 납부일 도우미입니다. 연체료에 절대 놀라지 않도록 챙겨드릴게요.",
    funny:
      "안녕하세요! 저는 주디스 — 기본적으로 당신의 가장 재정적으로 책임감 있는 친구예요. 천만에요, 참고로.",
    sarcastic:
      "주디스입니다. 청구서를 알려드리겠습니다. 누군가는 해야 하니까요.",
    mom: "안녕하세요, 주디스예요. 모든 청구서를 다 챙겨드릴게요. 걱정 마세요, 다 제가 알아서 할게요.",
    marites:
      "어머, 안녕하세요! 주디스예요! 청구서 관련해서 진짜 다 알고 있어요 — 우리 얘기 좀 해야 해요.",
  },
  zh: {
    professional:
      "我是茱迪丝，您的账单到期日助手。我会确保您永远不会被滞纳金所惊到。",
    funny:
      "你好！我是茱迪丝 — 基本上是您最有财务责任感的朋友。不客气，顺便一提。",
    sarcastic:
      "茱迪丝在这里。提醒您缴费。因为显然得有人来做这件事。",
    mom: "你好，我是茱迪丝。我会帮您盯着所有账单。别担心，一切尽在掌握之中。",
    marites:
      "天哪，你好！我是茱迪丝！我真的什么账单都知道 — 我们得好好聊聊。",
  },
  yue: {
    professional:
      "我係茱迪絲，你嘅賬單到期日助手。我會確保你永遠唔會俾滯納金嚇親。",
    funny:
      "你好！我係茱迪絲 — 基本上係你最有財務責任感嘅朋友。唔使客氣，順帶一提。",
    sarcastic:
      "茱迪絲喺度。提醒你交費。因為顯然要有人做呢件事。",
    mom: "你好，我係茱迪絲。我會幫你盯住所有賬單。唔使擔心，一切盡在掌握之中。",
    marites:
      "天啊，你好！我係茱迪絲！我真係知道你所有嘅賬單 — 我哋要好好傾吓。",
  },
  id: {
    professional:
      "Aku Judith, asisten tanggal jatuh tempo kamu. Aku memastikan kamu tidak pernah terkejut dengan denda keterlambatan.",
    funny:
      "Halo! Aku Judith — pada dasarnya teman paling bertanggung jawab secara finansial kamu. Sama-sama, omong-omong.",
    sarcastic:
      "Judith di sini. Aku mengingatkan kamu soal tagihan. Karena jelas seseorang harus melakukannya.",
    mom: "Halo, aku Judith. Aku akan mengawasi semua tagihan kamu. Jangan khawatir, semuanya sudah aku tangani.",
    marites:
      "Ya ampun, halo! Ini Judith! Aku benar-benar tahu semua tentang tagihan kamu — dan kita harus ngobrol.",
  },
  ms: {
    professional:
      "Saya Judith, pembantu tarikh matang anda. Saya memastikan anda tidak pernah terkejut dengan caj lewat bayar.",
    funny:
      "Hai! Saya Judith — pada dasarnya rakan paling bertanggungjawab dari segi kewangan bagi anda. Sama-sama, by the way.",
    sarcastic:
      "Judith di sini. Saya mengingatkan anda tentang bil. Kerana jelas seseorang perlu melakukannya.",
    mom: "Hai, saya Judith. Saya akan memantau semua bil anda. Jangan risau, saya ada segalanya di bawah kawalan.",
    marites:
      "Ya Allah, hai! Ini Judith! Saya tahu betul-betul semua tentang bil anda — dan kita perlu bercakap.",
  },
  vi: {
    professional:
      "Tôi là Judith, trợ lý ngày đáo hạn của bạn. Tôi đảm bảo bạn không bao giờ bị bất ngờ vì phí trễ hạn.",
    funny:
      "Chào! Tôi là Judith — về cơ bản là người bạn có trách nhiệm tài chính nhất của bạn. Không có chi, nhân tiện.",
    sarcastic:
      "Judith đây. Tôi nhắc bạn về các hóa đơn. Vì rõ ràng ai đó phải làm điều đó.",
    mom: "Chào, tôi là Judith. Tôi sẽ theo dõi tất cả hóa đơn của bạn. Đừng lo, tôi kiểm soát mọi thứ.",
    marites:
      "Trời ơi, chào! Là Judith đây! Tôi biết mọi thứ về hóa đơn của bạn đó — và chúng ta cần nói chuyện.",
  },
  th: {
    professional:
      "ฉันคือจูดิธ ผู้ช่วยด้านวันครบกำหนดชำระของคุณ ฉันดูแลให้คุณไม่ต้องเซอร์ไพรส์กับค่าปรับล่าช้าเลย",
    funny:
      "สวัสดี! ฉันคือจูดิธ — โดยพื้นฐานแล้วเพื่อนที่มีความรับผิดชอบทางการเงินมากที่สุดของคุณ ยินดีค่ะ",
    sarcastic:
      "จูดิธที่นี่ ฉันเตือนคุณเรื่องบิล เพราะดูเหมือนว่าใครสักคนต้องทำ",
    mom: "สวัสดี ฉันคือจูดิธ ฉันจะดูแลบิลทั้งหมดของคุณ ไม่ต้องกังวล ฉันควบคุมทุกอย่างได้",
    marites:
      "โอ้โห สวัสดี! จูดิธนี่แหละ! ฉันรู้ทุกอย่างเกี่ยวกับบิลของคุณเลย — และเราต้องคุยกัน",
  },
};

function getSampleText(persona: PersonaId, language?: string): string {
  const lang = language ?? "en-US";
  if (lang === "ilo") return SAMPLE_LINES_ILO[persona] ?? SAMPLE_LINES_FIL[persona];
  if (lang === "ceb") return SAMPLE_LINES_CEB[persona] ?? SAMPLE_LINES_FIL[persona];
  if (lang === "hil") return SAMPLE_LINES_HIL[persona] ?? SAMPLE_LINES_FIL[persona];
  if (FILIPINO_LANG_CODES.has(lang)) return SAMPLE_LINES_FIL[persona] ?? SAMPLE_LINES_EN[persona];
  const lines =
    SAMPLE_LINES_BY_LANG[lang] ??
    SAMPLE_LINES_BY_LANG[lang.split("-").slice(0, 2).join("-")] ??
    SAMPLE_LINES_BY_LANG[lang.split("-")[0]];
  // Fall back to English if the language entry exists but lacks this persona's line
  return lines?.[persona] ?? SAMPLE_LINES_EN[persona];
}

// GET /api/judith/voices -> { voices: [{ id, name, category }] }
router.get("/voices", sampleVoicesLimiter, async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const voices = await listVoices();
    res.json({ voices });
  } catch (err) {
    logger.error({ err }, "voices failed");
    res.status(500).json({ error: "Could not load voices" });
  }
});

router.get("/sample", sampleVoicesLimiter, async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const persona = coercePersona(req.query["persona"]);
    const rawLanguage = typeof req.query["language"] === "string" ? req.query["language"] : undefined;
    const countryCode = typeof req.query["countryCode"] === "string" ? req.query["countryCode"] : undefined;

    // Normalize: always resolve to a concrete language code so ElevenLabs receives
    // an explicit language hint and never falls back to auto-detect (which can
    // produce Taglish even for English requests). All English variants without a
    // countryCode share the same pregenerated "en" cache slot via cacheLanguageGroup.
    const language = rawLanguage ?? "en-US";

    const text = getSampleText(persona, language);

    // Fast path: public GCS URL — client streams directly, no base64 overhead.
    const cachedUrl = await getSampleUrl(persona, language, countryCode);
    if (cachedUrl) {
      res.json({ text, url: cachedUrl });
      return;
    }

    // Cache miss — synthesize live, save to GCS (makePublic is called inside
    // setSampleAudio), then return base64 for this first request. Subsequent
    // requests will hit the fast URL path above.
    let audio: { base64: string; mime: string };
    try {
      audio = await synthesize(
        text,
        getVoiceId(persona, language, countryCode),
        { live: false, speed: getSpeakingSpeed(persona), language },
      );
      setSampleAudio(persona, language, audio.base64, countryCode).catch(() => {});
    } catch {
      // Fallback: serve a plain en-US sample so the user always hears something.
      const fallbackText = getSampleText(persona, "en-US");
      audio = await synthesize(
        fallbackText,
        getVoiceId(persona, "en-US"),
        { live: false, speed: getSpeakingSpeed(persona), language: "en-US" },
      );
      setSampleAudio(persona, "en-US", audio.base64).catch(() => {});
      res.json({ text: fallbackText, audioBase64: audio.base64, mime: audio.mime });
      return;
    }

    res.json({ text, audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "sample failed");
    res.status(500).json({ error: "Sample playback failed" });
  }
});

// POST /api/judith/ask-onboarding  { text, bills?, persona? } -> { reply, audioBase64, mime }
// No auth required — interactive AI ask during onboarding feature screens.
router.post("/ask-onboarding", askOnboardingGlobalCap, askOnboardingLimiter, async (req, res) => {
  try {
    const { text, bills: bodyBills, persona: bodyPersona, localDate, language, currency } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const persona = coercePersona(bodyPersona);
    const lang = typeof language === "string" ? language : undefined;
    const cur: string = typeof currency === "string" && currency.trim() ? currency.trim() : "₱";
    const voiceId = getVoiceId(persona, lang);
    const bills = Array.isArray(bodyBills) ? (bodyBills as ClientBill[]) : [];
    const context = buildClientContext(bills, parseLocalDate(localDate), cur);

    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 250,
      system: `${systemPrompt(persona, lang, undefined, cur)}\n\nBILL CONTEXT (the only source of truth):\n${context}`,
      messages: [{ role: "user", content: text.trim() }],
    });
    const rawReply = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();
    const { cleanText: reply, action } = parseAction(rawReply);

    let audioBase64: string | null = null;
    let mime = "audio/mpeg";
    try {
      /* Onboarding = first impression — use high-quality non-live model (eleven_v3).
         Run moderation in parallel with TTS to cut the sequential wait. */
      const [safe, audio] = await Promise.all([
        isSafeForTTS(reply),
        synthesize(reply, voiceId, { live: false, speed: getSpeakingSpeed(persona) }).catch(() => null),
      ]);
      if (!safe) {
        logger.warn("tts skipped — moderation flagged onboarding reply");
      } else if (audio) {
        audioBase64 = audio.base64;
        mime = audio.mime;
      }
    } catch (ttsErr) {
      logger.error({ err: ttsErr }, "tts failed during ask-onboarding");
    }
    res.json({ reply, audioBase64, mime, action });
  } catch (err) {
    logger.error({ err }, "ask-onboarding failed");
    res.status(500).json({ error: "Judith could not respond right now" });
  }
});

// POST /api/judith/parse-bill  { text, category } -> { provider, amount, dueDay, kind }
// No auth required — AI extraction of bill details from transcribed onboarding speech.
router.post("/parse-bill", parseGlobalCap, parseLimiter, async (req, res) => {
  try {
    const { text, category } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 150,
      system: `You are a structured bill-detail extractor for a Filipino household budgeting app. The user just described a bill by voice during onboarding.

Return ONLY a single valid JSON object — no markdown fences, no explanation, no extra text:
{"provider":string|null,"amount":number|null,"dueDay":number|null,"kind":"Fixed"|"Variable","frequency":"monthly"|"annual","skip":boolean}

Extraction rules:
- provider: ONLY the exact company, bank, landlord, or service name the user EXPLICITLY SAID (e.g. "Meralco", "PLDT", "Globe", "Manila Water", "BPI", "Ayala"). If they did NOT name a specific provider — even if you know common providers for this category — return null. The category field is context only; it MUST NEVER influence or suggest the provider value. NEVER invent, infer, or guess a provider name.
- amount: the Philippine Peso amount as a plain integer. Convert English number words precisely: "ten thousand" → 10000, "five hundred" → 500, "three thousand five hundred" → 3500. If no amount was mentioned, return null.
- dueDay: the day of month (1–31) from ordinals or cardinals the user said: "fifteenth" → 15, "the 25th" → 25, "every 5th" → 5. If no due date was mentioned, return null.
- kind: "Fixed" if the amount is constant; "Variable" if it fluctuates (e.g. electricity, water).
- frequency: "annual" if the user said "every year", "yearly", "annually", "per year", "isang beses sa isang taon", or similar annual cadence; "monthly" for all other cases.
- skip: true ONLY if the user indicated they have NO payment for this category (e.g. "I own my house", "I own it outright", "no mortgage", "wala akong utang", "no rent", "hindi ko binabayaran"). False in all other cases.

Examples:
User said: "ten thousand pesos every twenty-fifth of the month" → {"provider":null,"amount":10000,"dueDay":25,"kind":"Fixed","frequency":"monthly","skip":false}
User said: "Meralco around three thousand five hundred due on the 20th" → {"provider":"Meralco","amount":3500,"dueDay":20,"kind":"Variable","frequency":"monthly","skip":false}
User said: "PLDT fiber one thousand six hundred ninety nine due 28th" → {"provider":"PLDT","amount":1699,"dueDay":28,"kind":"Fixed","frequency":"monthly","skip":false}
User said: "about five thousand for Globe" → {"provider":"Globe","amount":5000,"dueDay":null,"kind":"Fixed","frequency":"monthly","skip":false}
User said: "Canva two thousand pesos every year" → {"provider":"Canva","amount":2000,"dueDay":null,"kind":"Fixed","frequency":"annual","skip":false}
User said: "Netflix yearly plan five hundred ninety five" → {"provider":"Netflix","amount":595,"dueDay":null,"kind":"Fixed","frequency":"annual","skip":false}
User said: "I own my house, no mortgage" → {"provider":null,"amount":null,"dueDay":null,"kind":"Fixed","frequency":"monthly","skip":true}
User said: "sarili ko yung bahay" → {"provider":null,"amount":null,"dueDay":null,"kind":"Fixed","frequency":"monthly","skip":true}
User said: "I don't know the exact amount" → {"provider":null,"amount":null,"dueDay":null,"kind":"Fixed","frequency":"monthly","skip":false}`,
      messages: [
        {
          role: "user",
          content: `Category: ${typeof category === "string" ? category : "General"}\nUser said: "${text.trim()}"`,
        },
      ],
    });
    // Strip markdown fences if the model wraps the JSON
    const raw = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rawAmount = parsed["amount"];
    const amount =
      rawAmount != null && Number(rawAmount) > 0 ? Number(rawAmount) : null;
    res.json({
      provider:
        parsed["provider"] != null && String(parsed["provider"]).trim()
          ? String(parsed["provider"]).trim()
          : null,
      amount,
      dueDay: parsed["dueDay"] != null ? Number(parsed["dueDay"]) : null,
      kind: parsed["kind"] === "Variable" ? "Variable" : "Fixed",
      frequency: parsed["frequency"] === "annual" ? "annual" : "monthly",
      skip: parsed["skip"] === true,
    });
  } catch (err) {
    logger.error({ err }, "parse-bill failed");
    res.status(500).json({ error: "Could not parse bill" });
  }
});

// POST /api/judith/stt-onboarding  { audioBase64, mimeType } -> { text }
// No auth required — called during onboarding where the user may be a guest.
router.post("/stt-onboarding", sttTtsOnboardingGlobalCap, sttTtsOnboardingLimiter, async (req, res) => {
  try {
    const { audioBase64, mimeType, language } = req.body ?? {};
    if (typeof audioBase64 !== "string" || !audioBase64) {
      res.status(400).json({ error: "audioBase64 is required" });
      return;
    }
    const buffer = Buffer.from(audioBase64, "base64");
    const text = await transcribe(
      buffer,
      typeof mimeType === "string" ? mimeType : "audio/m4a",
      typeof language === "string" ? language : undefined,
    );
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "stt-onboarding failed");
    res.status(500).json({ error: "Transcription failed" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Onboarding voice-line translations
 * The client always sends English source text + a language code.
 * For non-English, non-Filipino languages we map the source text to a
 * concept key and serve the translated version so ElevenLabs speaks in the
 * correct language (multilingual model renders whatever text it receives).
 * ─────────────────────────────────────────────────────────────────────────── */

/** Maps every English onboarding source line → concept key. */
const ONB_LINE_TO_CONCEPT: Record<string, string> = {
  // Welcome
  "Hi \u2014 I\u2019m Judith. Your due date assistant. Let\u2019s take control of your bills, shall we?": "welcome",
  // Language screen
  "Take control of your bills, take control of your life.": "language",
  // Name screen
  "One more thing \u2014 what should I call you?": "name",
  // LateFee — all persona variants
  "We\u2019ve all been there \u2014 missed a payment, surprise fee. I\u2019m here to make sure that never happens again.": "lateFee",
  "We've all been there \u2014 missed a payment, surprise fee. I'm here to make sure that never happens again.": "lateFee",
  "Ugh, late fees \u2014 the worst! I\u2019m here so you never have to deal with that again.": "lateFee",
  "Missed payment. Surprise fee. Happens to everyone. That\u2019s why I\u2019m here.": "lateFee",
  "Anak, don\u2019t worry \u2014 it happens to everyone. I\u2019m here to make sure it doesn\u2019t happen to you again.": "lateFee",
  "Missed payment. Late fee. Entirely avoidable. That\u2019s what I\u2019m here for.": "lateFee",
  "Oh my gosh, late fees?! The absolute worst! But that\u2019s literally why I\u2019m here \u2014 it will never happen again!": "lateFee",
  // Problem — all persona variants
  "Honestly, most people don\u2019t track their bills. Let\u2019s change that.": "problem",
  "Surprise \u2014 most people don\u2019t track their bills. But you\u2019re not most people anymore!": "problem",
  "Most people don\u2019t track this. You\u2019re about to be different.": "problem",
  "Anak, most people don\u2019t track their bills. But that\u2019s okay \u2014 we\u2019re changing that right now.": "problem",
  "Okay so listen \u2014 most people don\u2019t track their bills! But you? You\u2019re literally about to change all of that!": "problem",
  "Most people don\u2019t track their bills. That\u2019s a choice with a cost. Fix it.": "problem",
  // Stakes — all persona variants
  "This doesn\u2019t have to be your situation. Let\u2019s change it \u2014 right now.": "stakes",
  "Okay! Enough of that \u2014 let\u2019s flip the script! Right now, we change this!": "stakes",
  "This doesn\u2019t have to stay this way. Let\u2019s change it. Now.": "stakes",
  "Anak, we\u2019re going to change this together \u2014 starting right now.": "stakes",
  "No more of this! We are changing it right now! Let\u2019s go!": "stakes",
  "This changes now. Track them. Pay them. That\u2019s all there is to it.": "stakes",
  // Intro (bill-adding overview) — all persona variants
  "This usually takes 5 to 7 minutes. Let\u2019s map out every bill \u2014 I\u2019ll walk you through it.": "intro",
  "Okay! About 5 to 7 minutes and your whole bill life will make sense. Let\u2019s go!": "intro",
  "About 5 to 7 minutes. Just answer my questions \u2014 it\u2019ll be worth it.": "intro",
  "Anak, this will only take 5 to 7 minutes. I\u2019ll walk you through everything, promise.": "intro",
  "Oh my gosh, just 5 to 7 minutes! Let\u2019s map all your bills \u2014 I cannot wait!": "intro",
  "Five to seven minutes. Answer my questions. Every bill gets tracked. Let\u2019s start.": "intro",
  // Features screen 0 — all persona variants
  "Tap the question below \u2014 I\u2019ll add up every bill you have this month.": "features0",
  "Ooh, the big question! Tap it \u2014 I\u2019ll crunch every single bill right now!": "features0",
  "Tap the question. I’ll total your bills for this month.": "features0",
  "Go ahead anak, tap the question \u2014 I\u2019ll add everything up for you.": "features0",
  "Oh my gosh! Total bills this month?! Tap it — I know every single one!": "features0",
  // Features screen 1 — all persona variants
  "Now ask about your utilities and rent \u2014 tap the question below.": "features1",
  "Utilities AND rent?! Tap that question \u2014 I\u2019ll add it all up for you!": "features1",
  "Water, electricity, internet, rent. Tap the question. I\u2019ll total it.": "features1",
  "Try asking about your utilities and rent anak \u2014 tap below and I\u2019ll add it all up.": "features1",
  "Water! Electric! Internet! Rent! Tap the question \u2014 I\u2019ll get the total!": "features1",
  "Utilities and rent. Tap the question. I\u2019ll total it.": "features1",
  // Features screen 2 — all persona variants
  "Now let\u2019s look ahead \u2014 tap below to see your estimated total for next month.": "features2",
  "Ooh, future planning! Tap it \u2014 I\u2019ll project your entire next month for you!": "features2",
  "Next month. Tap the question. I\u2019ll estimate from what you\u2019ve added.": "features2",
  "Let\u2019s look at next month anak \u2014 tap the question and I\u2019ll estimate everything for you.": "features2",
  "Next month already?! Oh my gosh, I\u2019m so excited! Tap it \u2014 I\u2019ll project it all!": "features2",
  "Tap the question. I\u2019ll project your total bill for next month.": "features2",
  // Paywall — all persona variants
  "You\u2019ve got eight free asks to start. When you\u2019re ready for more, pick a plan and I\u2019m all yours.": "paywall",
  "Eight free asks \u2014 on the house! Try me out, then come back when you\u2019re hooked. I\u2019ll wait.": "paywall",
  "Eight free asks. Use them. If you want more, pick a plan.": "paywall",
  "Anak, you have eight free asks to start. Try them out \u2014 and when you want more, I\u2019ll be right here.": "paywall",
  "Oh my gosh! Eight free asks \u2014 try me! And when you want to keep chatting, pick a plan! I will be waiting!": "paywall",
  "Eight free asks. Use them. Want more \u2014 pick a plan.": "paywall",
  // Personalizing — all persona variants
  "Setting up your reminders now. Almost ready.": "personalizing",
  "Don\u2019t go anywhere \u2014 I\u2019m doing very important things back here!": "personalizing",
  "Yeah yeah, I\u2019m working on it. Give me a second.": "personalizing",
  "Almost ready anak \u2014 I\u2019m making sure everything is just right for you.": "personalizing",
  "Oh my gosh, so many bills! But I got you \u2014 almost done!": "personalizing",
  "Setting up your reminders. Almost done.": "personalizing",

  // ── Filipino text entries (sent directly from the client for fil/ceb/ilo/hil users) ──

  // Welcome (fil — same for all personas)
  "Hi \u2014 I\u2019m Judith. Your due date assistant. Aabangan ko lahat ng bills mo para hindi ka mabigla. Let\u2019s take control of your bills, shall we?": "welcome",
  // Language (fil — same for all personas)
  "kapag kontrolado mo ang bills mo, kontrolado mo ang buhay mo. Agree?": "language",
  // Name (fil — same for all personas)
  "Hi! Can I get your name po?": "name",
  // LateFee (fil — per persona)
  "Nangyayari ito sa lahat \u2014 napalampas na bayad, biglang multa. Nandito ako para hindi na mangyari ulit.": "lateFee",
  "Ay ang sama ng late fees! Pero wag nang mag-alala \u2014 nandito na ako para hindi na maulit!": "lateFee",
  "Napalampas na bayad. Biglang multa. Nangyayari sa lahat. Kaya nandito ako.": "lateFee",
  "Huwag mag-alala anak. Nangyayari ito sa lahat. Nandito ako para hindi na maulit.": "lateFee",
  "Ay grabe, late fees! Ang pangit! Pero besh, nandito na ako \u2014 hindi na maulit \u2018yan!": "lateFee",
  // Problem (fil — per persona)
  "Honestly, karamihan sa tao ay hindi nag-ta-track ng bills nila. Palitan na natin iyon.": "problem",
  "Grabe, karamihan hindi nag-ta-track ng bills! Pero ikaw \u2014 ikaw ay magiging iba na!": "problem",
  "Karamihan hindi nag-ta-track. Ikaw ay magiging iba.": "problem",
  "Anak, karamihan hindi nag-ta-track ng bills. Pero okay lang \u2014 palitan na natin iyon ngayon.": "problem",
  "Ay besh, karamihan hindi nag-ta-track ng bills! Pero tayo \u2014 we\u2019re changing that na!": "problem",
  // Stakes (fil — per persona)
  "Hindi na kailangang ganito ang sitwasyon mo. Palitan na natin ito \u2014 ngayon na.": "stakes",
  "Sige! Tapos na sa ganyan! Palitan na natin \u2014 ngayon na!": "stakes",
  "Hindi na kailangang ganito. Palitan na natin. Ngayon.": "stakes",
  "Anak, magbabago na tayo \u2014 simula ngayon. Sama-sama tayo.": "stakes",
  "Besh! Tapos na! Palitan na natin ito ngayon! Let\u2019s go!": "stakes",
  // Intro (fil — per persona)
  "Aabutin ito ng 5 hanggang 7 minuto. I-map natin ang lahat ng bills mo.": "intro",
  "5 hanggang 7 minuto lang at magiging maayos na ang lahat! Tara na!": "intro",
  "5 hanggang 7 minuto lang to. Sagutin mo lang ang mga tanong ko.": "intro",
  "Anak, 5 hanggang 7 minuto lang ito. Sasamahan kita sa lahat, promise.": "intro",
  "Grabe besh, 5 hanggang 7 minuto lang! I-map na natin ang lahat ng bills mo!": "intro",
  // Features0 (fil — per persona)
  "Sige, magtanong ka na. Nakinukinig ako.": "features0",
  "Ready na ako! Magtanong ka na, curious rin ako kung ano ang sasabihin mo!": "features0",
  "Pwede ka nang magtanong. Sige.": "features0",
  "Sige anak, magtanong ka na. Nandito ako.": "features0",
  "Ay ay ay! Magtanong ka na besh! Alam ko lahat ng tungkol sa bills mo!": "features0",
  // Features1 (fil — per persona)
  "Try mo i-tanong kung ano ang due ngayong linggo. Sasabihin ko lahat.": "features1",
  "I-try mo: \u2018Ano ang due this week?\u2019 \u2014 Isasabi ko lahat, walang tinatago!": "features1",
  "Tanungin mo kung ano ang due ngayong linggo. Sasabihin ko.": "features1",
  "Try mo anak, tanungin ang due this week. Isasabi ko lahat sa iyo.": "features1",
  "Ay! Tanungin mo ako kung ano ang due ngayong linggo! Isasabi ko lahat besh!": "features1",
  // Features2 (fil — per persona)
  "Tanungin mo ko kung ligtas mag-gastos. I-check ko lahat ng bills mo.": "features2",
  "Tanungin mo: ligtas ba mag-gastos? Magsasabi ako ng totoo \u2014 mahal kita kaya!": "features2",
  "Tanungin mo kung ligtas mag-gastos. Checkuhin ko at sasabihin ko.": "features2",
  "Tanungin mo anak kung ligtas mag-gastos. I-check ko lahat para sa iyo.": "features2",
  "Tanungin mo ako kung ligtas mag-gastos! Checkuhin ko ang lahat besh! Grabe!": "features2",
  // Paywall (fil — per persona)
  "May walong libreng tanong ka sa simula. Kapag gusto mo ng higit pa, pumili ng plano \u2014 nandito ako.": "paywall",
  "Walong libreng tanong \u2014 regalo ko! Subukan mo ako, at kapag hooked ka na, bumalik ka!": "paywall",
  "Walong libreng tanong. Gamitin mo. Kung gusto mo pa, pumili ng plano.": "paywall",
  "Anak, may walong libreng tanong ka. Subukan mo \u2014 at kapag gusto mo pa, nandito ako.": "paywall",
  "Besh! Walong libreng tanong! Subukan mo ako! At kapag gusto mo pang makipag-chat \u2014 pick a plan! Waiting ako!": "paywall",
  // Personalizing (fil) — no .fil variant, falls through to English entries above
};

type ConceptTranslations = Record<string, string>;

/** Translated onboarding lines per concept per language code. */
const ONB_TRANSLATIONS: Record<string, ConceptTranslations> = {
  welcome: {
    es: "Hola — soy Judith, tu asistente de vencimientos. Tomemos el control de tus facturas.",
    pt: "Oi — eu sou Judith, sua assistente de vencimentos. Vamos tomar o controle das suas contas.",
    "pt-PT": "Olá — sou a Judith, a tua assistente de datas de vencimento. Vamos tomar o controlo das tuas faturas.",
    fr: "Bonjour — je suis Judith, votre assistante de dates d'échéance. Prenons le contrôle de vos factures.",
    de: "Hallo — ich bin Judith, Ihre Fälligkeitsdaten-Assistentin. Lassen Sie uns Ihre Rechnungen unter Kontrolle bringen.",
    it: "Ciao — sono Judith, la tua assistente per le scadenze. Prendiamo il controllo delle tue bollette.",
    nl: "Hoi — ik ben Judith, uw vervaldatum-assistente. Laten we uw rekeningen onder controle brengen.",
    pl: "Cześć — jestem Judith, twoja asystentka terminów płatności. Przejmijmy kontrolę nad twoimi rachunkami.",
    sv: "Hej — jag är Judith, din assistent för förfallodatum. Låt oss ta kontroll över dina räkningar.",
    da: "Hej — jeg er Judith, din assistent for forfaldsdatoer. Lad os tage kontrol over dine regninger.",
    no: "Hei — jeg er Judith, din assistent for forfallsdatoer. La oss ta kontroll over regningene dine.",
    fi: "Hei — olen Judith, eräpäiväavustajasi. Otetaan laskusi hallintaan.",
    cs: "Ahoj — jsem Judith, vaše asistentka pro termíny splatnosti. Převezměme kontrolu nad vašimi účty.",
    sk: "Ahoj — som Judith, vaša asistentka pre termíny splatnosti. Prevezmime kontrolu nad vašimi účtami.",
    ro: "Bună — sunt Judith, asistenta ta pentru scadențe. Hai să preluăm controlul asupra facturilor tale.",
    bg: "Здравей — аз съм Джудит, твоят асистент за падежи. Нека поемем контрола над сметките ти.",
    hr: "Bok — ja sam Judith, tvoja asistentka za rokove plaćanja. Preuzimimo kontrolu nad tvojim računima.",
    el: "Γεια — είμαι η Τζούντιθ, η βοηθός σου για τις ημερομηνίες λήξης. Ας πάρουμε τον έλεγχο των λογαριασμών σου.",
    hu: "Szia — Judith vagyok, a fizetési határidő-asszisztensed. Vegyük kézbe a számláidat.",
    uk: "Привіт — я Джудіт, ваш помічник з термінів платежів. Давайте візьмемо ваші рахунки під контроль.",
    ru: "Привет — я Джудит, ваш помощник по срокам платежей. Давайте возьмём ваши счета под контроль.",
    tr: "Merhaba — ben Judith, vade tarihi asistanınım. Faturalarınızı kontrol altına alalım.",
    ar: "مرحباً — أنا جوديث، مساعدتك لمواعيد الاستحقاق. لنتحكم في فواتيرك معاً.",
    arz: "أهلاً — أنا جوديث، المساعدة بتاعتك لمواعيد الاستحقاق. خلينا نتحكم في فواتيرك مع بعض.",
    apc: "مرحبا — أنا جوديث، مساعدتك لمواعيد الاستحقاق. خلينا نتحكم بفواتيرك مع بعض.",
    afb: "هلا — أنا جوديث، مساعدتك لمواعيد الاستحقاق. نأخذ بزمام فواتيرك مع بعض.",
    hi: "नमस्ते — मैं जूडिथ हूँ, आपकी देय तिथि सहायक। आइए अपने बिलों पर नियंत्रण पाएं।",
    ta: "வணக்கம் — நான் ஜூடித், உங்கள் தவணை தேதி உதவியாளர். உங்கள் கட்டணங்களை கட்டுப்படுத்துவோம்.",
    ja: "こんにちは — ジュディスです。お支払い期日のアシスタントとして、一緒に請求書を管理しましょう。",
    ko: "안녕하세요 — 저는 주디스예요, 납부일 도우미입니다. 함께 청구서를 관리해 봐요.",
    zh: "你好 — 我是茱迪丝，你的账单到期日助手。让我们一起管理你的账单。",
    yue: "你好 — 我係茱迪絲，你嘅賬單到期日助手。一齊管好你嘅賬單啦。",
    id: "Halo — aku Judith, asisten tanggal jatuh tempo kamu. Yuk kita kendalikan tagihan kamu bersama.",
    ms: "Hai — saya Judith, pembantu tarikh matang anda. Jom kita kawal bil-bil anda bersama-sama.",
    vi: "Chào — tôi là Judith, trợ lý ngày đáo hạn của bạn. Hãy cùng kiểm soát các hóa đơn của bạn.",
    th: "สวัสดี — ฉันคือจูดิธ ผู้ช่วยด้านวันครบกำหนดของคุณ ให้เราจัดการบิลของคุณด้วยกัน",
  },
  language: {
    es: "Toma el control de tus facturas, toma el control de tu vida.",
    pt: "Tome o controle das suas contas, tome o controle da sua vida.",
    "pt-PT": "Toma o controlo das tuas faturas, toma o controlo da tua vida.",
    fr: "Maîtrisez vos factures, maîtrisez votre vie.",
    de: "Behalten Sie Ihre Rechnungen im Griff, behalten Sie Ihr Leben im Griff.",
    it: "Controlla le tue bollette, controlla la tua vita.",
    nl: "Beheer uw rekeningen, beheer uw leven.",
    pl: "Kontroluj swoje rachunki, kontroluj swoje życie.",
    sv: "Ta kontroll över dina räkningar, ta kontroll över ditt liv.",
    da: "Tag kontrol over dine regninger, tag kontrol over dit liv.",
    no: "Ta kontroll over regningene dine, ta kontroll over livet ditt.",
    fi: "Hallitse laskusi, hallitse elämäsi.",
    cs: "Ovládněte své účty, ovládněte svůj život.",
    sk: "Ovládnite svoje účty, ovládnite svoj život.",
    ro: "Controlează-ți facturile, controlează-ți viața.",
    bg: "Управлявай сметките си, управлявай живота си.",
    hr: "Kontroliraj svoje račune, kontroliraj svoj život.",
    el: "Έλεγξε τους λογαριασμούς σου, έλεγξε τη ζωή σου.",
    hu: "Vedd kézbe a számláidat, vedd kézbe az életedet.",
    uk: "Контролюйте свої рахунки — контролюйте своє життя.",
    ru: "Контролируйте свои счета — контролируйте свою жизнь.",
    tr: "Faturalarınızı kontrol edin, hayatınızı kontrol edin.",
    ar: "تحكمي في فواتيرك، تحكمي في حياتك.",
    arz: "تحكمي في فواتيرك، تحكمي في حياتك.",
    apc: "تحكمي بفواتيرك، تحكمي بحياتك.",
    afb: "تحكمي بفواتيرك، تحكمي بحياتك.",
    hi: "अपने बिलों पर नियंत्रण रखें, अपने जीवन पर नियंत्रण रखें।",
    ta: "உங்கள் கட்டணங்களை கட்டுப்படுத்துங்கள், உங்கள் வாழ்க்கையை கட்டுப்படுத்துங்கள்.",
    ja: "支払いを管理すれば、生活を管理できます。",
    ko: "청구서를 관리하면, 삶을 관리할 수 있어요.",
    zh: "管理好账单，就是管理好生活。",
    yue: "管好賬單，就係管好生活。",
    id: "Kendalikan tagihanmu, kendalikan hidupmu.",
    ms: "Kawal bil anda, kawal kehidupan anda.",
    vi: "Kiểm soát hóa đơn của bạn, kiểm soát cuộc sống của bạn.",
    th: "ควบคุมบิลของคุณ ควบคุมชีวิตของคุณ",
  },
  name: {
    es: "Una cosa más — ¿cómo debo llamarte?",
    pt: "Mais uma coisa — como devo te chamar?",
    "pt-PT": "Mais uma coisa — como me devo dirigir a ti?",
    fr: "Encore une chose — comment dois-je vous appeler?",
    de: "Noch eine Sache — wie soll ich Sie nennen?",
    it: "Un'ultima cosa — come devo chiamarti?",
    nl: "Nog één ding — hoe moet ik u noemen?",
    pl: "Jeszcze jedno — jak mam cię nazywać?",
    sv: "En sak till — vad ska jag kalla dig?",
    da: "En ting til — hvad skal jeg kalde dig?",
    no: "En ting til — hva skal jeg kalle deg?",
    fi: "Vielä yksi asia — kuinka minun pitäisi kutsua sinua?",
    cs: "Ještě jedna věc — jak vás mám oslovovat?",
    sk: "Ešte jedna vec — ako vás mám oslovovať?",
    ro: "Încă un lucru — cum ar trebui să te numesc?",
    bg: "Още едно нещо — как да те нарека?",
    hr: "Još jedna stvar — kako da te zovem?",
    el: "Ακόμα ένα πράγμα — πώς πρέπει να σε φωνάζω;",
    hu: "Még egy dolog — hogyan szólítsalak?",
    uk: "Ще одне — як мені вас називати?",
    ru: "Ещё одно — как мне вас называть?",
    tr: "Bir şey daha — sizi nasıl çağırmalıyım?",
    ar: "شيء أخير — كيف يجب أن أناديكِ؟",
    arz: "حاجة تانية — أنا أنادي عليكِ إزاي؟",
    apc: "شي تاني — كيف لازم أناديكِ؟",
    afb: "شي ثاني — كيف لازم أناديكِ؟",
    hi: "एक और बात — मुझे आपको क्या बुलाना चाहिए?",
    ta: "இன்னொரு விஷயம் — உங்களை நான் என்னவென்று அழைக்க வேண்டும்?",
    ja: "もう一つ — あなたのことをどう呼べばよいですか?",
    ko: "한 가지 더 — 어떻게 불러 드릴까요?",
    zh: "还有一件事 — 我应该怎么称呼你?",
    yue: "仲有一件事 — 我應該點稱呼你？",
    id: "Satu hal lagi — bagaimana aku harus memanggilmu?",
    ms: "Satu lagi perkara — bagaimana saya harus memanggil anda?",
    vi: "Thêm một điều nữa — tôi nên gọi bạn là gì?",
    th: "อีกสิ่งหนึ่ง — ฉันควรเรียกคุณว่าอะไร?",
  },
  lateFee: {
    es: "Estoy aquí para que nunca vuelvas a llevarte una sorpresa con una mora.",
    pt: "Estou aqui para que você nunca seja pega de surpresa por uma multa de atraso.",
    "pt-PT": "Estou aqui para que nunca sejas apanhada de surpresa por uma mora.",
    fr: "Je suis là pour que vous ne soyez plus jamais pris par surprise par des pénalités de retard.",
    de: "Ich bin hier, damit Sie nie wieder von einer Verzugsgebühr überrascht werden.",
    it: "Sono qui perché tu non venga mai più colta di sorpresa da una mora.",
    nl: "Ik ben hier zodat u nooit meer verrast wordt door een late betalingskosten.",
    pl: "Jestem tu, żebyś nigdy więcej nie była zaskoczona opłatą za spóźnienie.",
    sv: "Jag är här för att du aldrig mer ska bli överraskad av en förseningsavgift.",
    da: "Jeg er her, så du aldrig mere bliver overrasket af et gebyr for forsinket betaling.",
    no: "Jeg er her slik at du aldri mer blir overrasket av et gebyr for forsinket betaling.",
    fi: "Olen täällä, jotta et koskaan enää yllättyisi myöhästymismaksusta.",
    cs: "Jsem tu, abyste nikdy nebyla překvapena poplatkem za pozdní platbu.",
    sk: "Som tu, aby vás nikdy neprekvapil poplatok za oneskorenú platbu.",
    ro: "Sunt aici ca să nu fii niciodată surprinsă de o penalitate de întârziere.",
    bg: "Тук съм, за да не те изненада никога такса за закъснение.",
    hr: "Ovdje sam da te nikada više ne iznenadi naknada za kašnjenje.",
    el: "Είμαι εδώ ώστε να μην σε εκπλήξει ποτέ πάλι μια χρέωση καθυστέρησης.",
    hu: "Azért vagyok itt, hogy soha többé ne lepjen meg egy késedelmi díj.",
    uk: "Я тут, щоб вас ніколи більше не застав зненацька штраф за прострочення.",
    ru: "Я здесь, чтобы вас никогда больше не застал врасплох штраф за просрочку.",
    tr: "Bir daha asla geç ödeme ücreti sürpriziyle karşılaşmamanız için buradayım.",
    ar: "أنا هنا حتى لا تُفاجئيكِ رسوم التأخير أبداً من جديد.",
    arz: "أنا هنا عشان مصاريف التأخير ما تتفاجئيكِش تاني.",
    apc: "أنا هون حتى ما يفاجئوكِ رسوم التأخير من جديد.",
    afb: "أنا هني حتى ما تتفاجئين برسوم التأخير ثاني.",
    hi: "मैं यहाँ हूँ ताकि आप कभी भी विलंब शुल्क से चौंके नहीं।",
    ta: "தாமதக் கட்டணம் ஒருபோதும் உங்களை ஆச்சரியப்படுத்தாமல் பார்த்துக்கொள்கிறேன்.",
    ja: "二度と延滞料金に驚かされないために、ここにいます。",
    ko: "다시는 연체료에 놀라지 않도록 제가 여기 있어요.",
    zh: "我在这里，确保你永远不会被滞纳金所惊到。",
    yue: "我喺度，確保你永遠唔會俾滯納金嚇親。",
    id: "Aku di sini agar kamu tidak pernah lagi terkejut oleh denda keterlambatan.",
    ms: "Saya di sini supaya anda tidak pernah lagi terkejut dengan caj lewat bayar.",
    vi: "Tôi ở đây để bạn không bao giờ bị bất ngờ bởi phí trễ hạn nữa.",
    th: "ฉันอยู่ที่นี่เพื่อให้คุณไม่ต้องเซอร์ไพรส์กับค่าปรับล่าช้าอีกต่อไป",
  },
  problem: {
    es: "La mayoría de la gente no lleva el control de sus facturas. Cambiemos eso.",
    pt: "A maioria das pessoas não acompanha suas contas. Vamos mudar isso.",
    "pt-PT": "A maioria das pessoas não acompanha as suas faturas. Vamos mudar isso.",
    fr: "La plupart des gens ne suivent pas leurs factures. Changeons ça.",
    de: "Die meisten Menschen behalten ihre Rechnungen nicht im Blick. Ändern wir das.",
    it: "La maggior parte delle persone non tiene traccia delle proprie bollette. Cambiamo le cose.",
    nl: "De meeste mensen houden hun rekeningen niet bij. Laten we dat veranderen.",
    pl: "Większość ludzi nie śledzi swoich rachunków. Zmieńmy to.",
    sv: "De flesta håller inte koll på sina räkningar. Låt oss ändra på det.",
    da: "De fleste holder ikke styr på deres regninger. Lad os ændre det.",
    no: "De fleste holder ikke oversikt over regningene sine. La oss forandre det.",
    fi: "Useimmat ihmiset eivät seuraa laskujaan. Muutetaan se.",
    cs: "Většina lidí nesleduje své účty. Pojďme to změnit.",
    sk: "Väčšina ľudí nesleduje svoje účty. Poďme to zmeniť.",
    ro: "Cei mai mulți oameni nu își urmăresc facturile. Hai să schimbăm asta.",
    bg: "Повечето хора не следят сметките си. Нека да го променим.",
    hr: "Većina ljudi ne prati svoje račune. Promijenimo to.",
    el: "Οι περισσότεροι δεν παρακολουθούν τους λογαριασμούς τους. Ας αλλάξουμε αυτό.",
    hu: "A legtöbb ember nem követi nyomon a számláit. Változtassunk ezen.",
    uk: "Більшість людей не відстежують свої рахунки. Давайте змінимо це.",
    ru: "Большинство людей не следят за своими счетами. Давайте изменим это.",
    tr: "Çoğu insan faturalarını takip etmez. Bunu değiştirelim.",
    ar: "معظم الناس لا يتابعون فواتيرهم. لنغيّر ذلك.",
    arz: "معظم الناس مش بيتابعوا فواتيرهم. خلينا نغيّر ده.",
    apc: "معظم الناس ما بيتابعوا فواتيرهم. خلينا نغيّر هيك.",
    afb: "أغلب الناس ما يتابعون فواتيرهم. نغيّر هذا.",
    hi: "ज़्यादातर लोग अपने बिलों का ट्रैक नहीं रखते। आइए इसे बदलें।",
    ta: "பெரும்பாலான மக்கள் தங்கள் கட்டணங்களை கண்காணிப்பதில்லை. இதை மாற்றுவோம்.",
    ja: "ほとんどの人が請求書を追跡していません。それを変えましょう。",
    ko: "대부분의 사람들은 청구서를 추적하지 않아요. 그걸 바꿔봐요.",
    zh: "大多数人不追踪自己的账单。让我们来改变这一点。",
    yue: "大部分人唔會追蹤自己嘅賬單。我哋一齊改變呢個情況。",
    id: "Kebanyakan orang tidak memantau tagihan mereka. Yuk kita ubah itu.",
    ms: "Kebanyakan orang tidak memantau bil mereka. Jom kita ubah itu.",
    vi: "Hầu hết mọi người không theo dõi hóa đơn của họ. Hãy thay đổi điều đó.",
    th: "คนส่วนใหญ่ไม่ติดตามบิลของตนเอง ให้เราเปลี่ยนสิ่งนั้น",
  },
  stakes: {
    es: "Cambiemos esto — ahora mismo.",
    pt: "Vamos mudar isso — agora mesmo.",
    "pt-PT": "Vamos mudar isto — agora mesmo.",
    fr: "Changeons ça — maintenant.",
    de: "Ändern wir das — jetzt sofort.",
    it: "Cambiamo questo — adesso.",
    nl: "Laten we dit veranderen — nu meteen.",
    pl: "Zmieńmy to — teraz.",
    sv: "Låt oss ändra på det här — nu.",
    da: "Lad os ændre det — nu.",
    no: "La oss forandre dette — nå.",
    fi: "Muutetaan tämä — heti nyt.",
    cs: "Pojďme to změnit — hned teď.",
    sk: "Poďme to zmeniť — hneď teraz.",
    ro: "Hai să schimbăm asta — chiar acum.",
    bg: "Нека да го променим — сега.",
    hr: "Promijenimo to — odmah.",
    el: "Ας αλλάξουμε αυτό — τώρα.",
    hu: "Változtassunk ezen — most.",
    uk: "Давайте змінимо це — прямо зараз.",
    ru: "Давайте изменим это — прямо сейчас.",
    tr: "Bunu değiştirelim — şimdi.",
    ar: "لنغيّر هذا — الآن.",
    arz: "خلينا نغيّر ده — دلوقتي.",
    apc: "خلينا نغيّر هيك — هلق.",
    afb: "نغيّر هذا — الحين.",
    hi: "आइए इसे बदलें — अभी।",
    ta: "இதை மாற்றுவோம் — இப்போதே.",
    ja: "これを変えましょう — 今すぐ。",
    ko: "지금 당장 바꿔봐요.",
    zh: "让我们改变这一切 — 就是现在。",
    yue: "我哋而家就改變佢 — 係時候喇。",
    id: "Yuk kita ubah ini — sekarang juga.",
    ms: "Jom kita ubah ini — sekarang.",
    vi: "Hãy thay đổi điều này — ngay bây giờ.",
    th: "ให้เราเปลี่ยนสิ่งนี้ — ตอนนี้เลย",
  },
  intro: {
    es: "Esto suele llevar entre 5 y 7 minutos. Te guiaré en cada paso.",
    pt: "Isso normalmente leva de 5 a 7 minutos. Vou te guiar em tudo.",
    "pt-PT": "Isto normalmente demora entre 5 e 7 minutos. Vou guiar-te em tudo.",
    fr: "Ça prend généralement entre 5 et 7 minutes. Je vous guide à chaque étape.",
    de: "Das dauert normalerweise 5 bis 7 Minuten. Ich führe Sie durch alles.",
    it: "Di solito ci vogliono dai 5 ai 7 minuti. Ti guido in ogni passaggio.",
    nl: "Dit duurt meestal 5 tot 7 minuten. Ik begeleid u bij elke stap.",
    pl: "Zazwyczaj zajmuje to 5 do 7 minut. Przeprowadzę cię przez wszystko.",
    sv: "Det brukar ta 5 till 7 minuter. Jag guidar dig genom allt.",
    da: "Det tager normalt 5 til 7 minutter. Jeg guider dig igennem det hele.",
    no: "Dette tar vanligvis 5 til 7 minutter. Jeg guider deg gjennom alt.",
    fi: "Tämä kestää yleensä 5–7 minuuttia. Opastan sinua läpi kaiken.",
    cs: "To obvykle trvá 5 až 7 minut. Provedu vás vším.",
    sk: "Zvyčajne to trvá 5 až 7 minút. Prevediem vás všetkým.",
    ro: "De obicei durează 5 până la 7 minute. Te ghidez prin tot.",
    bg: "Обикновено отнема 5 до 7 минути. Ще те преведа през всичко.",
    hr: "Obično traje 5 do 7 minuta. Provest ću te kroz sve.",
    el: "Συνήθως διαρκεί 5 έως 7 λεπτά. Θα σε καθοδηγήσω σε όλα.",
    hu: "Ez általában 5-7 percet vesz igénybe. Végigvezetlek mindenen.",
    uk: "Зазвичай це займає 5–7 хвилин. Я проведу вас через усе.",
    ru: "Обычно это занимает 5–7 минут. Я проведу вас через всё.",
    tr: "Bu genellikle 5 ila 7 dakika sürer. Her adımda size rehberlik edeceğim.",
    ar: "عادةً ما يستغرق هذا من 5 إلى 7 دقائق. سأرشدكِ خلال كل خطوة.",
    arz: "عادةً بياخد من 5 لـ 7 دقايق. هرشدك في كل خطوة.",
    apc: "عادةً بياخد من 5 لـ 7 دقايق. رح أرشدك بكل خطوة.",
    afb: "عادةً يأخذ من 5 لـ 7 دقايق. راح أرشدك بكل خطوة.",
    hi: "इसमें आमतौर पर 5 से 7 मिनट लगते हैं। मैं आपको हर कदम पर गाइड करूँगी।",
    ta: "இது பொதுவாக 5 முதல் 7 நிமிடங்கள் ஆகும். நான் உங்களை வழிநடத்துவேன்.",
    ja: "通常5〜7分かかります。すべてを一緒に確認していきましょう。",
    ko: "보통 5~7분 정도 걸려요. 모든 과정을 안내해 드릴게요.",
    zh: "通常需要5到7分钟。我会一步一步带你完成。",
    yue: "通常需要5至7分鐘。我會一步一步帶你完成。",
    id: "Ini biasanya membutuhkan 5 hingga 7 menit. Aku akan memandu kamu di setiap langkah.",
    ms: "Ini biasanya mengambil masa 5 hingga 7 minit. Saya akan membimbing anda di setiap langkah.",
    vi: "Điều này thường mất từ 5 đến 7 phút. Tôi sẽ hướng dẫn bạn từng bước.",
    th: "ปกติใช้เวลา 5 ถึง 7 นาที ฉันจะแนะนำคุณทุกขั้นตอน",
  },
  features0: {
    es: "Adelante — pregúntame lo que quieras. Te escucho.",
    pt: "Pode perguntar — qualquer coisa. Estou ouvindo.",
    "pt-PT": "Podes perguntar — qualquer coisa. Estou a ouvir.",
    fr: "Allez-y — posez-moi n'importe quelle question. Je vous écoute.",
    de: "Fragen Sie mich ruhig — irgendetwas. Ich höre zu.",
    it: "Vai pure — chiedimi quello che vuoi. Sono qui ad ascoltarti.",
    nl: "Ga uw gang — vraag me van alles. Ik luister.",
    pl: "Śmiało — zapytaj mnie o cokolwiek. Słucham.",
    sv: "Kör igång — fråga mig vad som helst. Jag lyssnar.",
    da: "Bare spørg — alt du vil. Jeg lytter.",
    no: "Bare spør — hva som helst. Jeg lytter.",
    fi: "Kysy vain — mitä tahansa. Kuuntelen.",
    cs: "Klidně se ptejte — cokoliv. Poslouchám.",
    sk: "Kľudne sa pýtajte — čokoľvek. Počúvam.",
    ro: "Dă-i drumul — întreabă-mă orice. Ascult.",
    bg: "Питай — каквото искаш. Слушам.",
    hr: "Slobodno pitaj — što god hoćeš. Slušam.",
    el: "Ρώτησε με — οτιδήποτε. Ακούω.",
    hu: "Csak kérdezz — bármit. Figyelek.",
    uk: "Сміливо питайте — будь-що. Я слухаю.",
    ru: "Смело спрашивайте — что угодно. Я слушаю.",
    tr: "Buyurun — ne olursa sorun. Dinliyorum.",
    ar: "تفضلي — اسأليني عن أي شيء. أنا أستمع.",
    arz: "اتفضلي — اسأليني على أي حاجة. أنا بسمعك.",
    apc: "تفضلي — اسأليني عن أي شي. عم بسمعك.",
    afb: "تفضلي — اسأليني أي شي. أسمعك.",
    hi: "पूछिए — कुछ भी। मैं सुन रही हूँ।",
    ta: "கேளுங்கள் — எதுவும். நான் கேட்கிறேன்.",
    ja: "どうぞ — 何でも聞いてください。聞いています。",
    ko: "무엇이든 물어보세요. 듣고 있어요.",
    zh: "随时提问 — 什么都可以。我在听。",
    yue: "隨時問我 — 乜都得。我喺聽緊。",
    id: "Silakan tanya — apa saja. Aku mendengarkan.",
    ms: "Sila tanya — apa sahaja. Saya mendengar.",
    vi: "Cứ hỏi đi — bất cứ điều gì. Tôi đang lắng nghe.",
    th: "ถามได้เลย — อะไรก็ได้ ฉันกำลังฟังอยู่",
  },
  features1: {
    es: "Prueba preguntando qué vence esta semana. Te digo todo.",
    pt: "Tente perguntar o que vence essa semana. Eu te digo tudo.",
    "pt-PT": "Tenta perguntar o que vence esta semana. Digo-te tudo.",
    fr: "Essayez de me demander ce qui est dû cette semaine. Je vous dis tout.",
    de: "Fragen Sie mich, was diese Woche fällig ist. Ich sage Ihnen alles.",
    it: "Prova a chiedermi cosa scade questa settimana. Ti dico tutto.",
    nl: "Vraag me wat er deze week vervalt. Ik vertel u alles.",
    pl: "Spróbuj zapytać, co jest do zapłaty w tym tygodniu. Powiem ci wszystko.",
    sv: "Försök fråga vad som förfaller den här veckan. Jag berättar allt.",
    da: "Prøv at spørge, hvad der forfalder denne uge. Jeg fortæller dig alt.",
    no: "Prøv å spørre hva som forfaller denne uken. Jeg forteller deg alt.",
    fi: "Kokeile kysyä, mitkä laskut erääntyvät tällä viikolla. Kerron kaiken.",
    cs: "Zkuste se zeptat, co je splatné tento týden. Řeknu vám vše.",
    sk: "Skúste sa opýtať, čo je splatné tento týždeň. Poviem vám všetko.",
    ro: "Încearcă să mă întrebi ce e scadent săptămâna aceasta. Îți spun tot.",
    bg: "Опитай да ме попиташ какво е дължимо тази седмица. Ще ти кажа всичко.",
    hr: "Pokušaj me pitati što dospijeva ovog tjedna. Reći ću ti sve.",
    el: "Δοκίμασε να με ρωτήσεις τι λήγει αυτή την εβδομάδα. Θα σου πω τα πάντα.",
    hu: "Próbáld megkérdezni, mi esedékes ezen a héten. Mindent elmondok.",
    uk: "Спробуйте запитати, що потрібно сплатити цього тижня. Я розповім усе.",
    ru: "Попробуйте спросить, что нужно оплатить на этой неделе. Расскажу всё.",
    tr: "Bu hafta neyin ödeneceğini sormayı deneyin. Her şeyi söylerim.",
    ar: "جرّبي أن تسأليني ما الذي يحل هذا الأسبوع. سأخبركِ بكل شيء.",
    arz: "جربي تسأليني إيه اللي بيستحق الأسبوع ده. هقولك كل حاجة.",
    apc: "جربي تسأليني شو بيستحق هالأسبوع. رح أحكيلك كل شي.",
    afb: "جربي تسأليني وش يستحق هالأسبوع. أخبرك بكل شي.",
    hi: "इस हफ्ते क्या देय है पूछने की कोशिश करें। मैं सब बता दूँगी।",
    ta: "இந்த வாரம் என்ன காரணமாக இருக்கிறது என்று கேளுங்கள். எல்லாவற்றையும் சொல்கிறேன்.",
    ja: "今週の支払い期日を聞いてみてください。すべてお伝えします。",
    ko: "이번 주에 납부할 것이 뭔지 물어보세요. 전부 알려드릴게요.",
    zh: "试着问问这周有哪些到期账单。我会告诉你所有信息。",
    yue: "試下問我今個星期有咩到期賬單。我會話你知所有嘢。",
    id: "Coba tanya apa yang jatuh tempo minggu ini. Aku akan ceritakan semuanya.",
    ms: "Cuba tanya apa yang perlu dibayar minggu ini. Saya akan ceritakan segalanya.",
    vi: "Thử hỏi những gì đến hạn tuần này. Tôi sẽ cho bạn biết tất cả.",
    th: "ลองถามว่าสัปดาห์นี้มีบิลอะไรครบกำหนดบ้าง ฉันจะบอกทุกอย่าง",
  },
  features2: {
    es: "Pregúntame si es seguro gastar antes del cobro. Reviso tus facturas y te doy una respuesta clara.",
    pt: "Pergunte se é seguro gastar antes do salário. Vejo suas contas e dou uma resposta direta.",
    "pt-PT": "Pergunta se é seguro gastar antes do salário. Vejo as tuas faturas e dou-te uma resposta clara.",
    fr: "Demandez-moi si c'est prudent de dépenser avant la paie. Je vérifie et vous donne une réponse claire.",
    de: "Fragen Sie, ob es sicher ist, vor dem Zahltag auszugeben. Ich prüfe alles und gebe Ihnen eine klare Antwort.",
    it: "Chiedimi se è sicuro spendere prima del giorno di paga. Controllo tutto e ti do una risposta chiara.",
    nl: "Vraag of het veilig is om te besteden voor de salarisdag. Ik controleer alles en geef u een duidelijk antwoord.",
    pl: "Zapytaj mnie, czy bezpiecznie jest wydawać przed wypłatą. Sprawdzę i dam ci jasną odpowiedź.",
    sv: "Fråga om det är säkert att spendera före lönedagen. Jag kollar allt och ger dig ett tydligt svar.",
    da: "Spørg om det er sikkert at bruge penge før lønningsdagen. Jeg tjekker alt og giver dig et klart svar.",
    no: "Spør om det er trygt å bruke penger før lønningsdagen. Jeg sjekker alt og gir deg et tydelig svar.",
    fi: "Kysy, onko turvallista kuluttaa ennen palkkapäivää. Tarkistan kaiken ja annan sinulle selkeän vastauksen.",
    cs: "Zeptejte se, zda je bezpečné utrácet před výplatou. Zkontroluju vše a dám vám jasnou odpověď.",
    sk: "Opýtajte sa, či je bezpečné míňať pred výplatou. Skontrolujem všetko a dám vám jasnú odpoveď.",
    ro: "Întreabă-mă dacă e sigur să cheltuiești înainte de ziua de salariu. Verific totul și îți dau un răspuns clar.",
    bg: "Попитай ме дали е безопасно да харчиш преди заплата. Проверявам всичко и ти давам ясен отговор.",
    hr: "Pitaj me je li sigurno trošiti prije isplate. Provjerim sve i dam ti jasan odgovor.",
    el: "Ρώτησέ με αν είναι ασφαλές να ξοδέψεις πριν την ημέρα πληρωμής. Ελέγχω τα πάντα και σου δίνω μια ξεκάθαρη απάντηση.",
    hu: "Kérdezd meg, hogy biztonságos-e fizetésnap előtt pénzt költeni. Mindent ellenőrzök és egyértelmű választ adok.",
    uk: "Запитайте мене, чи безпечно витрачати перед зарплатою. Перевіряю все і даю вам чітку відповідь.",
    ru: "Спросите меня, безопасно ли тратить деньги до зарплаты. Проверю всё и дам вам чёткий ответ.",
    tr: "Maaş gününden önce harcama yapmanın güvenli olup olmadığını sorun. Her şeyi kontrol edip net bir cevap veririm.",
    ar: "اسأليني هل من الآمن الإنفاق قبل يوم الراتب. سأتحقق من كل شيء وأعطيكِ إجابة واضحة.",
    arz: "اسأليني هل الإنفاق آمن قبل المرتب. هتحقق من كل حاجة وأديكِ إجابة واضحة.",
    apc: "اسأليني إذا كان الإنفاق آمن قبل الراتب. رح أتحقق من كل شي وأعطيكِ جواب واضح.",
    afb: "اسأليني إذا الإنفاق آمن قبل الراتب. أتحقق من كل شي وأعطيك جواب صريح.",
    hi: "मुझसे पूछें कि तनख्वाह से पहले खर्च करना सुरक्षित है या नहीं। मैं सब जाँचकर साफ जवाब दूँगी।",
    ta: "சம்பளத்திற்கு முன் செலவழிப்பது பாதுகாப்பானதா என்று கேளுங்கள். எல்லாவற்றையும் சரிபார்த்து தெளிவான பதில் தருகிறேன்.",
    ja: "給料日前に使っても大丈夫か聞いてください。すべて確認して明確な答えをお伝えします。",
    ko: "월급날 전에 써도 되는지 물어보세요. 모두 확인하고 명확한 답을 드릴게요.",
    zh: "问问我发薪日前是否可以安全消费。我会检查一切并给你明确的答案。",
    yue: "問下我出糧前係咪可以安全消費。我會查晒所有嘢，畀你一個清晰嘅答案。",
    id: "Tanya aku apakah aman menghabiskan uang sebelum gajian. Aku periksa semua dan berikan jawaban yang jelas.",
    ms: "Tanya saya sama ada selamat untuk berbelanja sebelum hari gaji. Saya semak semuanya dan beri anda jawapan yang jelas.",
    vi: "Hỏi tôi liệu có an toàn để chi tiêu trước ngày lương không. Tôi kiểm tra tất cả và đưa ra câu trả lời rõ ràng.",
    th: "ถามฉันว่าใช้จ่ายก่อนวันเงินเดือนปลอดภัยไหม ฉันจะตรวจสอบทุกอย่างและให้คำตอบที่ชัดเจน",
  },
  paywall: {
    es: "Tienes ocho preguntas gratuitas para empezar. Cuando quieras más, elige un plan.",
    pt: "Você tem oito perguntas gratuitas para começar. Quando quiser mais, escolha um plano.",
    "pt-PT": "Tens oito perguntas gratuitas para começar. Quando quiseres mais, escolhe um plano.",
    fr: "Vous avez huit questions gratuites pour commencer. Quand vous en voulez plus, choisissez un plan.",
    de: "Sie haben acht kostenlose Fragen zum Start. Wenn Sie mehr möchten, wählen Sie einen Plan.",
    it: "Hai otto domande gratuite per iniziare. Quando vuoi di più, scegli un piano.",
    nl: "U heeft acht gratis vragen om mee te beginnen. Als u meer wilt, kies dan een abonnement.",
    pl: "Masz osiem darmowych pytań na start. Kiedy będziesz chciała więcej, wybierz plan.",
    sv: "Du har åtta gratisfrågor att börja med. När du vill ha mer, välj en plan.",
    da: "Du har otte gratis spørgsmål at starte med. Når du vil have mere, vælg en plan.",
    no: "Du har åtte gratis spørsmål å starte med. Når du vil ha mer, velg en plan.",
    fi: "Sinulla on kahdeksan ilmaista kysymystä aloittaaksesi. Kun haluat lisää, valitse suunnitelma.",
    cs: "Máte osm bezplatných otázek pro začátek. Až budete chtít více, vyberte si plán.",
    sk: "Máte osem bezplatných otázok na začiatok. Keď budete chcieť viac, vyberte si plán.",
    ro: "Ai opt întrebări gratuite pentru început. Când vrei mai mult, alege un plan.",
    bg: "Имаш осем безплатни въпроса за начало. Когато искаш повече, избери план.",
    hr: "Imaš osam besplatnih pitanja za početak. Kad budeš htjela više, odaberi plan.",
    el: "Έχεις οκτώ δωρεάν ερωτήσεις για αρχή. Όταν θέλεις περισσότερες, επέλεξε ένα πρόγραμμα.",
    hu: "Nyolc ingyenes kérdésed van a kezdéshez. Ha többet szeretnél, válassz egy csomagot.",
    uk: "У вас є вісім безкоштовних запитань для початку. Коли захочете більше, оберіть план.",
    ru: "У вас есть восемь бесплатных вопросов для начала. Когда захотите больше, выберите тариф.",
    tr: "Başlamak için sekiz ücretsiz sorunuz var. Daha fazlasını istediğinizde bir plan seçin.",
    ar: "لديكِ ثمانية أسئلة مجانية للبدء. عندما تريدين المزيد، اختاري خطة.",
    arz: "عندك تمانية أسئلة مجانية تبدأي بيها. لما تيجي تعملي إيه، اختاري خطة.",
    apc: "عندك تمانية أسئلة مجانية لتبدأي. لما بدك أكثر، اختاري خطة.",
    afb: "عندك ثمانية أسئلة مجانية تبدأين فيها. لما تبين أكثر، اختاري خطة.",
    hi: "आपके पास शुरुआत के लिए आठ मुफ्त सवाल हैं। जब और चाहिए, कोई प्लान चुनें।",
    ta: "தொடங்குவதற்கு உங்களிடம் எட்டு இலவச கேள்விகள் உள்ளன. மேலும் வேண்டும்போது திட்டம் தேர்ந்தெடுங்கள்.",
    ja: "最初に8つの無料質問があります。もっと使いたいときはプランを選んでください。",
    ko: "시작할 때 8개의 무료 질문이 있어요. 더 원하시면 플랜을 선택해 주세요.",
    zh: "你有八个免费问题可以开始使用。想要更多时，请选择一个方案。",
    yue: "你有八個免費問題可以開始使用。想要更多嘅時候，揀一個方案。",
    id: "Kamu punya delapan pertanyaan gratis untuk memulai. Ketika mau lebih, pilih paket.",
    ms: "Anda mempunyai lapan soalan percuma untuk bermula. Apabila mahu lebih, pilih pelan.",
    vi: "Bạn có tám câu hỏi miễn phí để bắt đầu. Khi muốn thêm, hãy chọn một gói.",
    th: "คุณมีคำถามฟรีแปดข้อเพื่อเริ่มต้น เมื่อต้องการเพิ่มเติม เลือกแผน",
  },
  personalizing: {
    es: "Configurando tus recordatorios. Ya casi está.",
    pt: "Configurando seus lembretes. Já quase pronto.",
    "pt-PT": "A configurar os teus lembretes. Já está quase.",
    fr: "Configuration de vos rappels en cours. Presque prêt.",
    de: "Ich richte Ihre Erinnerungen ein. Gleich fertig.",
    it: "Sto configurando i tuoi promemoria. Quasi pronto.",
    nl: "Uw herinneringen worden ingesteld. Bijna klaar.",
    pl: "Konfiguruję twoje przypomnienia. Prawie gotowe.",
    sv: "Konfigurerar dina påminnelser. Snart klar.",
    da: "Opsætter dine påmindelser. Næsten færdig.",
    no: "Setter opp påminnelsene dine. Nesten ferdig.",
    fi: "Asetan muistutuksesi. Melkein valmis.",
    cs: "Nastavuji vaše připomínky. Téměř hotovo.",
    sk: "Nastavujem vaše pripomienky. Takmer hotovo.",
    ro: "Configurez mementourile tale. Aproape gata.",
    bg: "Настройвам напомнянията ти. Почти готово.",
    hr: "Postavljam tvoje podsjetnike. Skoro gotovo.",
    el: "Ρυθμίζω τις υπενθυμίσεις σου. Σχεδόν έτοιμο.",
    hu: "Beállítom az emlékeztetőidet. Majdnem kész.",
    uk: "Налаштовую ваші нагадування. Майже готово.",
    ru: "Настраиваю ваши напоминания. Почти готово.",
    tr: "Hatırlatmalarınız ayarlanıyor. Neredeyse hazır.",
    ar: "أقوم بإعداد تذكيراتك. تقريباً جاهز.",
    arz: "بجهّز تذكيراتك. تقريباً خلصنا.",
    apc: "عم بجهّز تذكيراتك. تقريباً جاهز.",
    afb: "أجهّز تذكيراتك. تقريباً جاهز.",
    hi: "आपके रिमाइंडर सेट हो रहे हैं। लगभग तैयार।",
    ta: "உங்கள் நினைவூட்டல்களை அமைக்கிறேன். கிட்டத்தட்ட தயார்.",
    ja: "リマインダーを設定しています。もうすぐ完了です。",
    ko: "알림을 설정하고 있어요. 거의 다 됐어요.",
    zh: "正在设置你的提醒。快好了。",
    yue: "正在設定你嘅提醒。快好喇。",
    id: "Mengatur pengingatmu. Hampir selesai.",
    ms: "Menetapkan peringatan anda. Hampir selesai.",
    vi: "Đang thiết lập lời nhắc của bạn. Sắp xong rồi.",
    th: "กำลังตั้งค่าการแจ้งเตือนของคุณ เกือบเสร็จแล้ว",
  },
};

/**
 * Translate an English onboarding voice line to the target language.
 * Falls back to the original text if no translation is found.
 * English and Filipino lines are returned as-is (Filipino is translated client-side).
 */
function translateOnbLine(text: string, language: string): string {
  if (language.startsWith("en") || FILIPINO_LANG_CODES.has(language)) return text;
  const concept = ONB_LINE_TO_CONCEPT[text];
  if (!concept) return text;
  const conceptMap = ONB_TRANSLATIONS[concept];
  if (!conceptMap) return text;
  return (
    conceptMap[language] ??
    conceptMap[language.split("-").slice(0, 2).join("-")] ??
    conceptMap[language.split("-")[0]] ??
    text
  );
}

// POST /api/judith/tts-onboarding  { text, persona? } -> { audioBase64, mime }
// No auth required — called during onboarding where the user may be a guest.
router.post("/tts-onboarding", sttTtsOnboardingGlobalCap, sttTtsOnboardingLimiter, async (req, res) => {
  try {
    const { text, persona, language } = req.body ?? {};
    if (typeof text !== "string" || !text.trim() || text.length > 350) {
      res.status(400).json({ error: "text must be non-empty and under 350 chars" });
      return;
    }
    const chosen = coercePersona(persona);
    const lang = typeof language === "string" ? language : undefined;

    // Check object-storage cache before calling ElevenLabs.
    if (lang) {
      const concept = ONB_LINE_TO_CONCEPT[text.trim()];
      if (concept) {
        const cached = await getOnbAudio(concept, chosen, lang);
        if (cached) {
          res.json({ audioBase64: cached.base64, mime: cached.mime });
          return;
        }
      }
    }

    const translatedText = lang ? translateOnbLine(text.trim(), lang) : text.trim();
    const audio = await synthesize(translatedText, getVoiceId(chosen, lang), { live: true, speed: getSpeakingSpeed(chosen) });

    // Populate cache for next time (fire-and-forget — never blocks the response).
    if (lang) {
      const concept = ONB_LINE_TO_CONCEPT[text.trim()];
      if (concept) {
        setOnbAudio(concept, chosen, lang, audio.base64).catch(() => {});
      }
    }

    res.json({ audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "tts-onboarding failed");
    res.status(500).json({ error: "Speech synthesis failed" });
  }
});

// POST /api/judith/parse-subscription-screenshot  { imageBase64, mimeType } -> { subscriptions }
// No auth required — vision extraction of active subscriptions from a screenshot.
router.post("/parse-subscription-screenshot", parseGlobalCap, parseLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body ?? {};
    if (typeof imageBase64 !== "string" || !imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }
    const mime = (typeof mimeType === "string" && mimeType
      ? mimeType
      : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mime, data: imageBase64 },
            },
            {
              type: "text",
              text: `Today's date is ${new Date().toISOString().slice(0, 10)}. Extract the ACTIVE subscriptions from this phone subscriptions screen screenshot.

Return ONLY a valid JSON array — no markdown fences, no explanation, nothing else:
[{"provider":"string","amount":number|null,"dueDay":number|null,"frequency":"monthly"|"annual","nextDue":"YYYY-MM-DD"|null}]

Rules:
- provider: the service/app name exactly as shown (e.g. "YouTube Premium", "Spotify", "iCloud+", "Netflix")
- amount: the numeric price as a plain number (e.g. 249 for ₱249.00 or $2.99). Null if not shown.
- dueDay: the calendar day (1-31) it renews, extracted from the renewal date shown (e.g. "Renews 30 June" → 30, "Renews 11 May 2027" → 11). Null if not determinable.
- frequency: "annual" if the subscription renews yearly (e.g. "Renews 11 May 2027", "Annual", "Yearly"); "monthly" if it renews every month (e.g. "Renews 15 Jul", "Monthly"). Default to "monthly" if not determinable.
- nextDue: the FULL next renewal/expiry date as YYYY-MM-DD. Resolve relative dates against today's date — a month/day with no year (e.g. "Renews 30 June", "Expires on 30 June") means the next such date that is today or later. Keep an explicit year when shown (e.g. "Renews 11 May 2027" → "2027-05-11"). Null if no date is shown.
- Include ONLY active/current subscriptions. Ignore expired, inactive, or cancelled ones entirely.
- Return [] if no active subscriptions are visible.`,
            },
          ],
        },
      ],
    });
    const raw = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(raw) as unknown[];
    const subscriptions = (Array.isArray(parsed) ? parsed : [])
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        provider: typeof s["provider"] === "string" && s["provider"].trim()
          ? s["provider"].trim()
          : "Subscription",
        amount: s["amount"] != null && Number(s["amount"]) > 0 ? Number(s["amount"]) : null,
        dueDay: s["dueDay"] != null && Number(s["dueDay"]) >= 1 && Number(s["dueDay"]) <= 31
          ? Number(s["dueDay"])
          : null,
        frequency: s["frequency"] === "annual" ? ("annual" as const) : ("monthly" as const),
        nextDue: typeof s["nextDue"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["nextDue"])
          ? s["nextDue"]
          : null,
      }));
    res.json({ subscriptions });
  } catch (err) {
    logger.error({ err }, "parse-subscription-screenshot failed");
    res.status(500).json({ error: "Could not parse screenshot" });
  }
});

// GET /api/judith/sample-onboarding?persona=  -> { text, audioBase64, mime }
// No auth required — persona voice preview during onboarding.
router.get("/sample-onboarding", sampleOnboardingGlobalCap, sampleOnboardingLimiter, async (req, res) => {
  try {
    const persona = coercePersona(req.query["persona"]);
    const language = typeof req.query["language"] === "string" ? req.query["language"] : undefined;
    const text = getSampleText(persona, language);
    const audio = await synthesize(text, getVoiceId(persona, language), { live: true, speed: getSpeakingSpeed(persona) });
    res.json({ text, audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "sample-onboarding failed");
    res.status(500).json({ error: "Sample playback failed" });
  }
});

export default router;
