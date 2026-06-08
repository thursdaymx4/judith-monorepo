import { totalOwed, type Bill } from "@/constants/data";

export function currentPeriodKey(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function isPaidThisMonth(bill: Bill, today: Date = new Date()): boolean {
  const period = currentPeriodKey(today);
  if ((bill.paymentHistory ?? []).some((record) => record.period === period && record.paid >= record.totalDue)) {
    return true;
  }
  return bill.status === "paid" && (bill.amountPaid ?? 0) >= totalOwed(bill);
}

export function amountPaidThisMonth(bill: Bill, today: Date = new Date()): number {
  const period = currentPeriodKey(today);
  const record = (bill.paymentHistory ?? []).find((item) => item.period === period);
  if (record && record.paid >= record.totalDue) return record.paid;
  return bill.amountPaid ?? 0;
}

export function remainingThisMonth(bill: Bill, today: Date = new Date()): number {
  return Math.max(0, totalOwed(bill) - amountPaidThisMonth(bill, today));
}
