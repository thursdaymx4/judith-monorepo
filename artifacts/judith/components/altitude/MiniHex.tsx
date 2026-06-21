/**
 * Mini hexagon — a stripped-down version of the DivisionShield used for
 * ladder cells, month rows on Climb, and the home-screen badge.
 *
 * No animation, no aura, no tab. Just a tier-gradient hex with an optional
 * center label. Static SVG so it's cheap to render dozens at once.
 */
import React from "react";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { tierForLevel } from "@/lib/altitude";

interface MiniHexProps {
  level: number;
  size?: number;
  /** What to render in the center. Defaults to no label. */
  label?: string;
  /** Visual state. `locked` desaturates; `done` is the same as the
   *  default current style with a check-mark overlay (caller paints it). */
  state?: "current" | "done" | "locked";
}

const HEX_PATH = "M60,5 L110,33 L110,99 L60,127 L10,99 L10,33 Z";

export function MiniHex({ level, size = 36, label, state = "current" }: MiniHexProps) {
  const tier = tierForLevel(level);
  const w = size;
  const h = size * 1.1;
  const fillTop = state === "locked" ? "#2A2E38" : tier.light;
  const fillBottom = state === "locked" ? "#1B1F27" : tier.color;
  const stroke = state === "current" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)";
  const strokeWidth = state === "current" ? 2 : 1;

  return (
    <View style={{ width: w, height: h, alignItems: "center", justifyContent: "center" }}>
      <Svg width={w} height={h} viewBox="0 0 120 132">
        <Defs>
          <LinearGradient id={`minihex-${level}-${state}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fillTop} />
            <Stop offset="1" stopColor={fillBottom} />
          </LinearGradient>
        </Defs>
        <Path
          d={HEX_PATH}
          fill={`url(#minihex-${level}-${state})`}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </Svg>
      {label ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: w,
            height: h,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontWeight: "700",
              fontSize: size * 0.4,
              color: "white",
              opacity: state === "locked" ? 0.4 : 1,
            }}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
