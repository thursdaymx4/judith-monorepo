/**
 * Native fallback for GlowBlob / IntroScreenGlow.
 * On native (iOS/Android) we can't use CSS radial-gradient, so we render
 * a solid semi-transparent ellipse at the blob's center position.
 * The opacity values match the prototype's centre-colour opacities.
 */
import React from "react";
import { useWindowDimensions, View } from "react-native";

export interface GlowBlobProps {
  cx: number;
  cy: number;
  rw: number;
  rh: number;
  color: string;
  webBlurPx?: number;
}

export function GlowBlob({ cx, cy, rw, rh, color }: GlowBlobProps) {
  const { width, height } = useWindowDimensions();
  // On native: diameter = 2 × semi-axis (rw/rh are radii, matching CSS)
  const bw = 2 * rw * width;
  const bh = 2 * rh * height;
  return (
    <View
      style={{
        position: "absolute",
        left: cx * width - rw * width,
        top: cy * height - rh * height,
        width: bw,
        height: bh,
        borderRadius: 9999,
        backgroundColor: color,
      }}
    />
  );
}

export function IntroScreenGlow() {
  const { width, height } = useWindowDimensions();
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(41,213,165,0.13)",
      }}
    />
  );
}
