---
name: Judith Anthropic model default
description: The ask flow's LLM model is a hardcoded pinned default that Anthropic periodically deprecates.
---

# Judith Anthropic model default

Judith's `/api/judith/ask` flow selects the model via
`process.env["ANTHROPIC_MODEL"] ?? "<pinned default>"` in
`artifacts/api-server/src/lib/anthropic.ts`. In practice **no `ANTHROPIC_MODEL`
env var is set**, so the hardcoded pinned default is load-bearing — it is the
model that actually runs in dev and prod.

**Rule:** keep the pinned default on a current, non-EOL Anthropic model. When a
pinned model nears end-of-life, bump the default (and re-verify a sample reply).

**Why:** `claude-3-5-haiku-20241022` hit EOL Feb 19 2026 — returned 404 from
Anthropic, crashing every question routed to Haiku (all short/simple ones).
`claude-sonnet-4-20250514` had the same issue earlier. Confirmed pattern: EOL
defaults return `not_found_error` 404 silently on the EOL date.

**Current models (Jun 2026):**
- `ANTHROPIC_MODEL` (Sonnet): `claude-sonnet-4-5-20250929` — confirmed working
- `ANTHROPIC_HAIKU_MODEL`: now falls back to `ANTHROPIC_MODEL` since no current
  Haiku model ID is confirmed; set `ANTHROPIC_HAIKU_MODEL` env var when a new
  Haiku is available to restore cost savings on short questions

**How to apply:** to verify quickly, call the Anthropic SDK with the candidate
model id; a deprecated/removed model returns a 404 `not_found_error`. A healthy
current model returns text. Also: `ANTHROPIC_HAIKU_MODEL` falls back to
`ANTHROPIC_MODEL` by design — never hardcode an EOL'd model as the default.
