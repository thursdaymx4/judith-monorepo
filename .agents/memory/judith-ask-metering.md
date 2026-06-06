---
name: Judith ask metering & cooldown invariants
description: Rules every Ask entry point must obey for credits and rate-limit cooldown.
---

# Ask metering & cooldown invariants

The chat `ask()` flow consumes a free-tier credit (`consumeAsk`) before the request and must keep credits and cooldown consistent across ALL entry points: text input, mic, quick-ask chips, and the Retry button.

- **Refund credits with a functional setState, never a stale-state patch.** `addAsks` must read the previous state (`setState(s => ({...s, asksLeft: s.asksLeft + n}))`). A non-functional `patch({ asksLeft: state.asksLeft + n })` over the closed-over `state` over-credits when a fast failure refunds before the `consumeAsk` rerender lands.
  - **Why:** quick timeouts/429s race the decrement; stale closure yields net +1, an exploitable quota leak.
- **Refund the credit on any request that didn't get answered** (timeout/connection AND rate-limit), since the server never produced a reply.
- **Every ask entry point must early-return while `rateLimitSecs > 0`.** Disabling the input/mic is not enough — programmatic callers (Retry button, quick chips) bypass UI gating and would spam 429s. `rateLimitSecs` ticks down to 0 via a 1s effect, so the guard is temporary, not a permanent block.

**How to apply:** when adding a new way to trigger `ask()`, route it through `ask()` (which holds the cooldown + dedupe guards) rather than calling the network directly.
