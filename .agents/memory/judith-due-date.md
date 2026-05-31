---
name: Judith due-date computation
description: The monthly recurring due-date logic exists in two places and must stay consistent.
---

# Judith due-date computation

The "next due date" for a monthly bill is computed in **two** separate places that
must stay identical in behavior:

- Server: `artifacts/api-server/src/routes/judith.ts` → `nextDueDate()` (feeds the
  AI bill context: totals, "next bill" answers).
- Client: `artifacts/judith/lib/bills.ts` → `computeNextDue()` (drives urgency UI
  and reminder fire dates in `lib/notifications.ts`).

**Rule:** clamp a bill's `due_day` to the actual number of days in the target
month (`new Date(year, month + 1, 0).getDate()`), NOT to a flat 28.

**Why:** an earlier version used `Math.min(due_day, 28)`, which forced every bill
with due_day 29–31 to land on the 28th of every month — corrupting both the AI's
spoken/written answers and notification fire times. Accuracy is an absolute
product requirement for Judith, so a silently-wrong date is a serious bug.

**How to apply:** if you change the recurrence math in one file, change the other
in the same edit. Snooze handling lives only on the reminder side
(`syncReminders`): a `snoozed` bill must not fire reminders before its
`snoozed_until` date.
