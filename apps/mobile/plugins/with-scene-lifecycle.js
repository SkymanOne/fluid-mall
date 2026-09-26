// The iOS 27 SDK traps at launch unless the app adopts the UIScene life cycle.
// Expo SDK 57 ships ExpoAppSceneDelegate but its prebuild template does not use it yet.
// ponytail: delete this plugin once the Expo SDK template adopts scenes (SDK 58)
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return config;
  });

  return withAppDelegate(config, (config) => {
    const contents = config.modResults.contents
      .replace(
        "class AppDelegate: ExpoAppDelegate {",
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      )
      // The scene delegate creates the window and starts React Native
      .replace(/#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow[\s\S]*?#endif\n/, "");
    if (!contents.includes("ExpoReactNativeFactoryProvider") || contents.includes("UIScreen.main.bounds")) {
      throw new Error("with-scene-lifecycle: AppDelegate template changed, update the plugin");
    }
    config.modResults.contents = contents;
    return config;
  });
};
