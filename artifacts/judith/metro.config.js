const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Stub react-native-watch-connectivity in environments without the native
// WatchConnectivity TurboModule (Expo Go, simulators, Android).
// The real package calls TurboModuleRegistry.getEnforcing() at module-init
// time and crashes before any try/catch can intercept it.
// A development build compiled with the WatchKit extension will have the
// native binary and can replace this stub with the real package.
const WATCH_STUB = path.resolve(__dirname, "lib/watch-stub.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-watch-connectivity" && platform !== "ios") {
    return { filePath: WATCH_STUB, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// expo-updates extracts Android native C++ source into a temporary directory
// (_tmp_NNNN) during pnpm install, then removes it. If Metro starts before
// cleanup finishes it tries to watch those paths and crashes with ENOENT.
// Block any path that looks like an expo-updates temp extraction dir.
const { blockList: existingBlockList } = config.resolver;
config.resolver.blockList = [
  ...(existingBlockList
    ? Array.isArray(existingBlockList)
      ? existingBlockList
      : [existingBlockList]
    : []),
  /expo-updates_tmp_[^/]+[\\/]/,
];

// Force Babel to transform react-native ecosystem packages that ship modern JS
// syntax (private class fields, etc.). Metro skips node_modules by default,
// which causes hermesc (local binary) to reject those constructs at OTA time.
// This makes `eas update` work without needing a full EAS cloud build.
config.transformer.transformIgnorePatterns = [
  "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|react-native-svg|react-native-reanimated|react-native-gesture-handler|@bacons/.*)/)",
];

module.exports = config;
