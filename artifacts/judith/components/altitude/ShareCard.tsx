/**
 * Visual share card. Rendered offscreen (or inside a hidden container) and
 * captured to a PNG via react-native-view-shot for image-based social
 * sharing.
 *
 * Layout: tier-tinted background, big shield, rank + division, streak
 * line, JetBrains-mono "LV n", Judith wordmark + URL footer. Square
 * 1080×1080 for clean rendering on every social surface.
 */
import React from "react";
import { View } from "react-native";

import { DivisionShield } from "@/components/altitude/DivisionShield";
import { Txt } from "@/components/ui";
import { levelMeta, tierForLevel } from "@/lib/altitude";

export interface ShareCardProps {
  level: number;
  streak: number;
}

/** Square share card. 320×320 in screen units — at the standard 3× capture
 *  resolution this produces a ~960×960 PNG, comfortable for IG/Twitter. */
export const SHARE_CARD_SIZE = 320;

export function ShareCard({ level, streak }: ShareCardProps) {
  const tier = tierForLevel(level);
  const meta = levelMeta(level);

  return (
    <View
      style={{
        width: SHARE_CARD_SIZE,
        height: SHARE_CARD_SIZE,
        backgroundColor: "#0A0C11",
        overflow: "hidden",
      }}
    >
      {/* Tier-tinted radial background. Two stacked color washes — no SVG
          radial-gradient here because the share-shot capture path is more
          predictable when only plain Views are involved. */}
      <View
        style={{
          position: "absolute",
          width: SHARE_CARD_SIZE * 1.5,
          height: SHARE_CARD_SIZE * 1.5,
          borderRadius: SHARE_CARD_SIZE * 0.75,
          backgroundColor: tier.color,
          opacity: 0.55,
          top: -SHARE_CARD_SIZE * 0.3,
          left: -SHARE_CARD_SIZE * 0.25,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: SHARE_CARD_SIZE * 0.9,
          height: SHARE_CARD_SIZE * 0.9,
          borderRadius: SHARE_CARD_SIZE * 0.45,
          backgroundColor: tier.light,
          opacity: 0.18,
          top: SHARE_CARD_SIZE * 0.4,
          right: -SHARE_CARD_SIZE * 0.2,
        }}
      />

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* Kicker */}
        <Txt
          size={11}
          weight="bold"
          color="rgba(255,255,255,0.78)"
          style={{ letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 8 }}
        >
          Financial Altitude
        </Txt>

        {/* Shield — stripped of its animation by passing a fresh static
            DivisionShield. The component still animates but the capture
            grabs a frame, so the result is a clean still image. */}
        <View style={{ marginVertical: 6 }}>
          <DivisionShield level={level} size={130} />
        </View>

        {/* Rank + division */}
        <Txt
          size={22}
          weight="bold"
          color="white"
          style={{ marginTop: 14, textAlign: "center" }}
        >
          {meta.rank}
        </Txt>
        <Txt
          size={13}
          color="rgba(255,255,255,0.78)"
          style={{ marginTop: 2 }}
        >
          {tier.name}
        </Txt>

        {streak >= 2 ? (
          <View
            style={{
              marginTop: 14,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
            }}
          >
            <Txt size={11} weight="semibold" color="white">
              🔥 {streak}-month climb streak
            </Txt>
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Txt size={13} weight="bold" color="white">
          Judith
        </Txt>
        <Txt size={10} color="rgba(255,255,255,0.55)">
          judithforduedates.com
        </Txt>
      </View>
    </View>
  );
}
