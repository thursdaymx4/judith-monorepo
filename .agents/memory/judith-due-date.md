---
name: Judith due-date logic
description: How billing period is computed from dueDay vs stale dueDays; per-month payment model; auto-reset removal.
---

# Judith due-date computation

## Clean per-month payment model (current)
`paymentHistory: BillCycleRecord[]` (keyed by `YYYY-MM`) is the **only** source of truth for paid status. `bill.status` is a convenience mirror updated by `togglePaid` — never the primary truth. No auto-reset. Each month is independent: past, current, or future months can all be marked paid at any time.

## Period computation — always use `dueDate` (day-of-month), never `dueDays`
`bill.dueDays` is stale (computed once at creation). `bill.dueDate` is the permanent day-of-month (1–31) stored on every bill.

**Correct formula** (`computeNaturalPeriod`):
1. If `today.getDate() < dueDay` → due later this month → period = **this month**
2. If `today.getDate() >= dueDay` → due date has passed:
   - If this month is already paid (in paymentHistory) → period = **next month**
   - Otherwise → period = **this month** (overdue)

Implemented identically in:
- `JudithStore.tsx` as `computeNaturalPeriod()` (store-side, `togglePaid` + `payPartial`)
- `app/bill/[id].tsx` as `computeNaturalPeriodUI()` (UI display)

**Why:** `dueDays` goes stale as soon as the day increments. `dueDate` is permanent.

## `onTime` field in BillCycleRecord
Computed from the period's specific due date vs today — not from `dueDays`:
```typescript
const dueDateForPeriod = new Date(pYr, pMo - 1, Math.min(b.dueDate, daysInMonth(...)));
onTime: today <= dueDateForPeriod
```
Pre-paid future months → `onTime = true` → shows "Paid ahead" badge in CycleRow.

## Clamp rule (unchanged)
Clamp `dueDay` to actual days in the target month: `Math.min(dueDay, new Date(year, month+1, 0).getDate())`. Never clamp to 28.

## Server-side period
`artifacts/api-server/src/routes/judith.ts` → `nextDueDate()` — keep in lockstep with client formula above.

## `dueDays` remaining uses
Still written at bill creation (`makeBillFromAction`, `makeManualBill`, `makeSubscriptionBill`) and used by `snooze` + the bill list display ("in 3d", "overdue"). These are the last remaining users of the stale `dueDays` field — candidates for future migration to live `dueDate` computation.

## Scanned-subscription due dates
`constants/data.ts` → `resolveNextDue()`/`makeSubscriptionBill()`. Honor `frequency` in every branch. A precise `nextDue` ISO date takes precedence over `dueDay`. If the user toggles monthly/annual, MUST clear `nextDue` (set null) or stale exact date overrides corrected cadence.
