import AppIntents
import Foundation

@available(iOS 16.0, *)
private enum JudithIntentsConfig {
    static let appGroupID = "group.com.app.judith"
    static let payloadCacheKey = "judith.payload_v2"
    static let intentCommandsKey = "judith.intent_commands_v1"
}

@available(iOS 16.0, *)
private struct JudithIntentBill: Codable, Identifiable, Hashable {
    let id: String
    let provider: String
    let amount: Double
    let dueDays: Int
    let dueLabel: String
    let isOverdue: Bool
    let optimisticTotalOwedDelta: Double?
    let optimisticUnpaidCountDelta: Int?

    var dueText: String {
        if dueDays == 0 { return "due today" }
        if dueDays == 1 { return "due tomorrow" }
        if dueDays < 0 { return "\(-dueDays) days overdue" }
        return "due in \(dueDays) days"
    }

    func amountText(currency: String) -> String {
        "\(currency)\(amount.formattedForJudithIntent)"
    }
}

@available(iOS 16.0, *)
private struct JudithIntentPayload: Codable {
    let generatedAt: String
    let currency: String
    let totalOwed: Double
    let unpaidCount: Int
    let nextProvider: String
    let nextAmount: Double
    let nextDueDays: Int
    let nextDueLabel: String
    let persona: String
    let upcomingBills: [JudithIntentBill]
    let paidCount: Int
    let totalCount: Int
}

@available(iOS 16.0, *)
private enum JudithPayloadStore {
    static func load() -> JudithIntentPayload? {
        guard let defaults = UserDefaults(suiteName: JudithIntentsConfig.appGroupID) else {
            return nil
        }

        if let data = defaults.data(forKey: JudithIntentsConfig.payloadCacheKey),
           let payload = try? JSONDecoder().decode(JudithIntentPayload.self, from: data) {
            return payload
        }

        if let json = defaults.string(forKey: "\(JudithIntentsConfig.payloadCacheKey).string"),
           let data = json.data(using: .utf8),
           let payload = try? JSONDecoder().decode(JudithIntentPayload.self, from: data) {
            return payload
        }

        return nil
    }

    static var bills: [JudithBillEntity] {
        guard let payload = load() else { return [] }
        return payload.upcomingBills.map { bill in
            JudithBillEntity(
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

@available(iOS 16.0, *)
private struct JudithIntentCommand: Codable, Identifiable {
    let id: String
    let type: String
    let createdAt: String
    let billId: String?
    let provider: String?
    let amount: Double?
    let dueDay: Int?
    let category: String?
    let days: Int?

    static func make(
        type: String,
        billId: String? = nil,
        provider: String? = nil,
        amount: Double? = nil,
        dueDay: Int? = nil,
        category: String? = nil,
        days: Int? = nil
    ) -> JudithIntentCommand {
        JudithIntentCommand(
            id: UUID().uuidString,
            type: type,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            billId: billId,
            provider: provider,
            amount: amount,
            dueDay: dueDay,
            category: category,
            days: days
        )
    }
}

@available(iOS 16.0, *)
private enum JudithIntentCommandQueue {
    static func enqueue(_ command: JudithIntentCommand) {
        guard let defaults = UserDefaults(suiteName: JudithIntentsConfig.appGroupID) else {
            return
        }

        let existing: [JudithIntentCommand]
        if let data = defaults.data(forKey: JudithIntentsConfig.intentCommandsKey),
           let decoded = try? JSONDecoder().decode([JudithIntentCommand].self, from: data) {
            existing = decoded
        } else {
            existing = []
        }

        let commands = (existing + [command]).suffix(50)
        if let data = try? JSONEncoder().encode(Array(commands)) {
            defaults.set(data, forKey: JudithIntentsConfig.intentCommandsKey)
        }
    }
}

@available(iOS 16.0, *)
struct JudithBillEntity: AppEntity, Identifiable, Hashable {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Bill")
    static var defaultQuery = JudithBillEntityQuery()

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
            subtitle: "\(currency)\(amount.formattedForJudithIntent) • \(dueText)"
        )
    }
}

@available(iOS 16.0, *)
struct JudithBillEntityQuery: EntityStringQuery {
    func entities(for identifiers: [JudithBillEntity.ID]) async throws -> [JudithBillEntity] {
        JudithPayloadStore.bills.filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [JudithBillEntity] {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return JudithPayloadStore.bills
        }
        return JudithPayloadStore.bills.filter {
            $0.provider.localizedCaseInsensitiveContains(trimmed) ||
            $0.dueLabel.localizedCaseInsensitiveContains(trimmed) ||
            $0.dueText.localizedCaseInsensitiveContains(trimmed)
        }
    }

    func suggestedEntities() async throws -> [JudithBillEntity] {
        Array(JudithPayloadStore.bills.prefix(8))
    }
}

@available(iOS 16.0, *)
enum JudithDueWindow: String, AppEnum {
    case today
    case week
    case month
    case overdue

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Due Window")

    static var caseDisplayRepresentations: [JudithDueWindow: DisplayRepresentation] = [
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

    func includes(_ bill: JudithBillEntity) -> Bool {
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

@available(iOS 16.0, *)
struct QueryJudithBillsDueIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Bills Due"
    static var description = IntentDescription("Ask Judith which bills are due today, this week, this month, or overdue.")
    static var openAppWhenRun = false

    @Parameter(title: "When")
    var window: JudithDueWindow

    init() {
        self.window = .week
    }

    init(window: JudithDueWindow) {
        self.window = window
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard JudithPayloadStore.load() != nil else {
            return .result(dialog: "Judith does not have your latest bills yet. Open Judith once to sync your bills.")
        }

        let bills = JudithPayloadStore.bills
            .filter { window.includes($0) }
            .sorted { $0.dueDays == $1.dueDays ? $0.provider < $1.provider : $0.dueDays < $1.dueDays }

        guard !bills.isEmpty else {
            return .result(dialog: "You have no bills \(window.title) in Judith.")
        }

        let prefix: String
        if bills.count == 1 {
            prefix = "You have 1 bill \(window.title): "
        } else {
            prefix = "You have \(bills.count) bills \(window.title): "
        }

        let summary = bills.prefix(5).map {
            "\($0.provider), \($0.currency)\($0.amount.formattedForJudithIntent), \($0.dueText)"
        }.joined(separator: "; ")

        let suffix = bills.count > 5 ? "; and \(bills.count - 5) more." : "."
        return .result(dialog: "\(prefix)\(summary)\(suffix)")
    }
}

@available(iOS 16.0, *)
struct QueryJudithMonthlyTotalIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Monthly Bill Total"
    static var description = IntentDescription("Ask Judith how much is still unpaid this month.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let payload = JudithPayloadStore.load() else {
            return .result(dialog: "Judith does not have your latest bills yet. Open Judith once to sync your bills.")
        }

        if payload.unpaidCount == 0 {
            return .result(dialog: "You have no unpaid bills this month in Judith.")
        }

        let amount = "\(payload.currency)\(payload.totalOwed.formattedForJudithIntent)"
        let billWord = payload.unpaidCount == 1 ? "bill" : "bills"
        return .result(dialog: "You still owe \(amount) across \(payload.unpaidCount) unpaid \(billWord) this month.")
    }
}

@available(iOS 16.0, *)
struct QueryJudithOverdueIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Overdue Bills"
    static var description = IntentDescription("Ask Judith which bills are overdue.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await QueryJudithBillsDueIntent(window: .overdue).perform()
    }
}

@available(iOS 16.0, *)
struct QueryJudithNextBillIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Next Bill"
    static var description = IntentDescription("Ask Judith which bill is due next.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let next = JudithPayloadStore.bills.sorted(by: { $0.dueDays < $1.dueDays }).first else {
            return .result(dialog: "You do not have any upcoming unpaid bills in Judith.")
        }

        return .result(
            dialog: "Your next bill is \(next.provider) for \(next.currency)\(next.amount.formattedForJudithIntent), \(next.dueText)."
        )
    }
}

@available(iOS 16.0, *)
struct QueryJudithBillIntent: AppIntent {
    static var title: LocalizedStringResource = "Check a Bill"
    static var description = IntentDescription("Ask Judith about a specific tracked bill.")
    static var openAppWhenRun = false

    @Parameter(title: "Bill")
    var bill: JudithBillEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(
            dialog: "\(bill.provider) is \(bill.currency)\(bill.amount.formattedForJudithIntent), \(bill.dueText)."
        )
    }
}

@available(iOS 16.0, *)
struct MarkJudithBillPaidIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark Bill Paid"
    static var description = IntentDescription("Mark a Judith bill paid from Shortcuts.")
    static var openAppWhenRun = false

    @Parameter(title: "Bill")
    var bill: JudithBillEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        JudithIntentCommandQueue.enqueue(.make(type: "markPaid", billId: bill.id))
        return .result(dialog: "Okay, I marked \(bill.provider) as paid in Judith.")
    }
}

@available(iOS 16.0, *)
struct SnoozeJudithBillIntent: AppIntent {
    static var title: LocalizedStringResource = "Snooze Bill Reminder"
    static var description = IntentDescription("Snooze a Judith bill reminder by a number of days.")
    static var openAppWhenRun = false

    @Parameter(title: "Bill")
    var bill: JudithBillEntity

    @Parameter(title: "Days")
    var days: Int

    init() {
        self.days = 1
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let safeDays = max(1, min(days, 30))
        JudithIntentCommandQueue.enqueue(.make(type: "snooze", billId: bill.id, days: safeDays))
        return .result(dialog: "Okay, I snoozed \(bill.provider) for \(safeDays) day\(safeDays == 1 ? "" : "s") in Judith.")
    }
}

@available(iOS 16.0, *)
struct UpdateJudithBillAmountIntent: AppIntent {
    static var title: LocalizedStringResource = "Update Bill Amount"
    static var description = IntentDescription("Update the amount for a Judith bill.")
    static var openAppWhenRun = false

    @Parameter(title: "Bill")
    var bill: JudithBillEntity

    @Parameter(title: "Amount")
    var amount: Double

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let safeAmount = max(0, amount)
        JudithIntentCommandQueue.enqueue(.make(type: "updateAmount", billId: bill.id, amount: safeAmount))
        return .result(dialog: "Okay, I updated \(bill.provider) to \(bill.currency)\(safeAmount.formattedForJudithIntent) in Judith.")
    }
}

@available(iOS 16.0, *)
struct AddJudithBillIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Bill"
    static var description = IntentDescription("Add a basic monthly bill to Judith.")
    static var openAppWhenRun = false

    @Parameter(title: "Provider")
    var provider: String

    @Parameter(title: "Amount")
    var amount: Double

    @Parameter(title: "Due Day")
    var dueDay: Int

    @Parameter(title: "Category")
    var category: String

    init() {
        self.provider = ""
        self.amount = 0
        self.dueDay = 1
        self.category = "Custom"
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let cleanProvider = provider.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanProvider.isEmpty else {
            return .result(dialog: "I need a provider name before I can add that bill to Judith.")
        }

        let safeAmount = max(0, amount)
        let safeDueDay = max(1, min(dueDay, 31))
        let cleanCategory = category.trimmingCharacters(in: .whitespacesAndNewlines)
        JudithIntentCommandQueue.enqueue(
            .make(
                type: "addBill",
                provider: cleanProvider,
                amount: safeAmount,
                dueDay: safeDueDay,
                category: cleanCategory.isEmpty ? "Custom" : cleanCategory
            )
        )

        return .result(dialog: "Okay, I added \(cleanProvider) for \(safeAmount.formattedForJudithIntent), due every \(safeDueDay), to Judith.")
    }
}

@available(iOS 16.0, *)
struct OpenJudithAskIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Judith"
    static var description = IntentDescription("Open Judith and start the voice Ask flow.")
    /// Hooked up to the iPhone/Apple Watch Action Button so a single press
    /// launches Judith straight into voice input — no taps to reach the mic.
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        JudithIntentCommandQueue.enqueue(.make(type: "openAsk"))
        return .result()
    }
}

@available(iOS 16.0, *)
struct JudithAppShortcuts: AppShortcutsProvider {
    @AppShortcutsBuilder
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenJudithAskIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "\(.applicationName), open ask",
                "Open ask in \(.applicationName)"
            ],
            shortTitle: "Ask Judith",
            systemImageName: "mic.fill"
        )

        AppShortcut(
            intent: QueryJudithBillsDueIntent(window: .week),
            phrases: [
                "\(.applicationName) bills this week",
                "\(.applicationName), what's due this week",
                "Ask \(.applicationName) what's due this week"
            ],
            shortTitle: "Bills Due",
            systemImageName: "calendar.badge.clock"
        )

        AppShortcut(
            intent: QueryJudithOverdueIntent(),
            phrases: [
                "\(.applicationName) overdue bills",
                "\(.applicationName), what's overdue",
                "Ask \(.applicationName) what's overdue"
            ],
            shortTitle: "Overdue Bills",
            systemImageName: "exclamationmark.circle"
        )

        AppShortcut(
            intent: QueryJudithMonthlyTotalIntent(),
            phrases: [
                "\(.applicationName) monthly total",
                "\(.applicationName), how much do I owe",
                "Ask \(.applicationName) how much I owe this month"
            ],
            shortTitle: "Monthly Total",
            systemImageName: "sum"
        )

        AppShortcut(
            intent: QueryJudithNextBillIntent(),
            phrases: [
                "\(.applicationName) next bill",
                "\(.applicationName), what's my next bill",
                "Ask \(.applicationName) when my next bill is due"
            ],
            shortTitle: "Next Bill",
            systemImageName: "arrow.forward.circle"
        )

        AppShortcut(
            intent: QueryJudithBillIntent(),
            phrases: [
                "\(.applicationName) my \(\.$bill) bill",
                "\(.applicationName), what's my \(\.$bill) bill",
                "Ask \(.applicationName) about my \(\.$bill) bill",
                "\(.applicationName) bill details"
            ],
            shortTitle: "Check a Bill",
            systemImageName: "doc.text.magnifyingglass"
        )

        AppShortcut(
            intent: MarkJudithBillPaidIntent(),
            phrases: [
                "\(.applicationName) mark \(\.$bill) as paid",
                "\(.applicationName), I paid \(\.$bill)",
                "Tell \(.applicationName) I paid \(\.$bill)",
                "\(.applicationName) mark a bill paid"
            ],
            shortTitle: "Mark Paid",
            systemImageName: "checkmark.circle"
        )

        AppShortcut(
            intent: SnoozeJudithBillIntent(),
            phrases: [
                "\(.applicationName) snooze \(\.$bill)",
                "\(.applicationName), remind me about \(\.$bill) later",
                "\(.applicationName) snooze a bill"
            ],
            shortTitle: "Snooze Bill",
            systemImageName: "bell.slash"
        )

        AppShortcut(
            intent: UpdateJudithBillAmountIntent(),
            phrases: [
                "\(.applicationName) update \(\.$bill) amount",
                "\(.applicationName), change \(\.$bill) amount",
                "\(.applicationName) update a bill amount"
            ],
            shortTitle: "Update Amount",
            systemImageName: "pencil.circle"
        )

        AppShortcut(
            intent: AddJudithBillIntent(),
            phrases: [
                "\(.applicationName) add a bill",
                "\(.applicationName), track a new bill",
                "Tell \(.applicationName) to add a bill"
            ],
            shortTitle: "Add Bill",
            systemImageName: "plus.circle"
        )
    }
}

private extension Double {
    var formattedForJudithIntent: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: self)) ?? String(format: "%.0f", self)
    }
}
