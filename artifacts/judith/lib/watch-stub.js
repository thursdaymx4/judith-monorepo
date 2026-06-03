/**
 * Stub for react-native-watch-connectivity used in Expo Go.
 *
 * The real package calls TurboModuleRegistry.getEnforcing() at module-init
 * time, which throws in Expo Go because the native binary isn't present.
 * Metro resolves this file instead when the WatchConnectivity TurboModule
 * isn't available, keeping the JS bundle crash-free.
 *
 * The real module is used automatically in a development/production build
 * that includes the native WatchConnectivity binary.
 */

const noop = () => Promise.resolve();
const stub = {
  getIsWatchAppInstalled: () => Promise.resolve(false),
  getIsPaired: () => Promise.resolve(false),
  getIsReachable: () => Promise.resolve(false),
  transferUserInfo: noop,
  sendMessage: noop,
  transferFile: noop,
  updateApplicationContext: noop,
  addListener: () => ({ remove: () => {} }),
  removeListeners: () => {},
};

module.exports = stub;
module.exports.default = stub;
