import React from "react";
import { Platform, useWindowDimensions, View } from "react-native";

/**
 * A soft glowing ellipse that approximates a CSS radial-gradient blob.
 *
 * The prototype uses CSS radial-gradient(W H at X% Y%, color 0%, transparent 70%),
 * which produces a solid center that naturally fades to transparent at its edges.
 * Since RN has no radial-gradient, we replicate the soft fade with a large
 * filter:blur on web. On native the blob renders without blur (still tinted).
 *
 * cx/cy = center as fraction of screen width/height (0–1)
 * rw/rh = ellipse radius as fraction of screen width/height (0–1)
 * webBlurPx = CSS filter blur in px applied per-blob on web (default 70)
 */
export interface GlowBlobProps {
  cx: number;
  cy: number;
  rw: number;
  rh: number;
  color: string;
  webBlurPx?: number;
}

export function GlowBlob({
  cx,
  cy,
  rw,
  rh,
  color,
  webBlurPx = 70,
}: GlowBlobProps) {
  const { width, height } = useWindowDimensions();
  const bw = rw * width;
  const bh = rh * height;

  const webFilter =
    Platform.OS === "web"
      ? ({ filter: `blur(${webBlurPx}px)` } as object)
      : {};

  return (
    <View
      style={[
        {
          position: "absolute",
          left: cx * width - bw / 2,
          top: cy * height - bh / 2,
          width: bw,
          height: bh,
          borderRadius: 9999,
          backgroundColor: color,
        },
        webFilter,
      ]}
    />
  );
}

/**
 * The persistent intro-screen background glow —
 * prototype: radial-gradient(95% 55% at 50% 38%, accent 22%, transparent 62%)
 * Accent mint = #29d5a5 at 22% opacity.
 * Rendered on BOTH the Splash and Login screens so the glow carries through.
 */
export function IntroScreenGlow() {
  return (
    <GlowBlob
      cx={0.50}
      cy={0.38}
      rw={0.95}
      rh={0.55}
      color="rgba(41,213,165,0.22)"
      webBlurPx={80}
    />
  );
}
