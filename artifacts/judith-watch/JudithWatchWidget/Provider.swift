import WidgetKit
import SwiftUI

// MARK: — Shared timeline entry

struct JudithEntry: TimelineEntry {
    let date: Date
    let currency: String
    let nextBill: CachedBill?
    let unpaidCount: Int
    let totalOwed: Double
    let relevance: TimelineEntryRelevance?

    static let placeholder = JudithEntry(
        date: Date(),
        currency: "$",
        nextBill: CachedBill(provider: "Netflix", amount: 23, dueDays: 3, urgencyRaw: 1),
        unpaidCount: 4,
        totalOwed: 3_200,
        relevance: nil
    )
}

// MARK: — Lightweight next-bill summary (read from App Group cache)

struct CachedBill {
    let provider: String
    let amount: Double
    let dueDays: Int
    let urgencyRaw: Int

    var urgency: Urgency { Urgency(rawValue: urgencyRaw) ?? .ok }

    func amountDisplay(currency: String) -> String {
        "\(currency)\(String(format: "%.0f", amount))"
    }

    var dueLabelShort: String {
        if dueDays == 0 { return "Today" }
        if dueDays < 0  { return "\(-dueDays)d late" }
        if dueDays == 1 { return "Tomorrow" }
        return "\(dueDays)d"
    }
}

// MARK: — TimelineProvider

struct JudithProvider: TimelineProvider {

    func placeholder(in context: Context) -> JudithEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (JudithEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<JudithEntry>) -> Void) {
        let entry = makeEntry()
        let midnight = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
        completion(Timeline(entries: [entry], policy: .after(midnight)))
    }

    // MARK: — Read from App Group cache (no networking in widget extension)

    private func makeEntry() -> JudithEntry {
        let defaults = UserDefaults(suiteName: Config.appGroupID)
        var payload: WatchPayload? = nil
        if let data = defaults?.data(forKey: Config.payloadCacheKey) {
            payload = try? JSONDecoder().decode(WatchPayload.self, from: data)
        }

        let currency = payload?.currency ?? "$"
        let unpaidCount = payload?.unpaidCount ?? 0
        let totalOwed   = payload?.totalOwed ?? 0

        let next: CachedBill? = {
            guard let p = payload, !p.nextProvider.isEmpty else { return nil }
            return CachedBill(
                provider:    p.nextProvider,
                amount:      p.nextAmount,
                dueDays:     p.nextDueDays,
                urgencyRaw:  urgencyRaw(dueDays: p.nextDueDays)
            )
        }()

        let relevance: TimelineEntryRelevance? = next.map { b in
            let d = max(b.dueDays, 0)
            let score = Float(max(0, 10 - d))
            let duration: TimeInterval = d <= 1 ? 3_600 : 86_400
            return TimelineEntryRelevance(score: score, duration: duration)
        }

        return JudithEntry(
            date: Date(),
            currency: currency,
            nextBill: next,
            unpaidCount: unpaidCount,
            totalOwed: totalOwed,
            relevance: relevance
        )
    }

    private func urgencyRaw(dueDays: Int) -> Int {
        if dueDays < 0  { return Urgency.overdue.rawValue }
        if dueDays <= 3 { return Urgency.urgent.rawValue }
        if dueDays <= 7 { return Urgency.near.rawValue }
        return Urgency.ok.rawValue
    }
}
