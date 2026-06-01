/**
 * Web-specific (Expo Web / react-native-web) implementations.
 * Uses real DOM elements with CSS radial-gradient — pixel-perfect match
 * to the prototype's .bloom-bg and .intro-screen background rules.
 *
 * Metro picks this file over GlowBlob.tsx on the "web" platform target.
 */
import React from "react";

export interface GlowBlobProps {
  /** Center x as fraction of container width (0–1), same as CSS `at X%` */
  cx: number;
  /** Center y as fraction of container height (0–1), same as CSS `at Y%` */
  cy: number;
  /** Horizontal semi-axis as fraction of container width (0–1), same as CSS `W%` */
  rw: number;
  /** Vertical semi-axis as fraction of container height (0–1), same as CSS `H%` */
  rh: number;
  /** Centre colour of the gradient, e.g. `rgba(41,213,165,0.30)` */
  color: string;
  /** Ignored on web — blur is handled per use-site */
  webBlurPx?: number;
}

/**
 * One radial-gradient blob.
 * Fills its parent (inset:0) and places the gradient per cx/cy/rw/rh.
 * This exactly mirrors the prototype CSS:
 *   radial-gradient(rw% rh% at cx% cy%, color, transparent 70%)
 */
export function GlowBlob({ cx, cy, rw, rh, color }: GlowBlobProps) {
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: `radial-gradient(${rw * 100}% ${rh * 100}% at ${cx * 100}% ${cy * 100}%, ${color}, transparent 70%)`,
    },
  });
}

/**
 * Persistent intro-screen base glow — shared by Splash and Login.
 * Prototype .intro-screen background:
 *   radial-gradient(95% 55% at 50% 38%, accent 22%, transparent 62%)
 */
export function IntroScreenGlow() {
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(95% 55% at 50% 38%, rgba(41,213,165,0.22), transparent 62%)",
    },
  });
}
