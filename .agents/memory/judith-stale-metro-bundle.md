---
name: Judith stale Metro bundle ReferenceError
description: How to tell a "Property 'X' doesn't exist" runtime error is a stale bundle vs a real scope bug.
---

When the Expo (Judith) app throws `ReferenceError: Property 'ScreenX' doesn't exist`
for a newly-added top-level `function` component, suspect a **stale Metro bundle**
before assuming a hoisting/React-Compiler scope bug.

**Why:** Metro caches transforms and can keep serving a bundle compiled at an
intermediate edit state (e.g. the FLOW array referenced the component before the
function was added). A plain workflow restart does not always force a fresh bundle —
the cached error persists in the append-only log.

**How to apply:**
- Compare the **line numbers in the error** against the *current* file. If the error
  points the symbol at a different line than where it lives now, the bundle is stale.
- Force a fresh bundle by loading the app (screenshot / open preview) — that triggers
  Metro to rebuild against current files. Check the *browser console*, not the
  append-only workflow log, for the authoritative fresh result.
- Top-level `function` declarations DO hoist normally under React Compiler; a real
  scope bug would more likely show TDZ ("Cannot access before initialization"), not
  "Property doesn't exist".
