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

**Future-month projection = carried remainder + recurring re-bills.** A card's
future-month amount is `ccProjectedFuture = ccOutstanding(card) +
ccLinkedRecurringForMonth(...)`. Recurring charges linked to the card (monthly
every month; annual only in its `today + dueDays` occurrence month) re-bill onto
the future statement, so a fully-paid card with a monthly ₱2,500 linked charge
projects ₱2,500 next month, not 0. No double-count: the current statement
already contains this month's linked charge; the future projection adds the NEXT
occurrence. Used by calendar `viewedAmt` and bill-detail `viewedOwed` (both pass
the full bills array + viewed year/month). Annual occurrence detection must
mirror calendar's existing `billsForMonth` logic.

**Two-way link with card-linked charges:** a non-card charge auto-billed to a
tracked card (`isPaidViaCard`: chargedToCard + parentCardId) mirrors onto that
card when toggled paid/unpaid — card `amountPaid` ±= the charge amount (clamped
0..totalOwed), in lockstep with the card's paid record for that period. This
moves the amount from "excluded charge" to "reduced card", so total owed stays
consistent (the charge cost was always inside the card statement).
**Critical guard:** only mirror when the charge's toggled period equals the
card's CURRENT natural period — the card balance is a single scalar, so toggling
a past/future linked charge must NOT move today's card outstanding. Cards never
cascade onto other cards.

**Unlinking deducts the charge from the card statement.** `JudithStore.saveBill`
detects an unlink (old bill was `isPaidViaCard` with a `parentCardId`; new bill is
no longer linked to that SAME card — covers toggling the link off OR moving to a
different card) and deducts `old.amount` from the former parent card:
`amount = max(0, card.amount − old.amount)`, then clamps `amountPaid ≤ new
amount+carryOver`. The now-standalone bill starts counting toward totals on its
own. **Why:** card.amount is treated as INCLUDING its linked charges (insights
`net = card.amount − linkedByCard`; linked bills excluded from totals), so without
the deduction unlinking double-counts (card still includes it + the standalone
bill now counts). Net grand total is unchanged — the money moves from inside-card
to standalone (user confirmed this is the desired behavior, NOT deleting the
bill). Asymmetry note: linking a bill does NOT add to card.amount (pre-existing,
left as-is per scope), so a link→unlink cycle on a card whose statement never
included the charge will under-count that card — acceptable per current request.
`deleteBill` clears child `parentCardId` directly (card gone), so no
double-deduct.

**Known limitation (intentionally out of scope):** `computeNaturalPeriod` still
advances a fully-paid CC to next month once the due date passes, so the
bill-detail *current* period can momentarily show the new (empty) cycle at full
amount. The future-month projection is correct; the natural-period engine
rewrite is the separate "clean per-month model" follow-up.
