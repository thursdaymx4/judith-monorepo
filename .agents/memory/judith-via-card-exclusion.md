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
- Insights "Where it goes" (donut + Top Providers) uses an ATTRIBUTE + NET model,
  NOT plain exclusion: a via-card merchant bill is attributed to its OWN category/
  provider (e.g. Meralco → Electricity), and each card (cat "Credit card")
  contributes only its un-itemized remainder = max(0, statement − Σ tracked charges
  linked to it). Grand total of the netted slices equals the billed total in the
  normal case (statement ≥ linked), so no double-count. **Why:** users wanted to
  see where money actually goes instead of everything tucked under "Credit card".
- Headline `billedTotal`/`paidTotal`/paid% stay on the card-statement model
  (via-card excluded) — unchanged. The donut `total` and ALL percentages use
  `catTotal` (Σ netted slices), so the donut stays self-consistent even when
  tracked charges exceed a statement (remainder clamped ≥ 0).
- "Biggest bill" KPI = largest SINGLE bill amount (via-card excluded; per-period
  record in historical mode), tracked directly — do NOT derive it from a provider
  aggregate or it overstates when one provider has multiple bills.
- Home timeline, calendar rows, and lists still EXCLUDE via-card bills from money
  sums (the rule above); only the Insights breakdown attributes + nets.

## Notifications + mark-paid are INCLUSIVE (asymmetry with sums)

Via-card bills are excluded from money SUMS but deliberately INCLUDED in:
- **Push notifications** — they still get reminder + nudge scheduled, but the copy
  carries a clue (💳 + the parent card's provider name, "auto-charged to {card}")
  so the heads-up reads as informational, not "pay this by hand". Card name is
  resolved in `syncNotifications` (lib/notifications.ts) from `parentCardId`;
  falls back to generic copy if the card was deleted.
- **Mark-paid prompt** — marking a "Credit card" bill fully paid in bill detail
  offers (Alert) to also mark its still-unpaid linked charges paid for the SAME
  period, so the user clears the statement + its charges in one tap.

**Why:** suppressing notifications for via-card bills would hide useful heads-ups;
users still want to know a charge is about to hit their card. Do NOT "fix" sums by
also silencing notifications — that asymmetry is intentional.

**How to apply:** bulk mark-paid uses `togglePaid` (a TOGGLE), so guard each child
with an "already paid for this period?" check before toggling to stay idempotent.

## AI assistant ("Ask") context also excludes via-card from sums

The Ask flow's server context builder (api-server `buildClientContext` in
routes/judith.ts — note the sibling `buildBillsContext` is DEAD/unused) must
apply the same sum-exclusion rule, or Judith double-counts when answering
"what's due / what's my total". A charge counts as via-card on the server when
`chargedToCard && cardName` (the client resolves `cardName` only when the parent
card exists, so a dangling link keeps counting — matches `isPaidViaCard`). All
money sums (total due, due-this-week, monthly totals, business totals) use the
`payable` (non-via-card) subset; via-card bills stay in the BILLS list tagged
`[AUTO-CHARGED to X]` plus an explicit IMPORTANT note telling the model not to
add their amounts on top of the totals.

**Why:** the client already SENT card fields and the server tagged them, but the
totals still summed everything → Judith over-reported. Context = Judith's
per-request memory; the math must net cards out AND the prose must explain it.

## A PAID via-card bill must report status="paid" or it keeps counting

The server's category totals (`catMap`) filter on `status !== "paid"`. The client
(`ask.tsx` `current` builder) must therefore mark a bill paid for the period the
SAME way Home does — Home excludes any bill where `isPaidThisMonth(b)` is true from
its category totals. The client's `isPaidThisPeriod` (paymentHistory `r.period ===
periodKey && r.paid >= r.totalDue`) is byte-for-byte the same predicate.

**Rule:** compute `status: isPaidThisPeriod ? "paid" : b.status` for ALL bills,
including via-card ones. Do NOT special-case via-card to keep raw `b.status`.

**Why:** an earlier version did `isResolvedViaCard ? b.status : (isPaidThisPeriod
? "paid" : b.status)`. A paid via-card subscription (e.g. an already-settled
overdue sub) kept `status="due"`, so the server still counted it in its category
total while Home excluded it → Ask over-reported that category by the paid amount.

**How to apply:** when reconciling Ask vs Home category totals, the divergence is
usually a paid via-card bill leaking through. The AMOUNT for resolved via-card
bills is still full `totalOwed` (payment flows through the card) — only the
paid-status gate changed. This does NOT touch overdue/due-this-week/business
totals: those use the `payable` (non-via-card) subset, so via-card status flips
are invisible there.
