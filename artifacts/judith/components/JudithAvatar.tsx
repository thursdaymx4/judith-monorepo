import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import type { PersonaId } from "@/constants/personas";
import { PERSONA_LOOKS } from "@/constants/theme";

/**
 * Judith avatar — the locked "Aqua" look (DiceBear micah / seed Amaya), styled
 * per persona + mood. Ported from japp-avatar.jsx. Rendered via expo-image
 * (SVG source) on a persona-tinted disc with halo / listening pulse / speaking
 * wave states.
 */

export type AvatarState = "idle" | "listening" | "speaking";
export type AvatarMood = "joy" | "warm" | "proud" | "wink" | "gentle";

const LOOK = { style: "micah", seed: "Amaya" };

const PERSONA_PARAMS: Record<PersonaId, string> = {
  pro: "mouth=smile&glasses=square&glassesProbability=100&shirt=collared&shirtColor=6690cc",
  funny: "mouth=laughing&eyes=smiling&shirt=crew&shirtColor=ff8a5b&glassesProbability=0",
  sib: "mouth=smirk&eyes=eyesShadow&eyebrows=up&shirt=open&shirtColor=2fb39b&glassesProbability=0",
  mama: "mouth=smile&glasses=round&glassesProbability=100&hairColor=b7b7b7&shirt=collared&shirtColor=c77dab",
  marites: "mouth=surprised&eyes=round&eyebrows=eyelashesUp&shirt=open&shirtColor=7c3aed&hairColor=db2777&glassesProbability=0",
  britney: "mouth=pucker&eyes=eyesShadow&eyebrows=up&shirt=collared&shirtColor=374151&glassesProbability=0",
};

const PERSONA_BG: Record<PersonaId, string> = {
  pro: "d1d4f9,b6e3f4",
  funny: "ffdfbf,ffd5dc",
  sib: "b8e6dd,b6e3f4",
  mama: "ffd5dc,f3d1e6",
  marites: "fce7f3,f9a8d4",
  britney: "94a3b8,1e293b",
};

const MOOD_EXPR: Record<AvatarMood, string> = {
  joy: "mouth=laughing&eyes=smiling",
  warm: "mouth=smile&eyes=smiling",
  proud: "mouth=smile&eyes=eyesShadow",
  wink: "mouth=smirk&eyes=round",
  gentle: "mouth=smile&eyes=smilingShadow",
};

function faceURL(persona: PersonaId, mood?: AvatarMood): string {
  let overlay = PERSONA_PARAMS[persona] || "";
  const moodExpr = mood ? MOOD_EXPR[mood] : "";
  if (moodExpr) {
    overlay =
      overlay.replace(/mouth=[^&]*/g, "").replace(/eyes=[^&]*/g, "") +
      "&" +
      moodExpr;
  }
  overlay = overlay.replace(/&+/g, "&").replace(/^&|&$/g, "");
  const bg = PERSONA_BG[persona] || "b6e3f4,d1d4f9";
  return (
    `https://api.dicebear.com/9.x/${LOOK.style}/svg?seed=${encodeURIComponent(LOOK.seed)}` +
    `&radius=50&backgroundType=gradientLinear&backgroundColor=${bg}` +
    (overlay ? "&" + overlay : "")
  );
}

interface JudithAvatarProps {
  persona?: PersonaId;
  size?: number;
  state?: AvatarState;
  mood?: AvatarMood;
  /** Show the small mic badge. */
  badge?: boolean;
}

function JudithAvatarImpl({
  persona = "pro",
  size = 56,
  state = "idle",
  mood,
  badge,
}: JudithAvatarProps) {
  const look = PERSONA_LOOKS[persona] ?? PERSONA_LOOKS.pro;
  const pulse = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;

  // Memoize the DiceBear URL so React.memo on the wrapper component can
  // reliably skip re-renders when persona/mood haven't changed. Without
  // this, even a no-op parent re-render reconstructs the URL string and
  // expo-image diffs the `source` prop.
  const uri = useMemo(() => faceURL(persona, mood), [persona, mood]);

  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    if (state === "listening") {
      pulse.setValue(0);
      anim = Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      );
      anim.start();
    } else if (state === "speaking") {
      wave.setValue(0);
      // useNativeDriver: TRUE — previously this was false because the
      // wave bars animated `height`, which can't run on the native driver.
      // Result: every active speaking avatar pumped the JS thread at 60Hz
      // for the entire duration of the audio. With many avatars in the
      // persona picker (or stale "speaking" states from cancelled previews),
      // the JS thread was being starved — taps stopped responding while
      // scrolling still worked (scroll runs on the UI thread). Switching
      // to transform-scaleY moves the animation off the JS thread. The
      // visual result is identical because the bar's anchor point stays
      // at the bottom (see `transformOrigin` in the bar style below).
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(wave, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(wave, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      anim.start();
    }
    return () => anim?.stop();
  }, [state, pulse, wave]);

  const haloSize = size * 1.34;
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* halo */}
      <View
        style={[
          styles.halo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: look.g1,
            opacity: 0.28,
          },
        ]}
      />
      {/* listening pulse rings */}
      {state === "listening" && (
        <Animated.View
          style={[
            styles.pulse,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: look.g1,
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />
      )}
      {/* avatar disc */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: look.g2,
        }}
      >
        <Image
          source={{ uri }}
          // memory-disk so a persona's SVG survives app restarts. Without
          // this, expo-image's default is memory-only and every cold start
          // re-fetches every avatar — felt as JS-thread thrash on tab open.
          cachePolicy="memory-disk"
          // Reuse the same native view across persona swaps in lists like
          // the persona picker. Same key = no re-init.
          recyclingKey={`avatar-${persona}-${mood ?? "none"}`}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={200}
        />
      </View>
      {/* speaking wave — bars use a fixed maximum height container, and
          scaleY transform (driven natively) to animate. This keeps the
          animation off the JS thread (was the dominant JS-thread hog
          before). The "anchor at bottom" effect comes from translateY
          on the outer container so the bar grows upward, not from both
          ends like a default scale would. */}
      {state === "speaking" && (
        <View style={[styles.waveRow, { bottom: -size * 0.12 }]}>
          {[0, 1, 2, 3, 4].map((i) => {
            const maxH = size * (0.18 + (i % 2) * 0.12);
            const minH = size * 0.08;
            const minScale = minH / maxH;
            // Interpolate between minScale and 1 — at value 0 the bar is
            // its minimum size; at value 1 it's full height.
            const sy = wave.interpolate({
              inputRange: [0, 1],
              outputRange: [minScale, 1],
            });
            return (
              <Animated.View
                key={i}
                style={{
                  width: Math.max(2, size * 0.04),
                  height: maxH,
                  borderRadius: 4,
                  backgroundColor: look.g1,
                  transform: [{ scaleY: sy }, { translateY: 0 }],
                  // Anchor scale to the bottom edge so the bar grows
                  // upward, mimicking the old height-animation visual.
                  transformOrigin: "bottom",
                }}
              />
            );
          })}
        </View>
      )}
      {/* mic badge */}
      {badge && (
        <View
          style={[
            styles.badge,
            {
              width: size * 0.36,
              height: size * 0.36,
              borderRadius: size * 0.18,
              backgroundColor: look.g2,
            },
          ]}
        />
      )}
    </View>
  );
}

// React.memo bails out of re-renders whose persona/size/state/mood/badge
// haven't changed. Critical for the persona picker modal (6 avatars in a
// scroll list) and Settings (every theme toggle previously re-rendered
// every avatar — and re-init'd the expo-image source).
export const JudithAvatar = React.memo(JudithAvatarImpl);

const styles = StyleSheet.create({
  halo: { position: "absolute" },
  pulse: { position: "absolute", borderWidth: 2 },
  waveRow: {
    position: "absolute",
    flexDirection: "row",
    gap: 3,
    alignItems: "flex-end",
    height: 20,
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0a0b0e",
  },
});

export default JudithAvatar;

