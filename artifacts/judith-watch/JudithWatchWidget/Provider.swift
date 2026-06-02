import WidgetKit
import SwiftUI

// MARK: — Shared timeline entry

struct JudithEntry: TimelineEntry {
    let date: Date
    let nextBill: CachedBill?
    let unpaidCount: Int
    let monthTotal: Double
    let relevance: TimelineEntryRelevance?

    static let placeholder = JudithEntry(
        date: Date(),
        nextBill: CachedBill(id: "1", provider: "Netflix", amount: 850, daysUntil: 3, urgencyRaw: 1),
        unpaidCount: 4,
        monthTotal: 3_200,
        relevance: nil
    )
}

// MARK: — Lightweight cached bill (read from App Group — no Supabase call in widget)

struct CachedBill: Codable {
    let id: String
    let provider: String
    let amount: Double?
    let daysUntil: Int
    let urgencyRaw: Int            // Urgency.rawValue

    var urgency: Urgency { Urgency(rawValue: urgencyRaw) ?? .ok }

    var amountDisplay: String {
        guard let a = amount else { return "—" }
        return "₱\(String(format: "%.0f", a))"
    }

    var dueLabelShort: String {
        if daysUntil == 0  { return "Today" }
        if daysUntil < 0   { return "\(-daysUntil)d late" }
        if daysUntil == 1  { return "Tomorrow" }
        return "\(daysUntil)d"
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
        // Refresh at midnight and any time the app group data changes
        let midnight = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
        let timeline = Timeline(entries: [entry], policy: .after(midnight))
        completion(timeline)
    }

    // MARK: — Read from App Group cache (no networking in widget extension)

    private func makeEntry() -> JudithEntry {
        let defaults = UserDefaults(suiteName: Config.appGroupID)
        var bills: [Bill] = []
        if let data   = defaults?.data(forKey: Config.billsCacheKey),
           let cached = try? JSONDecoder().decode([Bill].self, from: data) {
            bills = cached
        }

        let unpaid = bills
            .filter { $0.isUnpaid }
            .sorted {
                if $0.urgency != $1.urgency { return $0.urgency < $1.urgency }
                return ($0.daysUntil ?? 9999) < ($1.daysUntil ?? 9999)
            }

        let next = unpaid.first.map {
            CachedBill(id: $0.id,
                       provider: $0.displayName,
                       amount: $0.amount,
                       daysUntil: $0.daysUntil ?? 0,
                       urgencyRaw: $0.urgency.rawValue)
        }

        let total = bills.filter { $0.isUnpaid }.compactMap { $0.amount }.reduce(0, +)

        // Relevance: score climbs as due date approaches (0 = 7+ days out, 10 = today/overdue)
        let relevance: TimelineEntryRelevance? = next.map { b in
            let d = max(b.daysUntil, 0)
            let score = Float(max(0, 10 - d))
            let duration: TimeInterval = d <= 1 ? 3_600 : 86_400
            return TimelineEntryRelevance(score: score, duration: duration)
        }

        return JudithEntry(
            date: Date(),
            nextBill: next,
            unpaidCount: unpaid.count,
            monthTotal: total,
            relevance: relevance
        )
    }
}
