---
name: Judith credit-card revolving balance
description: Why/how credit cards are modeled as a revolving balance (not a recurring charge) so payments reduce future months.
---

Credit cards (`bill.cat === "Credit card"`) are a REVOLVING balance, not a
recurring charge like a utility. The displayed balance for the current statement
AND every future month (until the next statement is entered) is
`ccOutstanding(b) = max(0, totalOwed(b) - amountPaid)`:
- paid in full → 0 (stays settled)
- partial → unpaid remainder carries forward
- untouched → full statement, shown as an estimate ("· est.")

**Why:** a utility re-bills the full amount each month, but a paid-off card owes
nothing next month until the bank issues a new statement. Showing the full
`b.amount` for future months double-counted what the user already paid.

**How to apply:**
- `togglePaid` has a CC-specific branch that KEEPS `amountPaid = owed` when paid
  (non-CC bills reset amountPaid and let the natural period advance to a fresh
  full cycle). Do not "simplify" this back to the shared path or future months
  will re-show the full statement after the due date passes.
- Future-month display lives in `calendar.tsx` `viewedAmt` and `bill/[id].tsx`
  `viewedOwed`; both must call `ccOutstanding` for CC. A settled future CC hides
  pay-ahead/partial actions and shows a "Statement settled" note.
- The user resets the cycle via `updateBillAmount` (sets new `amount`, clears
  `amountPaid`/`carryOver`).

**Known limitation (intentionally out of scope):** `computeNaturalPeriod` still
advances a fully-paid CC to next month once the due date passes, so the
bill-detail *current* period can momentarily show the new (empty) cycle at full
amount. The future-month projection is correct; the natural-period engine
rewrite is the separate "clean per-month model" follow-up.
