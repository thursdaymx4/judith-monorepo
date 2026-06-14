import type { Bill } from "@/constants/data";
import {
  classifyAskIntent as classifyNativeAskIntent,
  classifyBillCategory as classifyNativeBillCategory,
  financeKitStatus as nativeFinanceKitStatus,
  findRecentBillPaymentMatches as nativeFindRecentBillPaymentMatches,
  foundationModelStatus as nativeFoundationModelStatus,
  requestFinanceKitAuthorization as nativeRequestFinanceKitAuthorization,
  type AskIntentResult,
  type BillCategoryResult,
  type FinanceBillPaymentMatchesResult,
  type FinanceKitStatus,
  type FoundationModelStatus,
} from "judith-widget-bridge";

export type {
  AskIntentResult,
  BillCategoryResult,
  FinanceBillPaymentMatchesResult,
  FinanceKitStatus,
  FoundationModelStatus,
};

export async function getFoundationModelStatus(): Promise<FoundationModelStatus> {
  return nativeFoundationModelStatus();
}

export async function getFinanceKitStatus(): Promise<FinanceKitStatus> {
  return nativeFinanceKitStatus();
}

export async function requestFinanceKitAuthorization(): Promise<FinanceKitStatus> {
  return nativeRequestFinanceKitAuthorization();
}

export async function findRecentBillPaymentMatches(
  bills: Bill[],
  currency: string,
  lookbackDays = 45,
): Promise<FinanceBillPaymentMatchesResult> {
  return nativeFindRecentBillPaymentMatches(
    bills.map((bill) => ({
      id: bill.id,
      provider: bill.provider,
      amount: bill.amount,
    })),
    currency,
    lookbackDays,
  );
}

export async function suggestBillCategory(
  provider: string,
  categories: string[],
): Promise<BillCategoryResult> {
  return classifyNativeBillCategory(provider, categories);
}

export async function classifyAskIntent(
  prompt: string,
  bills: Bill[],
  currency: string,
): Promise<AskIntentResult> {
  return classifyNativeAskIntent(
    prompt,
    bills.map((bill) => ({
      provider: bill.provider,
      amount: bill.amount,
      dueDays: bill.dueDays,
      dueLabel: bill.dueLabel,
      status: bill.status,
      cat: bill.cat,
    })),
    currency,
  );
}
