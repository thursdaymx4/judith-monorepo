import Foundation
import WidgetKit

@objc(JudithWidgetBridge)
final class JudithWidgetBridge: NSObject {
    private enum Config {
        static let appGroupID = "group.com.app.judith"
        static let payloadCacheKey = "judith.payload_v2"
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        false
    }

    @objc(writePayload:)
    func writePayload(_ json: String) {
        guard let defaults = UserDefaults(suiteName: Config.appGroupID),
              let data = json.data(using: .utf8) else {
            NSLog("JudithWidgetBridge: failed to open app group defaults or encode payload")
            return
        }

        defaults.set(data, forKey: Config.payloadCacheKey)
        defaults.set(json, forKey: "\(Config.payloadCacheKey).string")
        defaults.synchronize()
        NSLog("JudithWidgetBridge: wrote payload (%d bytes) to app group %@", data.count, Config.appGroupID)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
