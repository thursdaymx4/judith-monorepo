/**
 * Web-safe haptics wrappers. expo-haptics only fires on iOS/Android; on web (the
 * canvas preview) these are no-ops so nothing throws. Promises are swallowed so a
 * missing taptic engine never surfaces an unhandled rejection.
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const native = Platform.OS === "ios" || Platform.OS === "android";

export const haptics = {
  light: () => {
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium: () => {
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  heavy: () => {
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  success: () => {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error: () => {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  selection: () => {
    if (native) Haptics.selectionAsync().catch(() => {});
  },
};
