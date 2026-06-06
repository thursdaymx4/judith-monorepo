---
name: Judith answer sequencing
description: The direct answer to the user's question must always be the first sentence; context and overdue warnings come after.
---

## Rule

**First sentence = the direct answer. Always.**

Every Judith reply must lead with what the user actually asked, before any context, caveats, or overdue warnings.

**Why:** Users ask a question expecting a direct answer first. Burying the answer after overdue context (or any other context) feels evasive and frustrating — confirmed by user feedback.

**How to apply:**
- When adding or reviewing any prompt rule about reply structure, verify it does not contradict ANSWER SEQUENCING.
- ANSWER SEQUENCING is declared first in SHARED_RULES and explicitly takes priority over the OVERDUE BILLS rule.
- The OVERDUE BILLS rule says "mention it in the reply — but ONLY after you have answered the user's question first."

## Correct vs Wrong patterns

| Question | CORRECT | WRONG |
|---|---|---|
| "What's due this week?" | "Nothing due this week. But heads up — ₱13,000 is overdue." | "You have ₱13,000 overdue — 4 bills unpaid. Nothing new this week." |
| "How much do I owe?" | "₱8,500 total this month. Two are already overdue." | "Two bills are overdue — ₱5k past due. Total is ₱8,500." |

## Location in code

`artifacts/api-server/src/lib/personas.ts` → `SHARED_RULES` constant:
- `ANSWER SEQUENCING` block (first rule, highest priority)
- `OVERDUE BILLS` block updated to say "after answering the user's question first"
