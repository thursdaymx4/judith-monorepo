const { IOSConfig, withDangerousMod, withXcodeProject } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SWIFT_FILE_NAME = "JudithAppIntents.swift";
const TEMPLATE_PATH = path.join(__dirname, "app-intents", SWIFT_FILE_NAME);

function hasProjectFile(project, fileName) {
  const fileReferences = project.pbxFileReferenceSection();
  return Object.values(fileReferences).some((entry) => {
    return entry && typeof entry === "object" && entry.path === fileName;
  });
}

module.exports = function withJudithAppIntents(config) {
  config = withDangerousMod(config, [
    "ios",
    (cfg) => {
      const destinationPath = path.join(
        cfg.modRequest.platformProjectRoot,
        SWIFT_FILE_NAME,
      );
      fs.copyFileSync(TEMPLATE_PATH, destinationPath);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    if (hasProjectFile(project, SWIFT_FILE_NAME)) {
      return cfg;
    }

    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    // expo-config-plugins ≥ 8 expects an object — calling with the raw project
    // throws "Cannot read properties of undefined (reading 'getTarget')" under
    // `expo prebuild --clean` when no JudithAppIntents.swift entry exists yet.
    const target = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project,
      projectName,
    });

    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: SWIFT_FILE_NAME,
      groupName: projectName,
      project,
      targetUuid: target.uuid,
      verbose: true,
    });

    return cfg;
  });

  return config;
};
