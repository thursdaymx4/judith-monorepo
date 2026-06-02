/**
 * Native GlowBlob / IntroScreenGlow.
 *
 * React Native 0.76+ (Expo SDK 53) supports the `filter` style prop on native,
 * giving us a real per-blob Gaussian blur instead of a flat solid ellipse.
 */
import React from "react";
import { useWindowDimensions, View } from "react-native";

export interface GlowBlobProps {
  cx: number;
  cy: number;
  rw: number;
  rh: number;
  color: string;
  blur?: number;
}

export function GlowBlob({ cx, cy, rw, rh, color, blur = 80 }: GlowBlobProps) {
  const { width, height } = useWindowDimensions();
  const bw = 2 * rw * width;
  const bh = 2 * rh * height;
  return (
    <View
      style={[
        {
          position: "absolute",
          left: cx * width - rw * width,
          top: cy * height - rh * height,
          width: bw,
          height: bh,
          borderRadius: 9999,
          backgroundColor: color,
        },
        // RN 0.76+ filter API — actual soft glow instead of a hard ellipse
        { filter: [{ blur }] } as object,
      ]}
    />
  );
}

/**
 * IntroScreenGlow — persistent large teal radial behind both splash and login.
 * Prototype: radial-gradient(95% 55% at 50% 38%, accent 22%, transparent 62%)
 */
export function IntroScreenGlow() {
  const { width, height } = useWindowDimensions();
  const bw = width * 1.6;
  const bh = height * 0.72;
  return (
    <View
      style={[
        {
          position: "absolute",
          left: width * 0.50 - bw / 2,
          top: height * 0.38 - bh / 2,
          width: bw,
          height: bh,
          borderRadius: 9999,
          backgroundColor: "rgba(41,213,165,0.38)",
        },
        { filter: [{ blur: 110 }] } as object,
      ]}
    />
  );
}
