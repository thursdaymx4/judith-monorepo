---
name: Judith bloom background
description: How the splash/login glow blobs are rendered in RN — CSS radial-gradient approximation
---

# Bloom background approach

## The rule
RN has no `radial-gradient`. Approximate CSS `radial-gradient(W H at X% Y%, color 0%, transparent 70%)` with a solid-color `borderRadius:9999` View + `filter: blur(Npx)` (web-only). N must be large (≈70px) to replicate the natural soft edge.

**Why:** The prototype's `.bloom-bg` blobs use CSS radial-gradient which inherently fades to transparent at 70%. A solid View only 6px blur (the prototype's container blur) stays nearly opaque — needs ~70px per-blob blur to look right.

**How to apply:**
- Use `GlowBlob` component (components/GlowBlob.tsx): props cx/cy/rw/rh as screen-fraction (0–1), color as rgba with moderate alpha (0.45–0.55), webBlurPx=70.
- Wrap all three bloom blobs in an `Animated.View` for coordinated fade-out on splash exit.
- The persistent base glow (large teal at 50% 38%, accent 22%) is separate — use `IntroScreenGlow` from the same file. It sits OUTSIDE the deco-exit container so it persists through the cross-dissolve into the login screen.

## Prototype CSS reference
```css
.bloom-bg { background:
  radial-gradient(40% 30% at 28% 32%, accent 30%, transparent 70%),    /* teal */
  radial-gradient(45% 32% at 74% 60%, oklch(0.78 0.15 330) 28%, transparent 70%), /* purple ≈ #df86d7 */
  radial-gradient(40% 30% at 52% 78%, oklch(0.8 0.14 75) 26%, transparent 70%);  /* amber ≈ #f7b83d */
  filter: blur(6px); }

.intro-screen { background:
  radial-gradient(95% 55% at 50% 38%, accent 22%, transparent 62%),
  var(--canvas); }
```
