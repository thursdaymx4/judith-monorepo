import ExpoModulesCore
import WidgetKit

public final class JudithWidgetBridgeModule: Module {
    private enum Config {
        static let appGroupID = "group.com.app.judith"
        static let payloadCacheKey = "judith.payload_v2"
    }

    public func definition() -> ModuleDefinition {
        Name("JudithWidgetBridge")

        Function("writePayload") { (json: String) in
            guard let defaults = UserDefaults(suiteName: Config.appGroupID),
                  let data = json.data(using: .utf8) else {
                return
            }

            defaults.set(data, forKey: Config.payloadCacheKey)
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
