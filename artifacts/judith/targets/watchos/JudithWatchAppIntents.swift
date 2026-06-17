import AppIntents
import Foundation

// MARK: — Watch-side App Intents
// The Apple Watch Ultra Action Button can be bound to any AppIntent in
// Settings → Action Button → Shortcut. These intents mirror the phone's
// read-oriented Siri shortcuts where the watch has enough local payload data.

private enum OpenAskFlag {
    static let key = "judith.openAskOnLaunch"
}

private enum WatchAskAccessConfig {
    static let key = "judith.ask_access_v1"
}

@available(watchOS 10.0, *)
private struct JudithWatchAskAccess: Codable {
    let tier: String
    let asksLeft: Int
}

@available(watchOS 10.0, *)
private enum JudithWatchIntentAccessGate {
    static let lockedDialog: IntentDialog = "You are out of free asks in Judith. Open Judith on your iPhone and choose a plan to keep asking."

    static var canAnswer: Bool {
        guard let defaults = UserDefaults(suiteName: Config.appGroupID),
              let data = defaults.data(forKey: WatchAskAccessConfig.key),
              let access = try? JSONDecoder().decode(JudithWatchAskAccess.self, from: data)
        else { return true }
        return access.tier != "free" || access.asksLeft > 0
    }
}

@available(watchOS 10.0, *)
private enum JudithWatchIntentPayloadStore {
    static func load() -> WatchPayload? {
        guard let defaults = UserDefaults(suiteName: Config.appGroupID),
              let data = defaults.data(forKey: Config.payloadCacheKey),
              let payload = try? JSONDecoder().decode(WatchPayload.self, from: data)
        else { return nil }
        return payload
    }

    static var bills: [JudithWatchBillEntity] {
        guard let payload = load() else { return [] }
        return payload.upcomingBills.map { bill in
            JudithWatchBillEntity(
                id: bill.id,
                provider: bill.provider,
                amount: bill.amount,
                currency: payload.currency,
                dueDays: bill.dueDays,
                dueLabel: bill.dueLabel,
                isOverdue: bill.isOverdue
            )
        }
    }
}

@available(watchOS 10.0, *)
struct JudithWatchBillEntity: AppEntity, Identifiable, Hashable {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Bill")
    static var defaultQuery = JudithWatchBillEntityQuery()

    let id: String
    let provider: String
    let amount: Double
    let currency: String
    let dueDays: Int
    let dueLabel: String
    let isOverdue: Bool

    var dueText: String {
        if dueDays == 0 { return "due today" }
        if dueDays == 1 { return "due tomorrow" }
        if dueDays < 0 { return "\(-dueDays) days overdue" }
        return "due in \(dueDays) days"
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(provider)",
            subtitle: "\(currency)\(amount.formattedForJudithWatchIntent) • \(dueText)"
        )
    }
}

@available(watchOS 10.0, *)
struct JudithWatchBillEntityQuery: EntityStringQuery {
    func entities(for identifiers: [JudithWatchBillEntity.ID]) async throws -> [JudithWatchBillEntity] {
        JudithWatchIntentPayloadStore.bills.filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [JudithWatchBillEntity] {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return JudithWatchIntentPayloadStore.bills }
        return JudithWatchIntentPayloadStore.bills.filter {
            $0.provider.localizedCaseInsensitiveContains(trimmed) ||
            trimmed.localizedCaseInsensitiveContains($0.provider) ||
            $0.dueLabel.localizedCaseInsensitiveContains(trimmed) ||
            $0.dueText.localizedCaseInsensitiveContains(trimmed)
        }
    }

    func suggestedEntities() async throws -> [JudithWatchBillEntity] {
        Array(JudithWatchIntentPayloadStore.bills.prefix(8))
    }
}

@available(watchOS 10.0, *)
enum JudithWatchDueWindow: String, AppEnum {
    case today
    case week
    case month
    case overdue

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Due Window")

    static var caseDisplayRepresentations: [JudithWatchDueWindow: DisplayRepresentation] = [
        .today: "Today",
        .week: "This Week",
        .month: "This Month",
        .overdue: "Overdue"
    ]

    var title: String {
        switch self {
        case .today: return "today"
        case .week: return "this week"
        case .month: return "this month"
        case .overdue: return "overdue"
        }
    }

    func includes(_ bill: JudithWatchBillEntity) -> Bool {
        switch self {
        case .today:
            return bill.dueDays == 0
        case .week:
            return bill.dueDays >= 0 && bill.dueDays <= 7
        case .month:
            return true
        case .overdue:
            return bill.dueDays < 0 || bill.isOverdue
        }
    }
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
struct QueryJudithWatchBillsDueIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Bills Due"
    static var description = IntentDescription("Ask Judith which bills are due today, this week, this month, or overdue.")
    static var openAppWhenRun = false

    @Parameter(title: "When")
    var window: JudithWatchDueWindow

    init() {
        self.window = .week
    }

    init(window: JudithWatchDueWindow) {
        self.window = window
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard JudithWatchIntentAccessGate.canAnswer else {
            return .result(dialog: JudithWatchIntentAccessGate.lockedDialog)
        }
        guard JudithWatchIntentPayloadStore.load() != nil else {
            return .result(dialog: "Judith does not have your latest bills yet. Open Judith once to sync your bills.")
        }

        let bills = JudithWatchIntentPayloadStore.bills
            .filter { window.includes($0) }
            .sorted { $0.dueDays == $1.dueDays ? $0.provider < $1.provider : $0.dueDays < $1.dueDays }

        guard !bills.isEmpty else {
            return .result(dialog: "You have no bills \(window.title) in Judith.")
        }

        let prefix = bills.count == 1
            ? "You have 1 bill \(window.title): "
            : "You have \(bills.count) bills \(window.title): "
        let summary = bills.prefix(5).map {
            "\($0.provider), \($0.currency)\($0.amount.formattedForJudithWatchIntent), \($0.dueText)"
        }.joined(separator: "; ")
        let suffix = bills.count > 5 ? "; and \(bills.count - 5) more." : "."
        return .result(dialog: "\(prefix)\(summary)\(suffix)")
    }
}

@available(watchOS 10.0, *)
struct QueryJudithWatchMonthlyTotalIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Monthly Bill Total"
    static var description = IntentDescription("Ask Judith how much is still unpaid this month.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard JudithWatchIntentAccessGate.canAnswer else {
            return .result(dialog: JudithWatchIntentAccessGate.lockedDialog)
        }
        guard let payload = JudithWatchIntentPayloadStore.load() else {
            return .result(dialog: "Judith does not have your latest bills yet. Open Judith once to sync your bills.")
        }

        if payload.unpaidCount == 0 {
            return .result(dialog: "You have no unpaid bills this month in Judith.")
        }

        let amount = "\(payload.currency)\(payload.totalOwed.formattedForJudithWatchIntent)"
        let billWord = payload.unpaidCount == 1 ? "bill" : "bills"
        return .result(dialog: "You still owe \(amount) across \(payload.unpaidCount) unpaid \(billWord) this month.")
    }
}

@available(watchOS 10.0, *)
struct QueryJudithWatchOverdueIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Overdue Bills"
    static var description = IntentDescription("Ask Judith which bills are overdue.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await QueryJudithWatchBillsDueIntent(window: .overdue).perform()
    }
}

@available(watchOS 10.0, *)
struct QueryJudithWatchNextBillIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Next Bill"
    static var description = IntentDescription("Ask Judith which bill is due next.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard JudithWatchIntentAccessGate.canAnswer else {
            return .result(dialog: JudithWatchIntentAccessGate.lockedDialog)
        }
        guard let next = JudithWatchIntentPayloadStore.bills.sorted(by: { $0.dueDays < $1.dueDays }).first else {
            return .result(dialog: "You do not have any upcoming unpaid bills in Judith.")
        }

        return .result(
            dialog: "Your next bill is \(next.provider) for \(next.currency)\(next.amount.formattedForJudithWatchIntent), \(next.dueText)."
        )
    }
}

@available(watchOS 10.0, *)
struct QueryJudithWatchBillIntent: AppIntent {
    static var title: LocalizedStringResource = "Check a Bill"
    static var description = IntentDescription("Ask Judith about a specific tracked bill.")
    static var openAppWhenRun = false

    @Parameter(title: "Bill")
    var bill: JudithWatchBillEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard JudithWatchIntentAccessGate.canAnswer else {
            return .result(dialog: JudithWatchIntentAccessGate.lockedDialog)
        }
        return .result(
            dialog: "\(bill.provider) is \(bill.currency)\(bill.amount.formattedForJudithWatchIntent), \(bill.dueText)."
        )
    }
}

@available(watchOS 10.0, *)
struct MarkJudithWatchBillPaidIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark Bill Paid"
    static var description = IntentDescription("Mark a Judith bill paid from your watch.")
    static var openAppWhenRun = false

    @Parameter(title: "Bill")
    var bill: JudithWatchBillEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard JudithWatchIntentAccessGate.canAnswer else {
            return .result(dialog: JudithWatchIntentAccessGate.lockedDialog)
        }
        ConnectivityService.shared.sendMarkPaid(billId: bill.id)
        return .result(dialog: "Okay, I marked \(bill.provider) as paid in Judith.")
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
            // Watch-side shortTitle is intentionally suffixed so the Apple
            // Watch Action Button picker distinguishes this watchOS intent
            // from the iOS OpenJudithAskIntent. Both apps share the
            // "Judith" name, so without this the picker rows are identical
            // and users bind the wrong one (which opens the phone app
            // instead of the watch app).
            shortTitle: "Ask Judith using Watch",
            systemImageName: "mic.fill"
        )

        AppShortcut(
            intent: QueryJudithWatchBillsDueIntent(window: .week),
            phrases: [
                "\(.applicationName) bills this week",
                "\(.applicationName), what's due this week",
                "Ask \(.applicationName) what's due this week"
            ],
            shortTitle: "Bills Due",
            systemImageName: "calendar.badge.clock"
        )

        AppShortcut(
            intent: QueryJudithWatchOverdueIntent(),
            phrases: [
                "\(.applicationName) overdue bills",
                "\(.applicationName), what's overdue",
                "Ask \(.applicationName) what's overdue"
            ],
            shortTitle: "Overdue Bills",
            systemImageName: "exclamationmark.circle"
        )

        AppShortcut(
            intent: QueryJudithWatchMonthlyTotalIntent(),
            phrases: [
                "\(.applicationName) monthly total",
                "\(.applicationName), how much do I owe",
                "\(.applicationName), how much is my total bill for this month",
                "Ask \(.applicationName) how much I owe this month",
                "Ask \(.applicationName) how much is my total bill for this month"
            ],
            shortTitle: "Monthly Total",
            systemImageName: "sum"
        )

        AppShortcut(
            intent: QueryJudithWatchNextBillIntent(),
            phrases: [
                "\(.applicationName) next bill",
                "\(.applicationName), what's my next bill",
                "Ask \(.applicationName) when my next bill is due"
            ],
            shortTitle: "Next Bill",
            systemImageName: "arrow.forward.circle"
        )

        AppShortcut(
            intent: QueryJudithWatchBillIntent(),
            phrases: [
                "\(.applicationName) my \(\.$bill) bill",
                "\(.applicationName), what's my \(\.$bill) bill",
                "\(.applicationName), how much is my bill for my \(\.$bill)",
                "Ask \(.applicationName) about my \(\.$bill) bill",
                "Ask \(.applicationName) how much my \(\.$bill) bill is",
                "\(.applicationName) bill details"
            ],
            shortTitle: "Check a Bill",
            systemImageName: "doc.text.magnifyingglass"
        )

        AppShortcut(
            intent: MarkJudithWatchBillPaidIntent(),
            phrases: [
                "\(.applicationName) mark \(\.$bill) as paid",
                "\(.applicationName), I paid \(\.$bill)",
                "Tell \(.applicationName) I paid \(\.$bill)",
                "\(.applicationName) mark a bill paid"
            ],
            shortTitle: "Mark Paid",
            systemImageName: "checkmark.circle"
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

private extension Double {
    var formattedForJudithWatchIntent: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: self)) ?? String(format: "%.0f", self)
    }
}
