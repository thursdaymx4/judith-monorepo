---
name: Judith overdue enforcement
description: How to reliably stop Judith from celebrating or giving relief framing when overdue bills exist; confirmed working approach and correct response pattern.
---

## The rule that kept failing (and why)

A system-prompt rule alone saying "don't celebrate when overdue" is NOT enough. The AI finds loopholes — it will say "Ligtas ka this week!" or "Pahinga muna, besh!" while technically noting that due dates have "already passed". Framing past-due bills as passed/safe is the core loophole.

## What actually works: two layers

### Layer 1 — Context injection (judith.ts `buildClientContext`)
When any bills have `dueDays < 0`, inject a hard `⚠️ OVERDUE ALERT` block as the **very first line** of the context string, before today's date, before income, before the bill list:

```
⚠️ OVERDUE ALERT (read this FIRST, every time): N bill(s) are OVERDUE — ₱X total unpaid past due.
You MUST address this before answering anything else.
No relief, safety, or positive framing is allowed while overdue bills exist.
Forbidden phrases include: "Ligtas ka", "Wala naman", "Clear ka", "Pahinga muna",
"nothing to worry about", "you're good", "haha", "hehe", or any equivalent in any language.
```

### Layer 2 — Rule in SHARED_RULES (personas.ts)
Anchor the OVERDUE BILLS rule on the `⚠️ OVERDUE ALERT` marker, enumerate all forbidden phrases explicitly, and include the clause:
> "The due dates have passed" is NOT a safe framing — past-due = overdue = alarm, never relief.

## Confirmed correct response pattern (user-approved)

User asked "What's due this week?" with 4 overdue bills (₱13,000 total):

> "Wala na, besh! Lahat ng bills mo this week — paid na o overdue na. Walang bagong due within 7 days. Pero 'yung ₱13,000 overdue bills mo? 'Yun pa rin dapat bayaran, ha!"

Key: answers the question factually, then pivots to overdue with urgency. Order (question-first vs overdue-first) is less important than:
- No celebration / relief language
- Overdue amount and urgency clearly stated in the same reply
- "ha!" as reminder marker — not "haha!" as laughter

## What NOT to do
- Soft rule only in system prompt (no context injection) — AI ignores or finds loopholes
- Vague "no celebration" instruction without naming specific forbidden phrases
- Treating "nakalampas na" (already passed) as neutral — it's not, it's overdue
