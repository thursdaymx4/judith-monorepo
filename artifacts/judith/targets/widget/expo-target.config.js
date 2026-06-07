/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "JudithWidget",
  bundleIdentifier: ".widget",
  deploymentTarget: "16.0",
  frameworks: ["WidgetKit", "SwiftUI"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.app.judith"],
  },
};
