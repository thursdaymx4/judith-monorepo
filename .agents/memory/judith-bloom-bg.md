---
name: Judith bloom background
description: How the splash/login glow blobs are rendered in RN — .web.tsx CSS radial-gradient (correct approach) vs solid-ellipse approximation (rejected).
---

# Bloom background approach

## The rule (CURRENT — correct)
Use `.web.tsx` platform-specific files so web gets **real CSS `radial-gradient`** via `React.createElement('div', { style: {...} })`. Native gets a solid low-opacity ellipse fallback.

```tsx
// GlowBlob.web.tsx — pixel-perfect prototype match
export function GlowBlob({ cx, cy, rw, rh, color }: GlowBlobProps) {
  return React.createElement('div', {
    style: {
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(${rw*100}% ${rh*100}% at ${cx*100}% ${cy*100}%, ${color}, transparent 70%)`,
    },
  });
}
```

Props `rw`/`rh` are **semi-axes as fractions** — map directly to CSS `W% H% at X% Y%` (no conversion).

## BloomBg container (Splash.tsx)
The `Animated.View` wrapping the three `GlowBlob`s gets `filter: 'blur(6px)'` on web — matches prototype `.bloom-bg` container blur exactly:
```tsx
const BLOOM_WEB_STYLE = Platform.OS === 'web' ? ({ filter: 'blur(6px)' } as object) : {};
```

## Prototype colour values (EXACT)
- Blob 1 (teal):   `rgba(41,213,165,0.30)` at 28%/32%, rw=0.40, rh=0.30
- Blob 2 (purple): `rgba(223,134,215,0.28)` at 74%/60%, rw=0.45, rh=0.32
- Blob 3 (amber):  `rgba(247,184,61,0.26)`  at 52%/78%, rw=0.40, rh=0.30
- IntroScreenGlow: `rgba(41,213,165,0.22)` radial 95%/55% at 50%/38%, transparent 62%

## Why solid-ellipse + blur DOES NOT WORK
CSS `radial-gradient(…, transparent 70%)` creates a natural transparent edge — a solid `View` with `filter:blur()` does NOT replicate this. Even at 70px blur:
- The solid centre remains fully opaque → shows as a visible hard-ish ellipse blob (seen in screenshot at 0.55 opacity)
- RN Web's default `overflow:hidden` on Views clips blur extent at parent boundary
- The fix: use `.web.tsx` with real CSS `radial-gradient` on a DOM `div`

**How to apply:** Any soft ambient bloom/glow effect → `.web.tsx` + `React.createElement('div')` + CSS `background: radial-gradient(…)`. Never try to fake it with solid Views + large blur.

## Prototype CSS reference
```css
.bloom-bg {
  background:
    radial-gradient(40% 30% at 28% 32%, rgba(41,213,165,0.30), transparent 70%),
    radial-gradient(45% 32% at 74% 60%, rgba(223,134,215,0.28), transparent 70%),
    radial-gradient(40% 30% at 52% 78%, rgba(247,184,61,0.26), transparent 70%);
  filter: blur(6px);
}
.intro-screen {
  background:
    radial-gradient(95% 55% at 50% 38%, rgba(41,213,165,0.22), transparent 62%),
    var(--canvas);
}
```
