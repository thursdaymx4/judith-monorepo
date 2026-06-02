---
name: Judith bloom background
description: How the splash/login glow blobs are rendered in RN — web uses CSS radial-gradient; native MUST use react-native-svg RadialGradient (NOT solid Views).
---

# Bloom background approach

## The rule (CURRENT — correct)
Platform-split `GlowBlob`:
- **Web** (`GlowBlob.web.tsx`): real CSS `radial-gradient` via `React.createElement('div', {...})`.
- **Native** (`GlowBlob.tsx`): `react-native-svg` `<RadialGradient>` filling an `<Ellipse>`, with `Stop` offsets `0 → color@alpha`, `feather(0.62–0.70) → transparent`, `1 → transparent`. Use `r="50%"` with the default objectBoundingBox units — it auto-stretches to the ellipse's box, giving the elliptical CSS look. Size the `Svg`/`View` to the ellipse bounding box (`2·rw·W × 2·rh·H`) and position by center.

**Why:** a solid `View` (even blurred) keeps an opaque center → reads as a hard blob on splash and a giant "mint slab" filling the login (IntroScreenGlow). Only a true radial gradient feathers to transparent like the prototype. react-native-svg is already a dep (Icon.tsx).

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
- The solid centre remains fully opaque → shows as a visible hard-ish ellipse blob (splash) or a giant slab (IntroScreenGlow on login)
- RN Web's default `overflow:hidden` on Views clips blur extent at parent boundary
- The fix: web → CSS `radial-gradient` div; native → `react-native-svg` `<RadialGradient>` (see top of file)

**How to apply:** Any soft ambient bloom/glow effect → web `.web.tsx` CSS `radial-gradient`; native `react-native-svg` `<RadialGradient>` with a transparent feather stop. Never fake it with solid Views + blur.

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
