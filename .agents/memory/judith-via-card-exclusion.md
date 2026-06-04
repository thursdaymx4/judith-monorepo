---
name: Judith via-card double-count rule
description: How charged-to-card bills must be treated in every money sum to avoid double-counting their cost.
---

# Via-card bills must never be summed alongside their card statement

A bill flagged `chargedToCard` is auto-charged to a linked credit card the user
ALSO tracks as its own bill. The card's statement total already represents that
money, so summing both the merchant bill AND the card double-counts.

**Rule:** a charge is counted ONCE — either as the merchant bill OR as part of
the card statement, never both. Concretely, `isPaidViaCard(b)` bills are EXCLUDED
from every money sum (home due/week/overdue/paid-progress, calendar day/month/
week/agenda totals, insights spend by category & provider) but stay VISIBLE in
lists/timeline, tagged "via card" with a muted amount.

**Why:** users link recurring charges (Netflix, etc.) to a card. Counting the
linked bill plus the card statement inflated "total due". The card is the single
payable; the statement-day nudge keeps its amount current so the total stays
accurate.

**How to apply:**
- Centralize the rule in `isPaidViaCard` (constants/data.ts). It requires BOTH
  `chargedToCard` AND `parentCardId` — if "via card" was set but no card chosen
  (or the linked card was deleted), there is no statement covering the charge, so
  it must keep counting rather than silently vanishing from totals.
- `deleteBill` (JudithStore) clears `chargedToCard`/`parentCardId` on children of
  a deleted card so dangling links don't suppress real money.
- Exclude from SUMS only, never from the visible list — keep linked bills shown so
  users see what makes up the card balance.
- Calendar heat dot: derive urgency colour + bubble size from payable bills only;
  via-card-only days get a small neutral dot (no false urgency), still tappable.
- Insights uses the inverse-but-consistent framing: skip via-card bills in the
  category/provider loops; the card statement (cat "Credit card") still counts.
