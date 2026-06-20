/**
 * Share button for the Altitude screens.
 *
 * Default behaviour: capture an off-screen ShareCard via
 * react-native-view-shot, then hand the PNG to the system share sheet via
 * expo-sharing. Falls back to the built-in text Share API when image
 * capture or expo-sharing is unavailable.
 *
 * The ShareCard is rendered inside a permanently-mounted hidden view so the
 * capture grabs a known layout instead of a transient render-tree node.
 * Position: absolute, top -10000, left -10000 — never visible to the user.
 */
import React, { useRef } from "react";
import { Pressable, Share, View } from "react-native";

import { Icon } from "@/components/Icon";
import { ShareCard, SHARE_CARD_SIZE } from "@/components/altitude/ShareCard";
import { useTheme } from "@/hooks/useTheme";
import { levelMeta, tierForLevel } from "@/lib/altitude";

// Defensive imports. expo-sharing + react-native-view-shot are linked at
// native build time, so a JS-only reload (Metro, OTA, dev menu) against an
// older binary will throw "Cannot find native module" at import. Wrapping
// in try/catch lets the screen continue to render with the text-Share
// fallback until the native binary is rebuilt via `expo prebuild`.
let ViewShot: typeof import("react-native-view-shot").default | null = null;
type ViewShotRef = import("react-native-view-shot").ViewShotRef;
let Sharing: typeof import("expo-sharing") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ViewShot = require("react-native-view-shot").default;
} catch {
  ViewShot = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sharing = require("expo-sharing");
} catch {
  Sharing = null;
}

interface ShareButtonProps {
  level: number;
  streak: number;
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
  const shotRef = useRef<ViewShotRef | null>(null);

  const onPress = async () => {
    const tier = tierForLevel(level);
    const meta = levelMeta(level);
    const streakLine = streak >= 2 ? ` · ${streak}-mo climb streak` : "";
    const message =
      `I'm ${meta.rank.toLowerCase()} on Judith — ${tier.name}${streakLine}.` +
      ` Tracking my bills so they don't run my life. https://judithforduedates.com`;

    // 1. Try image share via view-shot + expo-sharing. This is the rich
    //    path — recipients see the colored card with the shield. Skipped
    //    when either native module isn't linked in the current binary.
    if (Sharing && ViewShot) {
      try {
        const sharingAvailable = await Sharing.isAvailableAsync();
        if (sharingAvailable && shotRef.current?.capture) {
          const uri = await shotRef.current.capture();
          if (typeof uri === "string" && uri) {
            await Sharing.shareAsync(uri, {
              mimeType: "image/png",
              dialogTitle: "Share your altitude",
              UTI: "public.png",
            });
            return;
          }
        }
      } catch {
        // Capture or share failed — fall through to text.
      }
    }

    // 2. Text fallback. RN's built-in Share works everywhere.
    try {
      await Share.share({ message });
    } catch {
      // User cancelled or share unavailable — silent no-op.
    }
  };

  return (
    <>
      {/* Hidden capture surface. Positioned far off-screen with
          collapsable=false so RN keeps the native view alive even when it
          isn't on the visible tree — required for view-shot to find
          something to render. Only mounted when ViewShot is linked. */}
      {ViewShot ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{
            position: "absolute",
            top: -10000,
            left: -10000,
            width: SHARE_CARD_SIZE,
            height: SHARE_CARD_SIZE,
            opacity: 0,
          }}
        >
          <ViewShot
            ref={shotRef}
            options={{ format: "png", quality: 0.95, result: "tmpfile" }}
          >
            <ShareCard level={level} streak={streak} />
          </ViewShot>
        </View>
      ) : null}

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
    </>
  );
}
