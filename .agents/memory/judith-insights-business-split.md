---
name: Judith Insights business split
description: How the Insights "Personal vs Business" and "BY BUSINESS" sections are scoped and must reconcile.
---

# Insights Personal-vs-Business and BY-BUSINESS

Both the "Personal vs Business" pie and the per-business "BY BUSINESS" breakdown
are computed from the SAME `tagSplit` useMemo in `app/(tabs)/insights.tsx`. The
per-business map (`bizMap`) is just the business side of `tagSplit` partitioned by
`businessName` (empty name → "Other business").

## Scope invariant — keep the two business views identical, not tied to the grand total

`tagSplit` (non-historical path) sums over ALL bills, NOT the current-month
`_curMonthBills` window that the "Total bill this month" / "Where it goes" figures
use. So the Business total here matches the Home screen's business total, NOT the
Insights grand total.

**Why:** the two business views must reconcile with each other — BY BUSINESS slices
must sum to the "Business" figure shown directly above them. Re-scoping only one of
them (e.g. to current-month) makes the two business sections disagree, which is a
worse inconsistency than the long-standing gap vs the tab's grand total. If you
ever re-scope, re-scope `tagSplit` as a whole so both stay in lockstep.

**How to apply:** percentages in BY BUSINESS use `value / tagSplit.business`
(share of business spend), not the grand total. Gate the section on
`businesses.length > 1 && business > 0`.

## Per-business color stability

Assign each business its `BIZ_PALETTE` color by ALPHABETICAL name index, never by
value rank. Display order is still by value (largest first), but color is keyed to
name so a business keeps its color when its rank shifts across periods/filters —
otherwise two businesses swap colors and the comparison becomes misleading.
