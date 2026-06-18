/**
 * Shared askBills payload builder — used by BOTH the phone /ask screen
 * (app/ask.tsx) AND the watch /ask path (hooks/useWatchMessages.ts) so they
 * never produce different numbers for the same user.
 *
 * This is a verbatim lift of the phone's askBills() from app/ask.tsx.
 * Lifted on 2026-06-14 after a divergent watch implementation produced
 * inflated unpaid totals on the watch ($1,246 vs phone's $1,168).
 */
import { ccProjectedFuture, currentCycleDue, getFundingSource, totalOwed, type Bill } from "@/constants/data";
import type { AskBill } from "@/lib/proxy";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function buildAskBills(bills: Bill[], today: Date = new Date()): AskBill[] {
  const periodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Current-cycle entries — overdue-aware, mirrors home screen.
  const current: AskBill[] = bills.map((b) => {
    const { dueDays, dueLabel } = currentCycleDue(b, today);
    const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dueDays);
    const dueMonth = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
    const cardName = b.chargedToCard && b.parentCardId
      ? (bills.find((c) => c.id === b.parentCardId)?.provider ?? null)
      : null;
    const rec = (b.paymentHistory ?? []).find((r) => r.period === periodKey);
    const paidThisPeriod = rec ? rec.paid : (b.amountPaid ?? 0);
    const hasSettledHistory = (b.paymentHistory ?? []).some(
      (r) => r.period === periodKey && r.paid >= r.totalDue,
    );
    const isPaidThisPeriod =
      hasSettledHistory ||
      (b.status === "paid" && paidThisPeriod >= totalOwed(b));
    const isResolvedViaCard = !!cardName;
    // Keep the REAL amount so per-bill queries ("How much is Netflix?") can
    // answer correctly. Whether this contributes to totals is decided by the
    // server prompt's interpretation of chargedToCard + cardName + status.
    const amount = isResolvedViaCard
      ? totalOwed(b)
      : Math.max(0, totalOwed(b) - paidThisPeriod);
    const showPartial = !isResolvedViaCard && !isPaidThisPeriod && paidThisPeriod > 0;
    // Also expose the paid amount for FULLY paid bills so the server can
    // compute "how much have I paid this month?" totals. Without this the
    // server only sees amount=0 for paid bills and can't sum them.
    const showFullyPaid = isPaidThisPeriod;
    // Status precedence:
    //   1. fully paid this period → "paid"
    //   2. via-card subscription → "via-card" (so Claude DOES NOT count it as
    //      direct overdue; the cost flows through the parent CC bill which is
    //      listed separately with its own status)
    //   3. otherwise → the bill's own status (overdue / urgent / near / ok)
    const status = isPaidThisPeriod
      ? "paid"
      : isResolvedViaCard
        ? "via-card"
        : b.status;
    // For variable bills with 2+ settled cycles, ship the last 6 actual
    // paid amounts so the server's BILL CONTEXT can show Claude a real
    // range ("Usually $X-$Y, last paid $Z") instead of treating the
    // static `amount` as the truth. Fixed bills don't need this (the
    // amount doesn't change cycle-to-cycle).
    const recentPaidAmounts = b.kind === "Variable"
      ? (b.paymentHistory ?? [])
          .slice(0, 6)
          .map((r) => r.paid)
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const fundingSource = getFundingSource(b);
    return {
      id: b.id,
      provider: b.provider,
      cat: b.cat,
      amount,
      dueDays,
      dueLabel,
      status,
      dueMonth,
      isBusiness: b.isBusiness,
      businessName: b.businessName,
      chargedToCard: b.chargedToCard,
      cardName,
      fundingSource,
      fundingSourceName: b.fundingSourceName ?? null,
      ...(showPartial ? { paidThisPeriod, originalTotal: totalOwed(b) } : {}),
      ...(showFullyPaid ? { paidThisPeriod, originalTotal: totalOwed(b) } : {}),
      ...(recentPaidAmounts.length >= 2 ? { recentPaidAmounts } : {}),
    };
  });

  // Next-month projections — non-CC, non-annual.
  const nxYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
  const nxMonth = (today.getMonth() + 1) % 12;
  const nxKey = `${nxYear}-${String(nxMonth + 1).padStart(2, "0")}`;
  const nxDaysInMonth = new Date(nxYear, nxMonth + 1, 0).getDate();

  const projections: AskBill[] = bills
    .filter((b) => {
      // Skip non-monthly cadences for next-month projections:
      //   - "annual" bills don't recur next month
      //   - "once" bills don't recur at all
      if (b.frequency === "annual" || b.frequency === "once") return false;
      if (b.cat === "Credit card") return false;
      const { dueDays } = currentCycleDue(b, today);
      const dd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dueDays);
      return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}` !== nxKey;
    })
    .map((b) => {
      const dayInMonth = Math.min(b.dueDate, nxDaysInMonth);
      const nxDue = new Date(nxYear, nxMonth, dayInMonth);
      const dueDays = Math.round((nxDue.getTime() - today.getTime()) / 86_400_000);
      const dueLabel = nxYear === today.getFullYear()
        ? `${MONTH_NAMES[nxMonth]} ${dayInMonth}`
        : `${MONTH_NAMES[nxMonth]} ${dayInMonth}, ${nxYear}`;
      const isPaidCurrent = (b.paymentHistory ?? []).some(
        (r) => r.period === periodKey && r.paid >= r.totalDue,
      ) || (b.status === "paid" && (b.amountPaid ?? 0) >= totalOwed(b));
      const hasPartial = (b.amountPaid ?? 0) > 0;
      const effectiveCarry = hasPartial
        ? Math.max(0, totalOwed(b) - (b.amountPaid ?? 0))
        : (b.carryOver ?? 0);
      const amount = isPaidCurrent ? b.amount : b.amount + effectiveCarry;
      const cardName = b.chargedToCard && b.parentCardId
        ? (bills.find((c) => c.id === b.parentCardId)?.provider ?? null)
        : null;
      const fundingSource = getFundingSource(b);
      return {
        id: b.id,
        provider: b.provider,
        cat: b.cat,
        amount,
        dueDays,
        dueLabel,
        status: "upcoming",
        dueMonth: nxKey,
        isBusiness: b.isBusiness,
        businessName: b.businessName,
        chargedToCard: b.chargedToCard,
        cardName,
        fundingSource,
        fundingSourceName: b.fundingSourceName ?? null,
        isProjection: true,
      };
    });

  // Credit-card next-month projections.
  const ccProjections: AskBill[] = bills
    .filter((b) => b.cat === "Credit card")
    .map((b) => {
      const dayInMonth = Math.min(b.dueDate, nxDaysInMonth);
      const nxDue = new Date(nxYear, nxMonth, dayInMonth);
      const dueDays = Math.round((nxDue.getTime() - today.getTime()) / 86_400_000);
      const dueLabel = nxYear === today.getFullYear()
        ? `${MONTH_NAMES[nxMonth]} ${dayInMonth}`
        : `${MONTH_NAMES[nxMonth]} ${dayInMonth}, ${nxYear}`;
      return {
        provider: b.provider,
        cat: b.cat,
        amount: ccProjectedFuture(b, bills, nxYear, nxMonth, today),
        dueDays,
        dueLabel,
        status: "upcoming" as const,
        dueMonth: nxKey,
        isBusiness: b.isBusiness,
        chargedToCard: false,
        cardName: null,
        isProjection: true,
      };
    });

  return [...current, ...projections, ...ccProjections];
}
