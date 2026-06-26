/**
 * Handles messages sent FROM the Apple Watch TO the phone.
 *
 * Two delivery channels are handled:
 *   1. sendMessage  (watch→phone when phone is reachable/foreground)
 *      — arrives via addMessageListener; replyHandler available
 *   2. transferUserInfo (watch→phone background fallback)
 *      — arrives via watchEvents 'user-info'; no reply needed
 *
 * Supported actions:
 *   {action: "ask",             query: string} → calls /ask API, replies {answer}
 *   {action: "transcribeAudio", audioBase64}   → calls /stt API, replies {text}
 *   {action: "markPaid",        billId: string} → marks bill paid in local store
 *   {action: "applyAction",     payload: string} → JSON-encoded Judith action
 *                                               drained from the watch's
 *                                               offline queue (standalone
 *                                               /watch-ask path). Replayed
 *                                               with the same dispatcher used
 *                                               by the phone Ask flow.
 *
 * Safe to mount unconditionally — no-ops when WatchConnectivity is absent
 * (Expo Go, Android, no paired watch).
 */
import { useEffect, useRef } from "react";
import { useJudith } from "@/contexts/JudithStore";
import { askJudith, transcribe, type JudithAction } from "@/lib/proxy";
import {
  currentCycleDue,
  makeBillFromAction,
  type Bill,
} from "@/constants/data";
import { buildAskBills } from "@/lib/buildAskBills";
import { syncBillsToWatch, WatchConnectivity } from "@/lib/watch";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.0001;
  return `${currency}${rounded.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function getOutstandingAmount(bill: Bill): number {
  return Math.max(0, bill.amount + (bill.carryOver ?? 0) - (bill.amountPaid ?? 0));
}

function resolveBillByTarget(
  target: string | null,
  bills: Bill[],
): Bill | null {
  const unpaidBills = bills
    .filter((bill) => bill.status !== "paid")
    .sort((left, right) => currentCycleDue(left).dueDays - currentCycleDue(right).dueDays);

  if (unpaidBills.length === 0) return null;
  if (!target) {
    return unpaidBills.length === 1 ? unpaidBills[0] : null;
  }

  const normalizedTarget = normalizeText(target);
  if (!normalizedTarget) return unpaidBills.length === 1 ? unpaidBills[0] : null;

  const targetTokens = normalizedTarget.split(" ").filter(Boolean);
  const scored = unpaidBills
    .map((bill) => {
      const normalizedProvider = normalizeText(bill.provider);
      const tokenMatches = targetTokens.filter(
        (token) =>
          normalizedProvider.includes(token) || token.includes(normalizedProvider),
      ).length;
      const directMatch =
        normalizedProvider.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedProvider);
      return { bill, score: directMatch ? tokenMatches + 10 : tokenMatches };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.score > 0 ? scored[0].bill : null;
}

function extractMarkPaidTarget(query: string): string | null {
  const lowered = query.toLowerCase().trim();

  const targetedPatterns = [
    /mark\s+(.+?)\s+as\s+paid/,
    /mark\s+(.+?)\s+paid/,
    /pay\s+(.+?)\s+bill/,
    /pay\s+(.+?)\s+as\s+paid/,
  ];

  for (const pattern of targetedPatterns) {
    const match = lowered.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  if (
    lowered.includes("mark the bill as paid") ||
    lowered.includes("mark this bill as paid") ||
    lowered.includes("mark bill as paid") ||
    lowered.includes("pay this bill")
  ) {
    return "";
  }

  return null;
}

function resolveMarkPaidBill(query: string, bills: Bill[]): Bill | null {
  const target = extractMarkPaidTarget(query);
  if (target == null) return null;
  return resolveBillByTarget(target, bills);
}

function extractPartialPayment(query: string): { target: string | null; amount: number } | null {
  const lowered = query.toLowerCase().trim();
  if (!/(^|\s)(paid|pay|payment|partial)(\s|$)/.test(lowered)) return null;
  if (/mark\s+.+\s+paid|mark\s+.+\s+as\s+paid/.test(lowered)) return null;

  const amountMatch = query.match(/(?:₱|\$|php|usd)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch?.[1]) return null;

  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const targetPatterns = [
    /\b(?:on|for|to|toward|towards)\s+(.+)$/i,
    /\b(?:paid|pay|payment(?:\s+of)?|partial payment(?:\s+of)?)\s+(?:₱|\$|php|usd)?\s*[\d,]+(?:\.\d{1,2})?\s+(?:on|for|to|toward|towards)?\s*(.+)$/i,
  ];

  for (const pattern of targetPatterns) {
    const match = query.match(pattern);
    if (match?.[1]) {
      return { target: match[1].trim(), amount };
    }
  }

  if (/\bthis bill\b/i.test(query)) {
    return { target: "", amount };
  }

  return { target: null, amount };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWatchMessages() {
  const {
    bills,
    persona,
    currency,
    country,
    monthlyIncome,
    incomeByMonth,
    payCycle,
    paydayDay,
    paydaySemi,
    paydayWeekday,
    markPaid,
    payPartial,
    updateBillAmount,
    saveBill,
  } =
    useJudith();

  // Keep refs so the stable subscription closure always sees latest values.
  const billsRef = useRef(bills);
  const personaRef = useRef(persona);
  const currencyRef = useRef(currency);
  const countryRef = useRef(country);
  const monthlyIncomeRef = useRef(monthlyIncome);
  const incomeByMonthRef = useRef(incomeByMonth);
  const payCycleRef = useRef(payCycle);
  const paydayDayRef = useRef(paydayDay);
  const paydaySemiRef = useRef(paydaySemi);
  const paydayWeekdayRef = useRef(paydayWeekday);
  const markPaidRef = useRef(markPaid);
  const payPartialRef = useRef(payPartial);
  const updateBillAmountRef = useRef(updateBillAmount);
  const saveBillRef = useRef(saveBill);

  const syncCurrentPayload = () =>
    syncBillsToWatch(
      billsRef.current,
      personaRef.current,
      currencyRef.current,
      true,
      {
        countryName: countryRef.current?.name,
        countryCode: countryRef.current?.code,
        monthlyIncome: monthlyIncomeRef.current,
        incomeByMonth: incomeByMonthRef.current,
        payCycle: payCycleRef.current,
        paydayDay: paydayDayRef.current,
        paydaySemi: paydaySemiRef.current,
        paydayWeekday: paydayWeekdayRef.current,
      },
    ).catch(() => {});

  useEffect(() => { billsRef.current = bills; }, [bills]);
  useEffect(() => { personaRef.current = persona; }, [persona]);
  useEffect(() => { currencyRef.current = currency; }, [currency]);
  useEffect(() => { countryRef.current = country; }, [country]);
  useEffect(() => { monthlyIncomeRef.current = monthlyIncome; }, [monthlyIncome]);
  useEffect(() => { incomeByMonthRef.current = incomeByMonth; }, [incomeByMonth]);
  useEffect(() => { payCycleRef.current = payCycle; }, [payCycle]);
  useEffect(() => { paydayDayRef.current = paydayDay; }, [paydayDay]);
  useEffect(() => { paydaySemiRef.current = paydaySemi; }, [paydaySemi]);
  useEffect(() => { paydayWeekdayRef.current = paydayWeekday; }, [paydayWeekday]);
  useEffect(() => { markPaidRef.current = markPaid; }, [markPaid]);
  useEffect(() => { payPartialRef.current = payPartial; }, [payPartial]);
  useEffect(() => { updateBillAmountRef.current = updateBillAmount; }, [updateBillAmount]);
  useEffect(() => { saveBillRef.current = saveBill; }, [saveBill]);

  useEffect(() => {
    if (!WatchConnectivity) return;

    const events = (
      WatchConnectivity as {
        watchEvents?: {
          on: (
            event: string,
            cb: (...args: unknown[]) => void,
          ) => { remove?: () => void };
        };
      }
    ).watchEvents;

    // Dispatch a single Judith action against the local store. Shared by the
    // /ask multi-action loop and the watch's offline-queue replay path so
    // both sites stay in sync as the action vocabulary grows.
    const applyJudithAction = (a: JudithAction | null | undefined) => {
      if (!a) return;
      if (a.type === "add_bill") {
        const bill = makeBillFromAction(a);
        saveBillRef.current(bill);
      } else if (a.type === "mark_paid") {
        if (a.id) markPaidRef.current(a.id);
      } else if (a.type === "add_payment") {
        if (a.id && a.amount > 0) payPartialRef.current(a.id, a.amount);
      } else if (a.type === "update_amount") {
        if (a.id && a.amount > 0) updateBillAmountRef.current(a.id, a.amount);
      } else if (a.type === "update_bill") {
        const existing = a.id ? billsRef.current.find((b) => b.id === a.id) : undefined;
        if (existing) {
          const updated = {
            ...existing,
            ...(typeof a.cat === "string" && a.cat ? { cat: a.cat } : {}),
            ...(a.kind === "Fixed" || a.kind === "Variable" ? { kind: a.kind } : {}),
            ...(typeof a.reminderDays === "number" ? { reminderDays: a.reminderDays } : {}),
            ...(typeof a.isBusiness === "boolean" ? { isBusiness: a.isBusiness } : {}),
            ...(typeof a.house === "string" && a.house ? { house: a.house } : {}),
            ...(typeof a.chargedToCard === "boolean" ? { chargedToCard: a.chargedToCard } : {}),
          };
          saveBillRef.current(updated);
        }
      }
    };

    // ── Channel 1: sendMessage (phone foregrounded / reachable) ──────────────
    let messageSub: { remove?: () => void } | undefined;
    if (events?.on) {
      messageSub = events.on("message", async (...args: unknown[]) => {
        const message = (args[0] ?? null) as Record<string, unknown> | null;
        const reply = (args[1] ?? null) as ((response: Record<string, unknown>) => void) | null;
        if (!message) return;
        const action = message.action as string | undefined;

        if (action === "refreshWatchPayload") {
          syncCurrentPayload();
          reply?.({ ok: true });
          return;
        }

        if (action === "transcribeAudio") {
          const audioBase64 = (message.audioBase64 as string | undefined) ?? "";
          const mimeType = (message.mimeType as string | undefined) ?? "audio/m4a";
          if (!audioBase64) {
            reply?.({ error: "No audio was received from the watch." });
            return;
          }
          try {
            const result = await transcribe(audioBase64, mimeType, "en");
            reply?.({ text: result.text ?? "" });
          } catch {
            reply?.({ error: "Judith couldn't transcribe that right now." });
          }
          return;
        }

        if (action === "ask") {
          const query = (message.query as string | undefined) ?? "";
          // Watch may include prior Q+A turns so the phone /ask call carries
          // continuation context. Shape matches askJudith's `history` param:
          // [{role: "user" | "assistant", text: string}]. Sanitize here so a
          // malformed message can't blow up the ask.
          const rawHistory = (message.history as unknown[] | undefined) ?? [];
          const watchHistory: Array<{ role: "user" | "assistant"; text: string }> = [];
          for (const turn of rawHistory.slice(-5)) {
            if (
              turn && typeof turn === "object" &&
              (("role" in turn && (turn as { role?: unknown }).role === "user") ||
                ((turn as { role?: unknown }).role === "assistant")) &&
              typeof (turn as { text?: unknown }).text === "string" &&
              ((turn as { text: string }).text).trim()
            ) {
              const t = turn as { role: "user" | "assistant"; text: string };
              watchHistory.push({ role: t.role, text: t.text.trim() });
            }
          }
          try {
            const currentBills = billsRef.current;
            const partialPayment = extractPartialPayment(query);
            if (partialPayment) {
              const matchedBill = resolveBillByTarget(partialPayment.target, currentBills);
              if (matchedBill) {
                const outstanding = getOutstandingAmount(matchedBill);
                const amountPaid = Math.min(partialPayment.amount, outstanding || partialPayment.amount);
                if (amountPaid > 0) {
                  payPartialRef.current(matchedBill.id, amountPaid);
                  const fullyPaid = amountPaid >= outstanding && outstanding > 0;
                  reply?.({
                    answer: fullyPaid
                      ? `${matchedBill.provider} is fully paid.`
                      : `Recorded ${formatMoney(amountPaid, currencyRef.current)} for ${matchedBill.provider}.`,
                  });
                  return;
                }
              }
            }

            const matchedBill = resolveMarkPaidBill(query, currentBills);
            if (matchedBill) {
              markPaidRef.current(matchedBill.id);
              reply?.({
                answer: `${matchedBill.provider} is marked as paid.`,
              });
              return;
            }

            const askBills = buildAskBills(currentBills);
            const result = await askJudith(
              query,
              askBills,
              personaRef.current,
              "en",
              false,
              currencyRef.current,
              countryRef.current?.name,
              monthlyIncomeRef.current,
              countryRef.current?.code,
              incomeByMonthRef.current,
              undefined, // payCycle — not forwarded from watch
              undefined, // paydayDay
              undefined, // paydaySemi
              undefined, // paydayWeekday
              watchHistory.length > 0 ? watchHistory : undefined,
            );
            // Apply every action the model emitted, in order. Users can ask
            // for changes across multiple bills in a single sentence
            // ("mark Netflix and Spotify paid", "log ₱1 on BPI and ₱1 on
            // UnionBank") so we iterate; falling back to result.action only
            // when the server hasn't migrated to the array shape yet.
            const actionsToApply = (result.actions && result.actions.length > 0)
              ? result.actions
              : (result.action ? [result.action] : []);
            for (const a of actionsToApply) {
              applyJudithAction(a);
            }
            reply?.({ answer: result.reply });
          } catch {
            reply?.({ error: "Judith couldn't respond right now." });
          }
        }

        if (action === "markPaid") {
          const billId = message.billId as string | undefined;
          if (billId) markPaidRef.current(billId);
          reply?.({ ok: true });
        }

        if (action === "applyAction") {
          // Replay of a Judith action the watch parsed offline via
          // /watch-ask. Payload is the action JSON serialized verbatim by
          // the server's parseAction.
          const payload = message.payload as string | undefined;
          if (payload) {
            try {
              const parsed = JSON.parse(payload) as JudithAction;
              applyJudithAction(parsed);
            } catch {
              // Malformed queue entry — drop it. Reply ok so the watch
              // doesn't endlessly retry an unparseable payload.
            }
          }
          reply?.({ ok: true });
        }
      });
    }

    // ── Channel 2: transferUserInfo (phone was backgrounded/locked) ──────────
    // Watch sends markPaid via transferUserInfo when sendMessage fails because
    // the phone is not reachable. No reply handler available here.
    let userInfoSub: { remove?: () => void } | undefined;

    if (events?.on) {
      userInfoSub = events.on("user-info", (...args: unknown[]) => {
        const payloads = args[0];
        const items: unknown[] = Array.isArray(payloads) ? payloads : [payloads];
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const p = item as Record<string, unknown>;
          if (p.action === "markPaid" && typeof p.billId === "string") {
            markPaidRef.current(p.billId);
          } else if (p.action === "refreshWatchPayload") {
            syncCurrentPayload();
          } else if (p.action === "applyAction" && typeof p.payload === "string") {
            try {
              const parsed = JSON.parse(p.payload) as JudithAction;
              applyJudithAction(parsed);
            } catch {
              // Drop unparseable queue entry; see channel-1 handler above.
            }
          }
        }
      });
    }

    return () => {
      messageSub?.remove?.();
      userInfoSub?.remove?.();
    };
  }, []); // subscribe once — reads latest values via refs
}
