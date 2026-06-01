import { Router, type IRouter, type Request, type Response } from "express";
import {
  bearerToken,
  getSupabaseAdmin,
  getUserFromToken,
} from "../lib/supabaseAdmin";
import { getAnthropic, ANTHROPIC_MODEL } from "../lib/anthropic";
import { transcribe, synthesize, listVoices } from "../lib/elevenlabs";
import {
  DEFAULT_VOICE_IDS,
  systemPrompt,
  type PersonaId,
} from "../lib/personas";
import {
  amountToWords,
  englishDate,
  englishWeekday,
} from "../lib/normalize";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PERSONAS: PersonaId[] = ["professional", "funny", "sarcastic", "mom"];

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
function buildBillsContext(bills: BillRow[], today: Date): string {
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
          ? `variable, last known ${amountToWords(bill.amount)}`
          : "variable amount, not yet known"
        : amountToWords(bill.amount);

    if (bill.status === "paid") {
      lines.push(`- ${bill.name}${provider} [${bill.category}] — already PAID. Amount: ${amount}.`);
      continue;
    }

    if (!due) {
      lines.push(`- ${bill.name}${provider} [${bill.category}] — no due date set. Amount: ${amount}.`);
      continue;
    }

    const days = daysBetween(today, due);
    const when =
      days === 0 ? "due TODAY" : days < 0 ? `OVERDUE by ${Math.abs(days)} day(s)` : `due in ${days} day(s)`;
    lines.push(
      `- ${bill.name}${provider} [${bill.category}] — ${amount}, due on ${englishDate(due)} (${englishWeekday(due)}), ${when}.`,
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
    `Total of fixed bills due within 7 days: ${amountToWords(dueThisWeek)}.`,
    `Total of fixed bills due this month: ${amountToWords(dueThisMonth)}.`,
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
}

function pesoStr(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-US")}`;
}

function buildClientContext(bills: ClientBill[], today: Date): string {
  const due = bills.filter((b) => b.status !== "paid");
  const total = due.reduce((s, b) => s + (b.amount ?? 0), 0);
  const dueThisWeek = due
    .filter((b) => (b.dueDays ?? 0) >= 0 && (b.dueDays ?? 0) <= 7)
    .reduce((s, b) => s + (b.amount ?? 0), 0);
  const lines = bills.map((b) => {
    const days = b.dueDays ?? 0;
    const when =
      days === 0 ? "due TODAY" : days < 0 ? `OVERDUE by ${Math.abs(days)} day(s)` : `due in ${days} day(s)`;
    return `- ${b.provider ?? "Bill"} (${b.cat ?? "Other"}): ${pesoStr(b.amount ?? 0)}, ${b.dueLabel ?? "—"}, ${when}, ${b.status ?? "unpaid"}.`;
  });
  return [
    `Today is ${englishDate(today)} (${englishWeekday(today)}).`,
    `Total still due (unpaid): ${pesoStr(total)}.`,
    `Total of bills due within 7 days: ${pesoStr(dueThisWeek)}.`,
    "",
    "BILLS:",
    lines.join("\n"),
  ].join("\n");
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

async function requireUser(req: Request, res: Response) {
  const user = await getUserFromToken(bearerToken(req.headers.authorization));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}

// POST /api/judith/stt  { audioBase64, mimeType } -> { text }
router.post("/stt", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const { audioBase64, mimeType } = req.body ?? {};
    if (typeof audioBase64 !== "string" || !audioBase64) {
      res.status(400).json({ error: "audioBase64 is required" });
      return;
    }
    const buffer = Buffer.from(audioBase64, "base64");
    const text = await transcribe(buffer, typeof mimeType === "string" ? mimeType : "audio/m4a");
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "stt failed");
    res.status(500).json({ error: "Transcription failed" });
  }
});

// POST /api/judith/ask  { text } -> { reply, audioBase64, mime }
router.post("/ask", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const { text, bills: bodyBills, persona: bodyPersona } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    let persona: PersonaId;
    let voiceId: string;
    let context: string;
    if (Array.isArray(bodyBills)) {
      persona = coercePersona(bodyPersona);
      voiceId = DEFAULT_VOICE_IDS[persona];
      context = buildClientContext(bodyBills as ClientBill[], new Date());
    } else {
      const data = await loadUserData(user.id);
      persona = data.persona;
      voiceId = data.voiceId;
      context = buildBillsContext(data.bills, new Date());
    }

    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: `${systemPrompt(persona)}\n\nBILL CONTEXT (the only source of truth):\n${context}`,
      messages: [{ role: "user", content: text.trim() }],
    });

    const reply = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();

    let audioBase64: string | null = null;
    let mime = "audio/mpeg";
    try {
      const audio = await synthesize(reply, voiceId, { live: true });
      audioBase64 = audio.base64;
      mime = audio.mime;
    } catch (ttsErr) {
      logger.error({ err: ttsErr }, "tts failed during ask");
    }

    res.json({ reply, audioBase64, mime });
  } catch (err) {
    logger.error({ err }, "ask failed");
    res.status(500).json({ error: "Judith could not respond right now" });
  }
});

// POST /api/judith/tts  { text, persona? } -> { audioBase64, mime }
router.post("/tts", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const { text, persona, voiceId: bodyVoiceId } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const { voiceId, persona: profilePersona } = await loadUserData(user.id);
    const chosen = persona ? coercePersona(persona) : profilePersona;
    const voice =
      typeof bodyVoiceId === "string" && bodyVoiceId
        ? bodyVoiceId
        : persona
          ? DEFAULT_VOICE_IDS[chosen]
          : voiceId;
    const audio = await synthesize(text.trim(), voice, { live: false });
    res.json({ audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "tts failed");
    res.status(500).json({ error: "Speech synthesis failed" });
  }
});

// GET /api/judith/sample?persona=  -> { text, audioBase64, mime }
const SAMPLE_LINES: Record<PersonaId, string> = {
  professional:
    "Kumusta, ako si Judith. Ipapaalala ko sa'yo ang mga bayarin mo bago pa man sila mag-due.",
  funny:
    "Uy, ako si Judith! Wag kang mag-alala sa mga bills, ako na ang bahala — wala nang surprise na due date, promise!",
  sarcastic:
    "Hi, si Judith 'to. Oo, ako na naman ang magpapaalala ng bills mo, kasi 'di ba, lagi mong nakakalimutan?",
  mom:
    "Anak, si Mama 'to — si Judith. Bantayan ko ang mga bayarin mo, ha. Oo nga pala, kumain ka na ba?",
};

// GET /api/judith/voices -> { voices: [{ id, name, category }] }
router.get("/voices", async (req, res) => {
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

router.get("/sample", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const persona = coercePersona(req.query["persona"]);
    const text = SAMPLE_LINES[persona];
    const audio = await synthesize(text, DEFAULT_VOICE_IDS[persona], { live: false });
    res.json({ text, audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "sample failed");
    res.status(500).json({ error: "Sample playback failed" });
  }
});

// POST /api/judith/stt-onboarding  { audioBase64, mimeType } -> { text }
// No auth required — called during onboarding where the user may be a guest.
router.post("/stt-onboarding", async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body ?? {};
    if (typeof audioBase64 !== "string" || !audioBase64) {
      res.status(400).json({ error: "audioBase64 is required" });
      return;
    }
    const buffer = Buffer.from(audioBase64, "base64");
    const text = await transcribe(
      buffer,
      typeof mimeType === "string" ? mimeType : "audio/m4a",
    );
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "stt-onboarding failed");
    res.status(500).json({ error: "Transcription failed" });
  }
});

// POST /api/judith/tts-onboarding  { text, persona? } -> { audioBase64, mime }
// No auth required — called during onboarding where the user may be a guest.
router.post("/tts-onboarding", async (req, res) => {
  try {
    const { text, persona } = req.body ?? {};
    if (typeof text !== "string" || !text.trim() || text.length > 350) {
      res.status(400).json({ error: "text must be non-empty and under 350 chars" });
      return;
    }
    const chosen = coercePersona(persona);
    const audio = await synthesize(text.trim(), DEFAULT_VOICE_IDS[chosen], { live: false });
    res.json({ audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "tts-onboarding failed");
    res.status(500).json({ error: "Speech synthesis failed" });
  }
});

// GET /api/judith/sample-onboarding?persona=  -> { text, audioBase64, mime }
// No auth required — persona voice preview during onboarding.
router.get("/sample-onboarding", async (req, res) => {
  try {
    const persona = coercePersona(req.query["persona"]);
    const text = SAMPLE_LINES[persona];
    const audio = await synthesize(text, DEFAULT_VOICE_IDS[persona], { live: false });
    res.json({ text, audioBase64: audio.base64, mime: audio.mime });
  } catch (err) {
    logger.error({ err }, "sample-onboarding failed");
    res.status(500).json({ error: "Sample playback failed" });
  }
});

export default router;
