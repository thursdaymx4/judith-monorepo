---
name: Judith cross-screen total reconciliation
description: The invariant that keeps Home, Calendar, and Ask AI money totals agreeing; they share no selector and drift easily.
---

Home, Calendar, and the Ask server each re-implement money totals independently — there is
NO shared selector. They must reconcile into exactly TWO buckets, and any change to one
surface's window or paid rule must be mirrored in all three or they drift:

1. **"due this calendar month"** — Home headline + bill count, Calendar "Due in <month>",
   Ask current-month monthly line. Must use the CURRENT-month window only (Home's
   `timelineBills`, not `due`/all-unpaid). Using all-unpaid re-includes annual bills whose
   occurrence is a later month and over-states this number.
2. **"total unpaid, all months"** — Home gauge, Ask "Total still due".

Both buckets exclude via-card charges (only when the parent card resolves; dangling links
still count) and use REMAINING balance, never the full statement.

**Why:** paid detection must come from `paymentHistory` (period match, `paid >= totalDue`),
NOT `b.status` — status advances to the next cycle after a payment, so a bill paid this
month otherwise looks unpaid and gets re-counted at full amount. That single mistake made
Ask report unpaid ≈ (real unpaid + already-paid-this-month).

**How to apply:** The Ask reconciliation lives entirely in the CLIENT `askBills()` payload
(it sends remaining-as-amount and a corrected paid status); the server's existing
context-builder math then yields both buckets with no server change. Prefer adding a real
shared helper over copying the filter/sum into a fourth place.
