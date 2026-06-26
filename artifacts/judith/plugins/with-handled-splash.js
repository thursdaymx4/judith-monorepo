/**
 * Custom Expo config plugin — strips the iOS launch storyboard down to a
 * plain dark canvas (#0a0b0e) with NO logo and NO text.
 *
 * Why: the React-side HandledSplash (BreathingBackdrop + avatar + headline)
 * is the real splash. The native launch storyboard only exists to cover the
 * brief moment between iOS app-launch and the JS bundle's first paint. If
 * the storyboard shows a logo or "Handled." label, that flashes for a
 * fraction of a second before HandledSplash mounts and replaces it — which
 * the user perceives as a jarring two-step splash.
 *
 * `expo-splash-screen` regenerates `ios/Judith/SplashScreen.storyboard` on
 * every prebuild with an imageView pointing at the configured icon. We
 * can't remove the image via its config (it's required), so this plugin
 * runs AFTER expo-splash-screen via `withDangerousMod` and surgically
 * removes the imageView + its constraints + any leftover label from the
 * generated storyboard.
 *
 * Idempotent — re-running prebuild after a clean storyboard is a no-op.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const LABEL_ID = "HandledSplashTitle";
const IMAGE_VIEW_ID = "EXPO-SplashScreen";

/**
 * Remove every XML element whose tag matches `tagName` AND whose `id`
 * attribute equals `idValue`. Also removes <constraint> elements that
 * reference the removed id via firstItem= or secondItem=. Single-line
 * self-closing AND multi-line block forms are handled.
 */
function stripById(xml, tagName, idValue) {
  // Block form: <tag ... id="idValue" ...> ... </tag>
  const blockRe = new RegExp(
    `\\s*<${tagName}\\b[^>]*\\bid="${idValue}"[\\s\\S]*?<\\/${tagName}>`,
    "g",
  );
  xml = xml.replace(blockRe, "");
  // Self-closing form: <tag ... id="idValue" .../>
  const selfRe = new RegExp(
    `\\s*<${tagName}\\b[^>]*\\bid="${idValue}"[^>]*\\/>`,
    "g",
  );
  xml = xml.replace(selfRe, "");
  return xml;
}

/**
 * Strip every <constraint> element that references the given id via
 * firstItem or secondItem. Used to clean up dangling constraints left
 * behind after removing an imageView or label.
 */
function stripConstraintsReferencing(xml, idValue) {
  const re = new RegExp(
    `\\s*<constraint\\b[^>]*(?:firstItem|secondItem)="${idValue}"[^>]*\\/>`,
    "g",
  );
  return xml.replace(re, "");
}

// Transparent stand-in for the Android 12+ splash icon. expo-splash-screen
// writes `windowSplashScreenAnimatedIcon = @drawable/splashscreen_logo` into
// styles.xml even though no splash `image` is configured (Judith shows the
// JS-side HandledSplash on a plain dark canvas, no native logo). Without this
// drawable the resource link fails: "resource drawable/splashscreen_logo not
// found". Rendering a transparent shape keeps the native splash logo-free.
const ANDROID_SPLASH_LOGO_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@android:color/transparent" />
</shape>
`;

// Only create the placeholder if no real splashscreen_logo was generated (e.g.
// from a configured splash image) — a PNG/WEBP + our XML of the same name would
// be a duplicate-resource AAPT error.
function ensureAndroidSplashLogo(resRoot) {
  if (!fs.existsSync(resRoot)) return;
  const hasLogo = fs
    .readdirSync(resRoot)
    .filter((d) => d.startsWith("drawable"))
    .some((d) =>
      fs
        .readdirSync(path.join(resRoot, d))
        .some((f) => /^splashscreen_logo\.(png|webp|jpg|jpeg|xml)$/i.test(f)),
    );
  if (hasLogo) return;
  const baseDir = path.join(resRoot, "drawable");
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, "splashscreen_logo.xml"), ANDROID_SPLASH_LOGO_XML);
}

module.exports = function withHandledSplash(config) {
  // Android: guarantee a (transparent) splashscreen_logo drawable exists. Runs
  // after expo-splash-screen since this plugin is listed after it in app.json.
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const resRoot = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
      );
      ensureAndroidSplashLogo(resRoot);
      return cfg;
    },
  ]);

  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const storyboardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Judith",
        "SplashScreen.storyboard",
      );

      if (!fs.existsSync(storyboardPath)) return cfg;

      let xml = fs.readFileSync(storyboardPath, "utf8");
      const before = xml;

      // 1) Remove the legacy "Handled." label if present.
      xml = stripById(xml, "label", LABEL_ID);
      xml = stripConstraintsReferencing(xml, LABEL_ID);

      // 2) Remove the splash-screen imageView (and its constraints) so the
      //    storyboard is just the dark canvas.
      xml = stripById(xml, "imageView", IMAGE_VIEW_ID);
      xml = stripConstraintsReferencing(xml, IMAGE_VIEW_ID);

      // 3) Drop the SplashScreenLogo image resource — orphaned after the
      //    imageView is removed, and keeping it would let Xcode warn.
      xml = xml.replace(
        /\s*<image name="SplashScreenLogo"[^/]*\/>/g,
        "",
      );

      if (xml !== before) fs.writeFileSync(storyboardPath, xml);
      return cfg;
    },
  ]);
};
