import { Router, type IRouter, type Request, type Response } from "express";
import {
  bearerToken,
  getSupabaseAdmin,
  getUserFromToken,
} from "../lib/supabaseAdmin";
import { getAnthropic, ANTHROPIC_MODEL } from "../lib/anthropic";
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
import {
  askLimiter,
  sttTtsLimiter,
  sampleVoicesLimiter,
  parseLimiter,
  sampleOnboardingLimiter,
  askOnboardingLimiter,
  sttTtsOnboardingLimiter,
} from "../middleware/rateLimit";

const router: IRouter = Router();

const PERSONAS: PersonaId[] = ["professional", "funny", "sarcastic", "mom", "marites"];

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
}

function curStr(cur: string, n: number): string {
  return `${cur}${Math.round(n).toLocaleString("en-US")}`;
}

function buildClientContext(bills: ClientBill[], today: Date, cur = "₱", monthlyIncome?: number, incomeByMonth?: Record<string, number>): string {
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
  const bizNameMap = new Map<string, { payable: number; viaCard: number; providers: string[] }>();
  for (const b of [...bizUnpaid, ...bizViaCard]) {
    const key = b.businessName?.trim() || "(untagged)";
    const entry = bizNameMap.get(key) ?? { payable: 0, viaCard: 0, providers: [] };
    if (isViaCard(b)) { entry.viaCard += b.amount ?? 0; } else { entry.payable += b.amount ?? 0; }
    entry.providers.push(b.provider ?? "Bill");
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
    const when = b.isProjection
      ? `due ~${b.dueLabel ?? "next month"} (estimated — not yet billed)`
      : days === 0 ? "due TODAY" : days < 0 ? `OVERDUE by ${Math.abs(days)} day(s)` : `due in ${days} day(s)`;
    const bizTag = b.isBusiness
      ? (b.businessName ? ` [BUSINESS: ${b.businessName}]` : " [BUSINESS]")
      : " [PERSONAL]";
    // Only tag charges that are actually excluded from the totals (resolved card
    // link). A dangling link is still counted, so tagging it would mislead.
    const cardTag = isViaCard(b) ? ` [AUTO-CHARGED to ${b.cardName}]` : "";
    const estTag = b.isProjection ? " [ESTIMATED NEXT MONTH]" : "";
    return `- ${b.provider ?? "Bill"} (${b.cat ?? "Other"})${bizTag}${cardTag}${estTag}: ${curStr(cur, b.amount ?? 0)}, ${when}, ${b.status ?? "upcoming"}.`;
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
  const incomeHeader = hasVariable
    ? `User has VARIABLE monthly income. Default: ${monthlyIncome != null && monthlyIncome > 0 ? curStr(cur, monthlyIncome) : "not set"}/month. Overrides: ${Object.entries(incomeByMonth ?? {}).map(([k, v]) => `${k}: ${curStr(cur, v)}`).join(", ")}.`
    : monthlyIncome != null && Number.isFinite(monthlyIncome) && monthlyIncome > 0
      ? `User's estimated monthly take-home income: ${curStr(cur, monthlyIncome)}.`
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
    `Today is ${englishDate(today)} (${englishWeekday(today)}).`,
    ...(incomeHeader ? [incomeHeader] : []),
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
      ? `Business breakdown by entity: ${[...bizNameMap.entries()].map(([name, { payable: p, viaCard: vc, providers }]) => {
          const total = p + vc;
          const detail = [p > 0 ? `${curStr(cur, p)} payable` : "", vc > 0 ? `${curStr(cur, vc)} via card` : ""].filter(Boolean).join(" + ");
          return `"${name}" = ${curStr(cur, total)} (${detail}): ${providers.join(", ")}`;
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
      const vcNote = vc > 0 && p > 0
        ? ` (${curStr(cur, p)} direct + ${curStr(cur, vc)} via card)`
        : vc > 0 ? " (all via card)" : "";
      return `- ${cat}: ${curStr(cur, total)} total${vcNote} [${breakdown}]`;
    });

  parts.push(
    "",
    "MONTHLY TOTALS (payable bills only — excludes auto-charged card bills):",
    monthLines.join("\n"),
    "",
    "SPENDING BY CATEGORY (includes auto-charged card bills — use for category/business cost questions):",
    catLines.join("\n"),
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

/** Returns the authenticated Supabase user, or a guest sentinel for unauthenticated requests. */
async function requireUser(req: Request, res: Response) {
  const token = bearerToken(req.headers.authorization);
  if (token) {
    const user = await getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return user;
  }
  // No token → guest mode. Allow the request; return a typed sentinel so callers stay simple.
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
router.post("/ask", askLimiter, async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const { text, bills: bodyBills, persona: bodyPersona, localDate, language, includeVoice, currency, countryName, countryCode, monthlyIncome, incomeByMonth } = req.body ?? {};
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
    const context: string = buildClientContext(bodyBills as ClientBill[], today, cur, income, incomeMo);

    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 120,
      system: `${systemPrompt(persona, typeof language === "string" ? language : undefined, country, cur, cCode)}\n\nBILL CONTEXT (the only source of truth):\n${context}`,
      messages: [{ role: "user", content: text.trim() }],
    });

    const rawReply = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();
    const { cleanText: reply, action } = parseAction(rawReply);

    let audioBase64: string | null = null;
    let mime = "audio/mpeg";
    let ttsOk = false;
    let ttsChars = 0;
    if (includeVoice !== false) {
      try {
        if (await isSafeForTTS(reply)) {
          const audio = await synthesize(reply, voiceId, { live: true, speed: getSpeakingSpeed(persona) });
          audioBase64 = audio.base64;
          mime = audio.mime;
          ttsOk = true;
          ttsChars = reply.length;
        } else {
          logger.warn("tts skipped — moderation flagged reply");
        }
      } catch (ttsErr) {
        logger.error({ err: ttsErr }, "tts failed during ask");
      }
    }

    res.json({ reply, audioBase64, mime, action });

    getSupabaseAdmin()
      .from("ask_logs")
      .insert({
        user_id: user.id,
        persona,
        language: typeof language === "string" ? language : "en",
        input_chars: text.trim().length,
        reply_chars: reply.length,
        tts_ok: ttsOk,
        tts_chars: ttsChars,
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      })
      .then(({ error }) => {
        if (error) logger.warn({ err: error }, "ask_logs insert failed");
      });
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
const SAMPLE_LINES: Record<PersonaId, string> = {
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
};

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
    const language = typeof req.query["language"] === "string" ? req.query["language"] : undefined;
    const text = SAMPLE_LINES[persona];
    const audio = await synthesize(text, getVoiceId(persona, language), { live: false, speed: getSpeakingSpeed(persona) });
    res.json({ text, audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "sample failed");
    res.status(500).json({ error: "Sample playback failed" });
  }
});

// POST /api/judith/ask-onboarding  { text, bills?, persona? } -> { reply, audioBase64, mime }
// No auth required — interactive AI ask during onboarding feature screens.
router.post("/ask-onboarding", askOnboardingLimiter, async (req, res) => {
  try {
    const { text, bills: bodyBills, persona: bodyPersona, localDate, language } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const persona = coercePersona(bodyPersona);
    const lang = typeof language === "string" ? language : undefined;
    const voiceId = getVoiceId(persona, lang);
    const bills = Array.isArray(bodyBills) ? (bodyBills as ClientBill[]) : [];
    const context = buildClientContext(bills, parseLocalDate(localDate));

    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 250,
      system: `${systemPrompt(persona, lang)}\n\nBILL CONTEXT (the only source of truth):\n${context}`,
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
      /* Onboarding = first impression — use high-quality non-live model (eleven_v3) */
      if (await isSafeForTTS(reply)) {
        const audio = await synthesize(reply, voiceId, { live: false, speed: getSpeakingSpeed(persona) });
        audioBase64 = audio.base64;
        mime = audio.mime;
      } else {
        logger.warn("tts skipped — moderation flagged onboarding reply");
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
router.post("/parse-bill", parseLimiter, async (req, res) => {
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
router.post("/stt-onboarding", sttTtsOnboardingLimiter, async (req, res) => {
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

// POST /api/judith/tts-onboarding  { text, persona? } -> { audioBase64, mime }
// No auth required — called during onboarding where the user may be a guest.
router.post("/tts-onboarding", sttTtsOnboardingLimiter, async (req, res) => {
  try {
    const { text, persona, language } = req.body ?? {};
    if (typeof text !== "string" || !text.trim() || text.length > 350) {
      res.status(400).json({ error: "text must be non-empty and under 350 chars" });
      return;
    }
    const chosen = coercePersona(persona);
    const audio = await synthesize(text.trim(), getVoiceId(chosen, typeof language === "string" ? language : undefined), { live: true, speed: getSpeakingSpeed(chosen) });
    res.json({ audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "tts-onboarding failed");
    res.status(500).json({ error: "Speech synthesis failed" });
  }
});

// POST /api/judith/parse-subscription-screenshot  { imageBase64, mimeType } -> { subscriptions }
// No auth required — vision extraction of active subscriptions from a screenshot.
router.post("/parse-subscription-screenshot", parseLimiter, async (req, res) => {
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
router.get("/sample-onboarding", sampleOnboardingLimiter, async (req, res) => {
  try {
    const persona = coercePersona(req.query["persona"]);
    const language = typeof req.query["language"] === "string" ? req.query["language"] : undefined;
    const text = SAMPLE_LINES[persona];
    const audio = await synthesize(text, getVoiceId(persona, language), { live: true, speed: getSpeakingSpeed(persona) });
    res.json({ text, audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "sample-onboarding failed");
    res.status(500).json({ error: "Sample playback failed" });
  }
});

export default router;
