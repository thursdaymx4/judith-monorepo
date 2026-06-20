/**
 * Share button for the Altitude screens. Composes a one-line shareable
 * status from the user's current level + streak and hands it to the
 * system share sheet via React Native's built-in Share API.
 *
 * Text-only for v1 — no image capture (would need react-native-view-shot
 * + extra plumbing). The text is the level rank + division + streak, with
 * Judith's landing URL appended so recipients can tap through.
 */
import React from "react";
import { Pressable, Share, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { levelMeta, tierForLevel } from "@/lib/altitude";

interface ShareButtonProps {
  level: number;
  streak: number;
  /** Right offset in points. Defaults sit comfortably inside the screen
   *  gutter for both League and Climb. */
  top?: number;
  right?: number;
}

export function ShareButton({
  level,
  streak,
  top = 18,
  right = 18,
}: ShareButtonProps) {
  const t = useTheme();

  const onPress = async () => {
    const tier = tierForLevel(level);
    const meta = levelMeta(level);
    const streakLine = streak >= 2 ? ` · ${streak}-mo climb streak` : "";
    const message =
      `I'm ${meta.rank.toLowerCase()} on Judith — ${tier.name}${streakLine}.` +
      ` Tracking my bills so they don't run my life. https://judithforduedates.com`;
    try {
      await Share.share({ message });
    } catch {
      // User cancelled or share unavailable — silent no-op.
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top, right, zIndex: 50 }}
    >
      <Pressable
        onPress={onPress}
        hitSlop={10}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hair,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon name="share" size={16} color={t.txtHi} />
      </Pressable>
    </View>
  );
}
