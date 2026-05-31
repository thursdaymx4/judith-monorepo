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

**Why:** the default was once `claude-sonnet-4-20250514`, which Anthropic marked
deprecated with an EOL ~2 weeks out. Because no env override exists, an EOL'd
default silently breaks the *entire* assistant (ask returns 500) on the EOL
date. The API still answers until EOL but emits a deprecation warning in logs.

**How to apply:** to verify quickly, call the Anthropic SDK with the candidate
model id; a deprecated/removed model returns a deprecation warning then a 404
`not_found_error`. A healthy current model returns text with no warning.
