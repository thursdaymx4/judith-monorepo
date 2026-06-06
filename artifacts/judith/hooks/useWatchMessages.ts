/**
 * Handles messages sent FROM the Apple Watch TO the phone.
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

    const addMessageListener = WatchConnectivity.addMessageListener as
      | ((
          cb: (
            message: Record<string, unknown>,
            reply: (response: Record<string, unknown>) => void,
          ) => void,
        ) => { remove?: () => void })
      | undefined;

    if (!addMessageListener) return;

    const subscription = addMessageListener(async (message, reply) => {
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
        if (billId) {
          markPaidRef.current(billId);
        }
        reply({ ok: true });
      }
    });

    return () => {
      subscription?.remove?.();
    };
  }, []); // subscribe once — reads latest values via refs
}
