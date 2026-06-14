import AppIntents
import Foundation

// MARK: — Watch-side App Intents
// The Apple Watch Ultra Action Button can be bound to any AppIntent in
// Settings → Action Button → Shortcut. We expose a single intent that opens
// the watch app — the app reads a flag from the shared App Group on launch
// and snaps to the Ask tab.

private enum OpenAskFlag {
    static let key = "judith.openAskOnLaunch"
}

@available(watchOS 10.0, *)
struct OpenJudithAskWatchIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Judith"
    static var description = IntentDescription("Open Judith and start voice Ask.")
    /// Critical: must be `true` so tapping the Action Button launches the
    /// watch app instead of running the intent headlessly in the background.
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        if let defaults = UserDefaults(suiteName: Config.appGroupID) {
            defaults.set(true, forKey: OpenAskFlag.key)
        }
        return .result()
    }
}

@available(watchOS 10.0, *)
struct JudithWatchAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenJudithAskWatchIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "\(.applicationName), open ask",
                "Open \(.applicationName) ask"
            ],
            shortTitle: "Ask Judith",
            systemImageName: "mic.fill"
        )
    }
}

// MARK: — Launch-flag bridge
// ContentView observes `JudithLaunchFlags.shared.shouldOpenAsk` and snaps the
// tab selection to AskView when it flips to true. The flag is consumed once
// per launch — set back to false after handling so a second Action Button
// press in-app doesn't fight the user's manual navigation.

@MainActor
final class JudithLaunchFlags: ObservableObject {
    static let shared = JudithLaunchFlags()

    @Published private(set) var shouldOpenAsk: Bool = false

    private init() {
        refresh()
    }

    /// Re-read the App Group flag. Call on app launch and on `.active` scene
    /// transitions so an Action Button press while the watch app is in the
    /// background still snaps to Ask on resume.
    func refresh() {
        guard let defaults = UserDefaults(suiteName: Config.appGroupID) else { return }
        if defaults.bool(forKey: OpenAskFlag.key) {
            shouldOpenAsk = true
            defaults.set(false, forKey: OpenAskFlag.key)
        }
    }

    /// Called by ContentView after it routes to Ask, so the flag doesn't keep
    /// re-triggering on subsequent published-event cycles.
    func acknowledge() {
        shouldOpenAsk = false
    }
}
