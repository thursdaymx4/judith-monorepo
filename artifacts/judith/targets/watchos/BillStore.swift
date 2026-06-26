import Foundation
import Combine
import WidgetKit

// MARK: — WatchStore: central data store for the Watch app
// Holds the latest WatchPayload pushed from the phone.
// Bills never live on the Watch — they are summaries computed phone-side.

@MainActor
final class WatchStore: ObservableObject {

    // MARK: — Published state

    @Published var payload: WatchPayload? = nil
    @Published var streak: Int = 0

    private let defaults = UserDefaults(suiteName: Config.appGroupID)

    init() {
        loadCache()
        streak = defaults?.integer(forKey: Config.streakKey) ?? 0
    }

    // MARK: — Derived views

    var isReady: Bool      { payload != nil }
    var currency: String   { payload?.currency ?? "$" }
    var upcomingBills: [UpcomingBill] { payload?.upcomingBills ?? [] }
    var totalOwed: Double  { payload?.totalOwed ?? 0 }
    var unpaidCount: Int   { payload?.unpaidCount ?? 0 }
    var paidCount: Int     { payload?.paidCount  ?? 0 }
    var totalCount: Int    { payload?.totalCount  ?? 0 }
    /// Mirrors the phone Home screen — amount-based when the payload provides
    /// `paidAmount`, otherwise falls back to count-based for older cached payloads.
    var paidFraction: Double {
        if let fraction = payload?.paidFractionByAmount {
            return fraction
        }
        guard totalCount > 0 else { return 0 }
        return Double(paidCount) / Double(totalCount)
    }

    /// Whole-percent display for "X% paid" labels.
    var paidPct: Int {
        Int((paidFraction * 100).rounded())
    }

    var overdueCount: Int { payload?.overdueCount ?? 0 }
    var overdueTotal: Double { payload?.overdueTotal ?? 0 }
    var next7Total: Double { payload?.next7Total ?? 0 }
    var calendarMonthLabel: String { payload?.calendarMonthLabel ?? "This month" }
    var calendarMonthTotal: Double { payload?.calendarMonthTotal ?? totalOwed }
    var calendarThisWeekCount: Int { payload?.calendarThisWeekCount ?? 0 }
    var calendarDays: [CalendarDaySummary] { payload?.calendarDays ?? [] }
    var calendarWeeks: [CalendarWeekSummary] { payload?.calendarWeeks ?? [] }

    var lastSyncDate: Date? {
        guard let generatedAt = payload?.generatedAt else { return nil }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractionalFormatter.date(from: generatedAt) ?? ISO8601DateFormatter().date(from: generatedAt)
    }

    var isPayloadStale: Bool {
        guard let lastSyncDate else { return true }
        return Date().timeIntervalSince(lastSyncDate) > 6 * 60 * 60
    }

    var lastSyncLabel: String {
        guard let lastSyncDate else { return "Not synced yet" }
        let minutes = max(0, Int(Date().timeIntervalSince(lastSyncDate) / 60))
        if minutes < 1 { return "Synced just now" }
        if minutes < 60 { return "Synced \(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "Synced \(hours)h ago" }
        return "Synced \(hours / 24)d ago"
    }

    // MARK: — Apply incoming payload

    func applyPayload(_ p: WatchPayload) {
        payload = p
        persistCache(p)
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: — Optimistic mark-paid (removes bill from list immediately while
    //         the phone processes the action and pushes a fresh payload)

    func optimisticallyMarkPaid(billId: String) {
        guard let current = payload else { return }
        payload = current.removing(billId: billId)
        if let updated = payload { persistCache(updated) }
        WidgetCenter.shared.reloadAllTimelines()
        incrementStreak()
    }

    // MARK: — Persistence (App Group — shared with widget extension)

    private func persistCache(_ p: WatchPayload) {
        if let data = try? JSONEncoder().encode(p) {
            defaults?.set(data, forKey: Config.payloadCacheKey)
        }
    }

    private func loadCache() {
        guard let data = defaults?.data(forKey: Config.payloadCacheKey),
              let p    = try? JSONDecoder().decode(WatchPayload.self, from: data)
        else { return }
        payload = p
    }

    // MARK: — Streak

    func incrementStreak() {
        streak += 1
        defaults?.set(streak, forKey: Config.streakKey)
    }
}
