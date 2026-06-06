/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch",
  name: "JudithWatch",
  bundleIdentifier: ".watchkitapp",
  icon: "./AppIcon.png",
  frameworks: [
    "WatchConnectivity",
    "UserNotifications",
    "WidgetKit",
    "AVFoundation",
    "WatchKit",
  ],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.app.judith"],
  },
};
