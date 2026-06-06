---
name: Judith Ask — scoped single-group questions
description: Why per-category AND per-business "how much for X" answers need explicit ₱0 cues + anti-substitution rules.
---

# Scoped single-group questions (category / business)

When the user asks "how much do I still need to pay for <one category or one business>", the model will **gap-fill from a DIFFERENT group** if the asked group has ₱0 directly-payable (e.g. all its bills are auto-charged to cards). Real failure: "Auto Tomato" (all via-card, ₱0 payable) was answered with CCSC's Laundry (₱4,000 payable).

**Required in the prompt context for EACH scoping dimension (category, business, …):**
1. State the directly-payable amount **explicitly even when ₱0** (don't omit it), split from auto-charged.
2. List payable vs auto-charged items **separately** so the model never has to infer which is payable.
3. Include an anti-substitution rule: use ONLY that group's line, never name/add a bill from another group, and if directly-payable is ₱0 say "nothing to pay separately" (auto-charged bills are settled via the cards).

**Why:** a soft per-bill `[BUSINESS: X]`/`[AUTO-CHARGED]` tag list alone is not enough — the model still substitutes. The category rule was added long before the business rule; any NEW scoping dimension needs the same three guards or it will regress.

**How to apply:** lives in `buildClientContext` (api-server judith route). Keep the category and business breakdown/rules in lockstep when editing either.
