/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "share",
  name: "JudithShareReceipt",
  // Inherits group.com.app.judith from the host so the extension and the
  // main app can hand off the captured image via App Group UserDefaults.
  bundleIdentifier: ".sharereceipt",
  deploymentTarget: "16.0",
  // Intentionally no icon: the share sheet shows the host app's icon and
  // display name. Setting one here would override that for the row, which
  // the user would not expect.
  frameworks: ["UIKit", "MobileCoreServices", "UniformTypeIdentifiers"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.app.judith"],
  },
};
