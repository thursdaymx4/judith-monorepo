import BackgroundTasks
import ExpoModulesCore
import Foundation
import UIKit

/// AppDelegate subscriber that wires the Auto-pay BGTaskScheduler handler
/// at app launch.
///
/// `BGTaskScheduler.shared.register(...)` MUST be invoked synchronously from
/// `application(_:didFinishLaunchingWithOptions:)` — Apple's runtime emits a
/// "task identifier not registered before launch" warning + ignores any
/// task otherwise. Standard `Module` AsyncFunctions run AFTER launch, so
/// the registration can't live there. ExpoAppDelegateSubscriber gives us a
/// hook that fires at the right moment.
///
/// The registered launchHandler delegates to JudithWidgetBridgeModule's
/// static handler, which has access to the App Group UserDefaults snapshot
/// + FinanceKit + UNUserNotificationCenter. Everything FK / FoundationModels
/// stays inside the module file's existing `#if canImport(FinanceKit)`
/// guards so this subscriber file compiles cleanly on every iOS target.
public final class JudithWidgetBridgeAppDelegate: ExpoAppDelegateSubscriber {
    public static let autoPayBGTaskIdentifier = "com.app.judith.autopay-scan"

    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.autoPayBGTaskIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            JudithWidgetBridgeModule.handleAutoPayBGTask(refreshTask)
        }
        return true
    }
}
