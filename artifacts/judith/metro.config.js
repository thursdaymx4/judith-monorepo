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

module.exports = config;
