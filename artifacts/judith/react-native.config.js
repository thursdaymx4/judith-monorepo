/**
 * React Native auto-linking configuration.
 *
 * react-native-watch-connectivity is iOS/WatchKit only.
 * Its Android Kotlin implementation is incomplete and fails to compile.
 * Setting android: null disables native linking on Android while keeping
 * the iOS native module intact for dev/production iOS builds.
 *
 * The JS side is already stubbed via metro.config.js for Expo Go.
 */
module.exports = {
  dependencies: {
    "react-native-watch-connectivity": {
      platforms: {
        android: null,
      },
    },
  },
};
