import WidgetKit
import SwiftUI

// MARK: — Timeline entry
// Reads from the same App Group UserDefaults as the watch app and the
// iOS homescreen widget — no separate data pipeline needed.

struct ComplicationEntry: TimelineEntry {
    let date:          Date
    let paidCount:     Int
    let totalCount:    Int
    let unpaidCount:   Int
    let totalOwed:     Double
    let currency:      String
    let nextProvider:  String
    let nextAmount:    Double
    let nextDueDays:   Int
    let overdueCount:  Int
    let overdueTotal:  Double
    /// Amount-based progress fraction — mirrors the phone hero card.
    let paidFraction:  Double
}

// MARK: — Provider

struct ComplicationProvider: TimelineProvider {

    private let appGroupID = "group.com.app.judith"
    private let cacheKey   = "judith.payload_v2"

    func placeholder(in context: Context) -> ComplicationEntry {
        ComplicationEntry(
            date: Date(), paidCount: 3, totalCount: 5, unpaidCount: 2,
            totalOwed: 4348, currency: "₱",
            nextProvider: "Netflix", nextAmount: 549, nextDueDays: 3,
            overdueCount: 0, overdueTotal: 0, paidFraction: 0.6
        )
    }

    func getSnapshot(in context: Context,
                     completion: @escaping (ComplicationEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : makeEntry())
    }

    func getTimeline(in context: Context,
                     completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
        let entry   = makeEntry()
        let refresh = Calendar.current.startOfDay(
            for: Date().addingTimeInterval(86_400))
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func makeEntry() -> ComplicationEntry {
        let defaults = UserDefaults(suiteName: appGroupID)
        var p: WatchPayload? = nil
        if let data = defaults?.data(forKey: cacheKey) {
            p = try? JSONDecoder().decode(WatchPayload.self, from: data)
        }

        // Prefer amount-based progress; fall back to count-based when the cached
        // payload predates `paidAmount` so old installs still render a ring.
        let fraction: Double
        if let f = p?.paidFractionByAmount {
            fraction = f
        } else if let total = p?.totalCount, total > 0 {
            fraction = Double(p?.paidCount ?? 0) / Double(total)
        } else {
            fraction = 0
        }

        return ComplicationEntry(
            date:          Date(),
            paidCount:     p?.paidCount    ?? 0,
            totalCount:    p?.totalCount   ?? 0,
            unpaidCount:   p?.unpaidCount  ?? 0,
            totalOwed:     p?.totalOwed    ?? 0,
            currency:      p?.currency     ?? "₱",
            nextProvider:  p?.nextProvider ?? "",
            nextAmount:    p?.nextAmount   ?? 0,
            nextDueDays:   p?.nextDueDays  ?? 0,
            overdueCount:  p?.overdueCount ?? 0,
            overdueTotal:  p?.overdueTotal ?? 0,
            paidFraction:  fraction
        )
    }
}

// MARK: — Shared helpers

private func urgencyColor(for entry: ComplicationEntry) -> Color {
    if entry.overdueCount > 0 { return .judithOverdue }
    if entry.unpaidCount == 0 { return .judithAccent }
    let d = entry.nextDueDays
    if d < 0  { return .judithOverdue }
    if d <= 3 { return .judithUrgent }
    if d <= 7 { return .judithNear }
    return .judithAccent
}

private func dueShort(_ days: Int) -> String {
    if days < 0  { return "\(-days)d late" }
    if days == 0 { return "today" }
    if days == 1 { return "tmrw" }
    return "in \(days)d"
}

private func amountShort(_ amount: Double, currency: String) -> String {
    "\(currency)\(String(format: "%.0f", amount))"
}

// MARK: — Circular: amount-based progress ring + headline number
// Shows what matters at a glance — % paid (matching the phone hero card) and,
// if anything is overdue, the overdue count instead. Bezel label promotes the
// next bill so the user can read context without launching the app.

private struct CircularView: View {
    let entry: ComplicationEntry

    var body: some View {
        ZStack {
            if entry.totalCount == 0 {
                Image(systemName: "creditcard.fill")
                    .font(.body)
                    .foregroundStyle(Color.judithAccent)
            } else if entry.unpaidCount == 0 {
                Image(systemName: "checkmark.circle.fill")
                    .font(.body)
                    .foregroundStyle(Color.judithAccent)
            } else {
                Gauge(value: entry.paidFraction) {
                    EmptyView()
                } currentValueLabel: {
                    if entry.overdueCount > 0 {
                        Text("\(entry.overdueCount)!")
                            .font(.system(size: 13, design: .rounded).weight(.heavy))
                    } else {
                        Text("\(Int((entry.paidFraction * 100).rounded()))%")
                            .font(.system(size: 12, design: .rounded).weight(.bold))
                    }
                }
                .gaugeStyle(.accessoryCircular)
                .tint(urgencyColor(for: entry))
            }
        }
        .widgetLabel {
            if entry.unpaidCount == 0 {
                Text("All paid")
            } else if entry.overdueCount > 0 {
                Text("\(entry.overdueCount) overdue · \(amountShort(entry.overdueTotal, currency: entry.currency))")
            } else if !entry.nextProvider.isEmpty {
                Text("Next: \(entry.nextProvider) \(dueShort(entry.nextDueDays))")
            } else {
                Text("\(entry.unpaidCount) due · \(amountShort(entry.totalOwed, currency: entry.currency))")
            }
        }
    }
}

// MARK: — Corner: due-days counter + provider/amount bezel
// The corner is just two pieces of glass so we make them count: the headline
// is the number of days until the next bill (with sign for overdue), tinted
// by urgency, and the bezel carries the provider + amount.

private struct CornerView: View {
    let entry: ComplicationEntry

    private var headline: String {
        if entry.unpaidCount == 0 { return "✓" }
        if entry.nextDueDays < 0 { return "\(-entry.nextDueDays)d" }
        if entry.nextDueDays == 0 { return "Today" }
        return "\(entry.nextDueDays)d"
    }

    var body: some View {
        ZStack {
            Circle().fill(urgencyColor(for: entry).opacity(0.18))
            Text(headline)
                .font(.system(Font.TextStyle.callout, design: .rounded).weight(.heavy))
                .foregroundStyle(urgencyColor(for: entry))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .widgetLabel {
            if entry.unpaidCount == 0 {
                Text("All bills paid")
            } else if entry.overdueCount > 0 {
                Text("\(entry.overdueCount) overdue · \(amountShort(entry.overdueTotal, currency: entry.currency))")
            } else if !entry.nextProvider.isEmpty {
                Text("\(entry.nextProvider) · \(amountShort(entry.nextAmount, currency: entry.currency))")
            } else {
                Text("\(entry.unpaidCount) bill\(entry.unpaidCount == 1 ? "" : "s") due · \(amountShort(entry.totalOwed, currency: entry.currency))")
            }
        }
    }
}

// MARK: — Rectangular: next bill headline + month-total + amount-based progress
// Lead with the most actionable info: provider + due window. Underneath,
// total owed for the month. Progress bar mirrors the phone hero card percent.

private struct RectangularView: View {
    let entry: ComplicationEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            // Top line: overdue alert OR next-bill headline.
            HStack(spacing: 4) {
                if entry.overdueCount > 0 {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(Color.judithOverdue)
                    Text("\(entry.overdueCount) overdue")
                        .font(.system(size: 11, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.judithOverdue)
                        .lineLimit(1)
                } else if entry.unpaidCount > 0 && !entry.nextProvider.isEmpty {
                    Circle()
                        .fill(urgencyColor(for: entry))
                        .frame(width: 5, height: 5)
                    Text("\(entry.nextProvider) · \(dueShort(entry.nextDueDays))")
                        .font(.system(size: 11, design: .rounded).weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                } else {
                    Text("JUDITH")
                        .font(.system(size: 9, design: .rounded).weight(.black))
                        .foregroundStyle(Color.judithAccent)
                }
                Spacer(minLength: 0)
                Text("\(Int((entry.paidFraction * 100).rounded()))%")
                    .font(.system(size: 9, design: .rounded).weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            Text(entry.unpaidCount == 0
                 ? "All paid up!"
                 : "\(amountShort(entry.totalOwed, currency: entry.currency)) due")
                .font(.system(Font.TextStyle.callout, design: .monospaced).weight(.bold))
                .foregroundStyle(entry.unpaidCount == 0 ? Color.judithAccent : .primary)
                .lineLimit(1)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.judithAccent.opacity(0.2))
                        .frame(height: 4)
                    Capsule()
                        .fill(urgencyColor(for: entry))
                        .frame(width: geo.size.width * entry.paidFraction, height: 4)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 2)
    }
}

// MARK: — Inline: single most-actionable line
// Prioritizes overdue alerts; falls back to next-bill, then headline totals.

private struct InlineView: View {
    let entry: ComplicationEntry

    var body: some View {
        if entry.unpaidCount == 0 {
            Text("✓ All bills paid")
        } else if entry.overdueCount > 0 {
            Text("⚠︎ \(entry.overdueCount) overdue · \(amountShort(entry.overdueTotal, currency: entry.currency))")
        } else if !entry.nextProvider.isEmpty {
            Text("\(entry.nextProvider) \(dueShort(entry.nextDueDays)) · \(amountShort(entry.nextAmount, currency: entry.currency))")
        } else {
            Text("\(entry.unpaidCount) due · \(amountShort(entry.totalOwed, currency: entry.currency))")
        }
    }
}

// MARK: — Dispatcher

struct ComplicationEntryView: View {
    let entry: ComplicationEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:    CircularView(entry: entry)
        case .accessoryCorner:      CornerView(entry: entry)
        case .accessoryRectangular: RectangularView(entry: entry)
        case .accessoryInline:      InlineView(entry: entry)
        default:                    CircularView(entry: entry)
        }
    }
}

// MARK: — Widget

struct JudithComplication: Widget {
    static let kind = "JudithComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: ComplicationProvider()) { entry in
            ComplicationEntryView(entry: entry)
                .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Judith")
        .description("Track bill payments on your watch face.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

// MARK: — Bundle (dedicated watchOS widget extension target, so @main lives
// here. The watch app target keeps @main on JudithWatchApp.)

@main
struct JudithComplicationBundle: WidgetBundle {
    var body: some Widget {
        JudithComplication()
    }
}
