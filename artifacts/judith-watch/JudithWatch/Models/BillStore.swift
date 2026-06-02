import Foundation
import Combine
import WidgetKit

// MARK: — Central data store (ObservableObject → injected as @EnvironmentObject)

@MainActor
final class BillStore: ObservableObject {

    // MARK: — Published state
    @Published var bills: [Bill] = []
    @Published var token: String? = nil
    @Published var isLoading = false
    @Published var error: String? = nil
    @Published var streak: Int = 0

    // MARK: — Shared App Group defaults
    private let defaults = UserDefaults(suiteName: Config.appGroupID)

    init() {
        loadCache()
        token = defaults?.string(forKey: Config.sessionTokenKey)
        streak = defaults?.integer(forKey: Config.streakKey) ?? 0
    }

    // MARK: — Sorted views

    var unpaidBills: [Bill] {
        bills
            .filter { $0.isUnpaid }
            .sorted {
                if $0.urgency != $1.urgency { return $0.urgency < $1.urgency }
                let d0 = $0.daysUntil ?? 9999
                let d1 = $1.daysUntil ?? 9999
                return d0 < d1
            }
    }

    var nextDueBill: Bill? { unpaidBills.first }

    var monthTotal: Double {
        bills.filter { $0.isUnpaid }.compactMap { $0.amount }.reduce(0, +)
    }

    var overdueCount: Int { bills.filter { $0.urgency == .overdue }.count }

    // MARK: — Token management

    func applyToken(_ newToken: String) {
        token = newToken
        defaults?.set(newToken, forKey: Config.sessionTokenKey)
        Task { await refresh() }
    }

    func signOut() {
        token = nil
        bills = []
        defaults?.removeObject(forKey: Config.sessionTokenKey)
        defaults?.removeObject(forKey: Config.billsCacheKey)
    }

    // MARK: — Fetch

    func refresh() async {
        guard let tok = token else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let fetched = try await SupabaseClient.shared.fetchBills(token: tok)
            applyBills(fetched)
            flushPendingActions()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func applyBills(_ newBills: [Bill]) {
        bills = newBills
        persistCache()
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: — Actions (optimistic + queued)

    func markPaid(bill: Bill) async {
        optimisticallyUpdate(billId: bill.id) { $0.status = "paid" }
        ConnectivityService.shared.sendMarkPaid(billId: bill.id)
        incrementStreak()

        guard let tok = token else {
            enqueue(.init(billId: bill.id, kind: .markPaid, date: Date()))
            return
        }
        do {
            try await SupabaseClient.shared.markPaid(billId: bill.id, token: tok)
        } catch {
            enqueue(.init(billId: bill.id, kind: .markPaid, date: Date()))
            self.error = error.localizedDescription
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    func snooze(bill: Bill) async {
        optimisticallyUpdate(billId: bill.id) { $0.status = "snoozed" }
        ConnectivityService.shared.sendSnooze(billId: bill.id)

        guard let tok = token else {
            enqueue(.init(billId: bill.id, kind: .snooze, date: Date()))
            return
        }
        do {
            try await SupabaseClient.shared.snooze(billId: bill.id, token: tok)
        } catch {
            enqueue(.init(billId: bill.id, kind: .snooze, date: Date()))
            self.error = error.localizedDescription
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: — Private helpers

    private func optimisticallyUpdate(billId: String, mutation: (inout Bill) -> Void) {
        if let idx = bills.firstIndex(where: { $0.id == billId }) {
            mutation(&bills[idx])
            persistCache()
        }
    }

    private func persistCache() {
        if let data = try? JSONEncoder().encode(bills) {
            defaults?.set(data, forKey: Config.billsCacheKey)
        }
    }

    private func loadCache() {
        guard let data = defaults?.data(forKey: Config.billsCacheKey),
              let cached = try? JSONDecoder().decode([Bill].self, from: data) else { return }
        bills = cached
    }

    // MARK: — Offline queue

    private func enqueue(_ action: PendingAction) {
        var queue = loadQueue()
        queue.append(action)
        if let data = try? JSONEncoder().encode(queue) {
            defaults?.set(data, forKey: Config.pendingActionsKey)
        }
    }

    private func loadQueue() -> [PendingAction] {
        guard let data = defaults?.data(forKey: Config.pendingActionsKey),
              let queue = try? JSONDecoder().decode([PendingAction].self, from: data) else {
            return []
        }
        return queue
    }

    private func flushPendingActions() {
        let queue = loadQueue()
        guard !queue.isEmpty, let tok = token else { return }
        defaults?.removeObject(forKey: Config.pendingActionsKey)
        Task {
            for action in queue {
                try? await action.kind == .markPaid
                    ? SupabaseClient.shared.markPaid(billId: action.billId, token: tok)
                    : SupabaseClient.shared.snooze(billId: action.billId, token: tok)
            }
        }
    }

    // MARK: — Streak

    private func incrementStreak() {
        streak += 1
        defaults?.set(streak, forKey: Config.streakKey)
    }
}
