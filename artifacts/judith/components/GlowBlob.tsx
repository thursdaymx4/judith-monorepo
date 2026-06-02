/**
 * Native GlowBlob / IntroScreenGlow.
 *
 * The prototype's blooms are CSS radial-gradients that fade to transparent:
 *   radial-gradient(rw% rh% at cx% cy%, COLOR, transparent FEATHER%)
 * A solid-color View (even blurred) keeps an opaque center and reads as a
 * hard blob — which is exactly what was wrong. We use react-native-svg's
 * RadialGradient so the glow truly feathers out to transparent, identical
 * to the web version, on the near-black canvas.
 */
import React from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

export interface GlowBlobProps {
  /** Center x as fraction of screen width (0–1) */
  cx: number;
  /** Center y as fraction of screen height (0–1) */
  cy: number;
  /** Horizontal semi-axis as fraction of screen width (0–1) */
  rw: number;
  /** Vertical semi-axis as fraction of screen height (0–1) */
  rh: number;
  /** Centre colour, rgba()/rgb()/#hex, e.g. rgba(41,213,165,0.30) */
  color: string;
  /** Fraction of the radius where the glow reaches transparent (CSS `transparent X%`) */
  feather?: number;
  /** Ignored on native (the gradient is already soft); kept for web parity */
  blur?: number;
}

let _gid = 0;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1);

/** Parse rgba()/rgb() (comma or space separated) or #RGB/#RRGGBB/#RRGGBBAA → {rgb, alpha}. */
function splitColor(c: string): { rgb: string; alpha: number } {
  const s = c.trim();

  const fn = s.match(/rgba?\(([^)]+)\)/i);
  if (fn) {
    // supports "r,g,b,a", "r g b", and "r g b / a"
    const body = fn[1]!.replace("/", " ");
    const parts = body.split(/[\s,]+/).filter(Boolean);
    const [r, g, b, a] = parts;
    const ri = parseInt(r ?? "", 10);
    const gi = parseInt(g ?? "", 10);
    const bi = parseInt(b ?? "", 10);
    if ([ri, gi, bi].every(Number.isFinite)) {
      return { rgb: `rgb(${ri},${gi},${bi})`, alpha: a != null ? clamp01(parseFloat(a)) : 1 };
    }
  }

  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((ch) => ch + ch).join(""); // #RGB → #RRGGBB
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b].every(Number.isFinite)) {
        return { rgb: `rgb(${r},${g},${b})`, alpha: clamp01(a) };
      }
    }
  }

  // Safe fallback — never emit NaN channels into the gradient.
  return { rgb: "rgb(255,255,255)", alpha: 0 };
}

export function GlowBlob({ cx, cy, rw, rh, color, feather = 0.7 }: GlowBlobProps) {
  const { width, height } = useWindowDimensions();
  const bw = 2 * rw * width;
  const bh = 2 * rh * height;
  const id = React.useMemo(() => `glow${_gid++}`, []);
  const { rgb, alpha } = splitColor(color);
  const stop = clamp01(feather);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: cx * width - rw * width,
        top: cy * height - rh * height,
        width: bw,
        height: bh,
      }}
    >
      <Svg width={bw} height={bh}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={rgb} stopOpacity={alpha} />
            <Stop offset={String(stop)} stopColor={rgb} stopOpacity={0} />
            <Stop offset="1" stopColor={rgb} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * IntroScreenGlow — the persistent, subtle base glow shared by splash + login.
 * Prototype .intro-screen background:
 *   radial-gradient(95% 55% at 50% 38%, accent 22%, transparent 62%)
 * This is the soft central green haze behind the avatar — NOT a mint slab.
 */
export function IntroScreenGlow() {
  return (
    <GlowBlob
      cx={0.5}
      cy={0.38}
      rw={0.95}
      rh={0.55}
      color="rgba(41,213,165,0.22)"
      feather={0.62}
    />
  );
}
