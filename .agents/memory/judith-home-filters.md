---
name: Judith Home screen filters
description: How the Home timeline filters (category / BIZ / per-business / overdue) compose and auto-heal.
---

# Judith Home screen filter composition

The Home timeline (`app/(tabs)/index.tsx`) has several independent filter states:
`filterCats` (Set of categories), `showBizOnly` (business toggle), `filterBiz`
(selected business name | null), and `overdueOnly`. They compose in this order:
timeline → business scope (showBizOnly + filterBiz) → category subset → overdue.

## Stale-selection auto-heal — derive, don't useEffect

When a selectable value can disappear because the underlying data changed (e.g. a
chosen business's bills all get paid this month, so its chip is no longer
rendered), do NOT leave the raw selection applied and do NOT reach for a
`useEffect` to reset it. Instead derive an **effective** value during render and
apply that:

`const effectiveBiz = filterBiz && timelineBizNames.includes(filterBiz) ? filterBiz : null;`

Use `effectiveBiz` for filtering, the section label, and chip highlight; keep the
raw `filterBiz` only as the stored intent.

**Why:** if you apply the raw selection after its chip vanishes, the user sees an
empty list with no visible control to clear it. Deriving during render
self-corrects every frame without an effect-induced extra render or flicker.

**How to apply:** any new "pick one of N dynamic options" Home filter should follow
the same derive-effective pattern. Per-business UI (sub-filter chips + the row
identifier that swaps the generic "BIZ" badge for the business name) is gated on
having 2+ distinct named businesses — chips on `timelineBizNames.length > 1`
(current month), the row identifier on `hasMultipleBiz` (across all bills).
