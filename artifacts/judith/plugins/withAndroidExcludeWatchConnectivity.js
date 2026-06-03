/**
 * Expo config plugin: exclude react-native-watch-connectivity from Android.
 *
 * The package's Android Kotlin implementation (WatchConnectivityModule.kt)
 * does not implement all required abstract base class members and fails to
 * compile. The feature is iOS/WatchKit only — there is nothing to run on
 * Android. This plugin removes the package from the generated
 * android/settings.gradle so Gradle never tries to compile it.
 *
 * The JS side is already handled by the Metro stub (metro.config.js).
 */
const { withSettingsGradle } = require("@expo/config-plugins");

module.exports = (config) =>
  withSettingsGradle(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents
      .split("\n")
      .filter((line) => !line.includes("react-native-watch-connectivity"))
      .join("\n");
    return mod;
  });
