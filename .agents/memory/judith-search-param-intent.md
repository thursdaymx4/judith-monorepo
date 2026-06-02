---
name: Judith deep-link intent params
description: useLocalSearchParams hydrates after first render; run-once intent effects must guard on a recognized value, not fire unconditionally.
---

# Deep-link "intent" params into a screen

The home FAB speed-dial routes into `/ask` with an `intent` query param
(`scan` / `voice`) to auto-trigger the scanner or the recorder on open.

**Rule:** a run-once effect that consumes a router search param must NOT set its
`handled` ref unconditionally on the first pass. `useLocalSearchParams` can return
`undefined` on the first render and hydrate the real value a tick later. Only mark
the effect handled once a *recognized* value has actually arrived:

```ts
useEffect(() => {
  if (handled.current) return;
  const which = Array.isArray(intent) ? intent[0] : intent;
  if (which !== "scan" && which !== "voice") return; // wait for hydration
  handled.current = true;
  ...
}, [intent]);
```

**Why:** marking handled before validating drops late-arriving params, so the
auto-action silently never fires.

**How to apply:** any time a screen kicks off a one-shot side effect from a
search/route param in this Expo app.
