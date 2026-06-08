import WidgetKit
import SwiftUI

// MARK: — Timeline entry

struct JudithEntry: TimelineEntry {
    let date: Date
    let currency: String
    let nextBill: UpcomingBill?
    let upcomingBills: [UpcomingBill]   // for Medium / Large families
    let unpaidCount: Int
    let totalOwed: Double
    let relevance: TimelineEntryRelevance?
    let debugState: String?

    static let placeholder = JudithEntry(
        date: Date(),
        currency: "₱",
        nextBill: UpcomingBill(
            id: "demo",
            provider: "Netflix",
            amount: 499,
            dueDays: 3,
            dueLabel: "in 3 days",
            isOverdue: false
        ),
        upcomingBills: [
            UpcomingBill(id: "1", provider: "Netflix",  amount: 499,   dueDays: 3, dueLabel: "in 3 days",  isOverdue: false),
            UpcomingBill(id: "2", provider: "Meralco",  amount: 2_450, dueDays: 7, dueLabel: "in 7 days",  isOverdue: false),
            UpcomingBill(id: "3", provider: "Globe",    amount: 1_399, dueDays: 12, dueLabel: "in 12 days", isOverdue: false),
        ],
        unpaidCount: 3,
        totalOwed: 4_348,
        relevance: nil,
        debugState: nil
    )
}

// MARK: — TimelineProvider

struct JudithProvider: TimelineProvider {

    func placeholder(in context: Context) -> JudithEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (JudithEntry) -> Void) {
        completion(context.isPreview ? .placeholder : makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<JudithEntry>) -> Void) {
        let entry   = makeEntry()
        // Refresh at midnight so "Xd" counters tick over correctly.
        let refresh = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    // MARK: — Read from App Group (written by JudithWidgetBridgeModule on the phone)

    private func makeEntry() -> JudithEntry {
        let defaults = UserDefaults(suiteName: Config.appGroupID)
        var payload: WatchPayload? = nil
        var debugState: String? = nil
        if let data = defaults?.data(forKey: Config.payloadCacheKey) {
            payload = try? JSONDecoder().decode(WatchPayload.self, from: data)
            if payload == nil {
                debugState = "decode:data"
            }
        }
        if payload == nil,
           let json = defaults?.string(forKey: "\(Config.payloadCacheKey).string"),
           let data = json.data(using: .utf8) {
            payload = try? JSONDecoder().decode(WatchPayload.self, from: data)
            if payload == nil {
                debugState = "decode:string"
            }
        }
        if defaults == nil {
            debugState = "no-suite"
        } else if payload == nil && debugState == nil {
            debugState = "no-payload"
        }

        let currency    = payload?.currency     ?? "₱"
        let unpaidCount = payload?.unpaidCount  ?? 0
        let totalOwed   = payload?.totalOwed    ?? 0
        let bills       = payload?.upcomingBills ?? []
        let nextBill    = bills.first

        let relevance: TimelineEntryRelevance? = nextBill.map { b in
            let d     = max(b.dueDays, 0)
            let score = Float(max(0, 10 - d))
            let dur: TimeInterval = d <= 1 ? 3_600 : 86_400
            return TimelineEntryRelevance(score: score, duration: dur)
        }

        return JudithEntry(
            date:          Date(),
            currency:      currency,
            nextBill:      nextBill,
            upcomingBills: bills,
            unpaidCount:   unpaidCount,
            totalOwed:     totalOwed,
            relevance:     relevance,
            debugState:    debugState
        )
    }
}
