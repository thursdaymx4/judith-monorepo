import type { useRouter } from "expo-router";

type ExpoRouter = ReturnType<typeof useRouter>;

/**
 * router.back() with an empty-stack fallback. Avoids the
 * "GO_BACK was not handled by any navigator" dev warning that fires when
 * a screen is reached via deep link / notification / cold start and has
 * no prior route to return to.
 */
export function safeBack(router: ExpoRouter) {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}
