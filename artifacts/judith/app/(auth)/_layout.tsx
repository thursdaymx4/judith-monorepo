import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  // Transparent contentStyle so the root BreathingBackdrop mounted in
  // _layout.tsx shows through every (auth) route (login + reset). Without
  // this, this nested Stack paints its own opaque canvas on top of the
  // bloom field and the splash → login handoff loses continuity.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
  );
}
