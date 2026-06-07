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
 *   {action: "ask",      query: string}   → calls /ask API, replies {answer}
 *   {action: "markPaid", billId: string}  → marks bill paid in local store
 *
 * Safe to mount unconditionally — no-ops when WatchConnectivity is absent
 * (Expo Go, Android, no paired watch).
 */
import { useEffect, useRef } from "react";
import { useJudith } from "@/contexts/JudithStore";
import { askJudith, type AskBill } from "@/lib/proxy";
import { currentCycleDue, isPaidViaCard, type Bill } from "@/constants/data";
import { WatchConnectivity } from "@/lib/watch";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function billToAskBill(b: Bill, allBills: Bill[]): AskBill {
  const { dueDays, dueLabel } = currentCycleDue(b);
  const today = new Date();
  const dueDay = b.dueDate ?? 1;
  const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (dueDate < today) dueDate.setMonth(dueDate.getMonth() + 1);
  const dueMonth = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;

  const parentCard = b.parentCardId ? allBills.find((x) => x.id === b.parentCardId) : null;
  return {
    provider: b.provider,
    cat: b.cat,
    amount: b.amount,
    dueDays,
    dueLabel,
    dueMonth,
    status: b.status,
    isBusiness: b.isBusiness,
    chargedToCard: b.chargedToCard,
    cardName: parentCard?.provider ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWatchMessages() {
  const { bills, persona, currency, country, monthlyIncome, incomeByMonth, markPaid } =
    useJudith();

  // Keep refs so the stable subscription closure always sees latest values.
  const billsRef = useRef(bills);
  const personaRef = useRef(persona);
  const currencyRef = useRef(currency);
  const countryRef = useRef(country);
  const monthlyIncomeRef = useRef(monthlyIncome);
  const incomeByMonthRef = useRef(incomeByMonth);
  const markPaidRef = useRef(markPaid);

  useEffect(() => { billsRef.current = bills; }, [bills]);
  useEffect(() => { personaRef.current = persona; }, [persona]);
  useEffect(() => { currencyRef.current = currency; }, [currency]);
  useEffect(() => { countryRef.current = country; }, [country]);
  useEffect(() => { monthlyIncomeRef.current = monthlyIncome; }, [monthlyIncome]);
  useEffect(() => { incomeByMonthRef.current = incomeByMonth; }, [incomeByMonth]);
  useEffect(() => { markPaidRef.current = markPaid; }, [markPaid]);

  useEffect(() => {
    if (!WatchConnectivity) return;

    // ── Channel 1: sendMessage (phone foregrounded / reachable) ──────────────
    const addMessageListener = WatchConnectivity.addMessageListener as
      | ((
          cb: (
            message: Record<string, unknown>,
            reply: (response: Record<string, unknown>) => void,
          ) => void,
        ) => { remove?: () => void })
      | undefined;

    let messageSub: { remove?: () => void } | undefined;

    if (addMessageListener) {
      messageSub = addMessageListener(async (message, reply) => {
        const action = message.action as string | undefined;

        if (action === "ask") {
          const query = (message.query as string | undefined) ?? "";
          try {
            const currentBills = billsRef.current;
            const askBills = currentBills.map((b) => billToAskBill(b, currentBills));
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
            );
            reply({ answer: result.reply });
          } catch {
            reply({ error: "Judith couldn't respond right now." });
          }
        }

        if (action === "markPaid") {
          const billId = message.billId as string | undefined;
          if (billId) markPaidRef.current(billId);
          reply({ ok: true });
        }
      });
    }

    // ── Channel 2: transferUserInfo (phone was backgrounded/locked) ──────────
    // Watch sends markPaid via transferUserInfo when sendMessage fails because
    // the phone is not reachable. No reply handler available here.
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
