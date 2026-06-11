/**
 * Custom Expo config plugin — adds the "Handled." title to the iOS launch
 * storyboard so the splash matches the branded design that existed before
 * the move to expo-splash-screen.
 *
 * The expo-splash-screen plugin regenerates `ios/Judith/SplashScreen.storyboard`
 * on every prebuild with just an icon. We can't replace its config (it doesn't
 * accept extra text), so this plugin runs AFTER it via `withDangerousMod` and
 * injects a UILabel + constraints into the existing storyboard XML.
 *
 * Font: Georgia-BoldItalic ships with iOS so no font-bundling step is needed.
 * It's the closest system serif italic to Playfair Display — swap in a real
 * Playfair .ttf via the expo-font plugin later if pixel-accuracy matters.
 *
 * The injection is idempotent — if the label is already present, the plugin
 * no-ops, so re-running prebuild doesn't double-apply.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const LABEL_ID = "HandledSplashTitle";

// One UILabel rendering "Handled." centered horizontally, pinned 28pt below
// the existing SplashScreenLogo image view. Width spans the device so the
// label scales across iPhone sizes. Color is a soft off-white so it reads
// clearly on the #0a0b0e background without feeling harsh.
const LABEL_XML = `
                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="Handled." textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="${LABEL_ID}" userLabel="HandledLabel">
                                <rect key="frame" x="0.0" y="554.0" width="393" height="56"/>
                                <fontDescription key="fontDescription" name="Georgia-BoldItalic" family="Georgia" pointSize="42"/>
                                <color key="textColor" red="0.96" green="0.96" blue="0.94" alpha="1.0" colorSpace="custom" customColorSpace="sRGB"/>
                                <nil key="highlightedColor"/>
                            </label>`;

const CONSTRAINTS_XML = `
                            <constraint firstItem="${LABEL_ID}" firstAttribute="centerX" secondItem="EXPO-ContainerView" secondAttribute="centerX" id="HandledLabelCenterX"/>
                            <constraint firstItem="${LABEL_ID}" firstAttribute="top" secondItem="EXPO-SplashScreen" secondAttribute="bottom" constant="28" id="HandledLabelTop"/>
                            <constraint firstItem="${LABEL_ID}" firstAttribute="leading" secondItem="EXPO-ContainerView" secondAttribute="leading" constant="24" id="HandledLabelLeading"/>
                            <constraint firstItem="${LABEL_ID}" firstAttribute="trailing" secondItem="EXPO-ContainerView" secondAttribute="trailing" constant="-24" id="HandledLabelTrailing"/>`;

module.exports = function withHandledSplash(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const storyboardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Judith",
        "SplashScreen.storyboard",
      );

      if (!fs.existsSync(storyboardPath)) {
        // Storyboard doesn't exist yet — expo-splash-screen probably failed
        // to generate it. Don't error; just skip and let the build surface
        // the upstream problem.
        return cfg;
      }

      let xml = fs.readFileSync(storyboardPath, "utf8");

      // Idempotent guard — if we already injected, leave it alone.
      if (xml.includes(`id="${LABEL_ID}"`)) return cfg;

      // Need both anchors for the injection. If expo-splash-screen ever
      // changes its element ids, this no-ops gracefully.
      const subviewsClose = "</subviews>";
      const constraintsClose = "</constraints>";
      if (!xml.includes(subviewsClose) || !xml.includes(constraintsClose)) {
        return cfg;
      }

      xml = xml.replace(
        subviewsClose,
        LABEL_XML + "\n                        " + subviewsClose,
      );
      xml = xml.replace(
        constraintsClose,
        CONSTRAINTS_XML + "\n                        " + constraintsClose,
      );

      fs.writeFileSync(storyboardPath, xml);
      return cfg;
    },
  ]);
};
