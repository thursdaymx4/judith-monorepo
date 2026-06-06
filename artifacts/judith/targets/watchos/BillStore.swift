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
