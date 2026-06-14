/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch-widget",
  name: "JudithComplications",
  bundleIdentifier: ".watchkitapp.complications",
  deploymentTarget: "10.0",
  // Intentionally no icon: @bacons/apple-targets only generates watchOS-sized
  // icons for `type === "watch"`. For "watch-widget" it produces iOS icons
  // which fail the build with "AppIcon did not have any applicable content".
  // Watch widget extensions inherit the host watch app's icon anyway.
  frameworks: ["WidgetKit", "SwiftUI"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.app.judith"],
  },
};
