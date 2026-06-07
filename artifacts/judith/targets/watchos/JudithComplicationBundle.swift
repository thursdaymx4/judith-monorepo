import WidgetKit
import SwiftUI

// MARK: — Timeline entry
// Reads from the same App Group UserDefaults as the watch app and the
// iOS homescreen widget — no separate data pipeline needed.

struct ComplicationEntry: TimelineEntry {
    let date:         Date
    let paidCount:    Int
    let totalCount:   Int
    let unpaidCount:  Int
    let totalOwed:    Double
    let currency:     String
    let nextProvider: String
    let nextDueDays:  Int
}

// MARK: — Provider

struct ComplicationProvider: TimelineProvider {

    private let appGroupID = "group.com.app.judith"
    private let cacheKey   = "judith.payload_v2"

    func placeholder(in context: Context) -> ComplicationEntry {
        ComplicationEntry(date: Date(), paidCount: 3, totalCount: 5,
                          unpaidCount: 2, totalOwed: 4348, currency: "₱",
                          nextProvider: "Netflix", nextDueDays: 3)
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
        return ComplicationEntry(
            date:         Date(),
            paidCount:    p?.paidCount    ?? 0,
            totalCount:   p?.totalCount   ?? 0,
            unpaidCount:  p?.unpaidCount  ?? 0,
            totalOwed:    p?.totalOwed    ?? 0,
            currency:     p?.currency     ?? "₱",
            nextProvider: p?.nextProvider ?? "",
            nextDueDays:  p?.nextDueDays  ?? 0
        )
    }
}

// MARK: — Circular: % paid ring gauge

private struct CircularView: View {
    let entry: ComplicationEntry

    private var fraction: Double {
        guard entry.totalCount > 0 else { return 0 }
        return Double(entry.paidCount) / Double(entry.totalCount)
    }

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
                Gauge(value: fraction) {
                    EmptyView()
                } currentValueLabel: {
                    Text("\(entry.paidCount)/\(entry.totalCount)")
                        .font(.system(size: 11, design: .monospaced, weight: .bold))
                }
                .gaugeStyle(.accessoryCircular)
                .tint(Color.judithAccent)
            }
        }
        .widgetLabel {
            Text(entry.unpaidCount == 0 ? "All paid" : "\(entry.unpaidCount) due")
        }
    }
}

// MARK: — Corner: unpaid count + bezel label

private struct CornerView: View {
    let entry: ComplicationEntry

    private var urgencyColor: Color {
        let d = entry.nextDueDays
        if entry.unpaidCount == 0 { return .judithAccent }
        if d < 0  { return .judithOverdue }
        if d <= 3 { return .judithUrgent }
        if d <= 7 { return .judithNear }
        return .judithAccent
    }

    var body: some View {
        ZStack {
            Circle().fill(urgencyColor.opacity(0.18))
            Image(systemName: entry.unpaidCount == 0
                  ? "checkmark.circle.fill" : "creditcard.fill")
                .font(.system(.body, weight: .semibold))
                .foregroundStyle(urgencyColor)
        }
        .widgetLabel {
            Text(entry.unpaidCount == 0
                 ? "All bills paid"
                 : "\(entry.unpaidCount) bill\(entry.unpaidCount == 1 ? "" : "s") due · \(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
        }
    }
}

// MARK: — Rectangular: progress bar + paid ratio + amount

private struct RectangularView: View {
    let entry: ComplicationEntry

    private var fraction: Double {
        guard entry.totalCount > 0 else { return 1 }
        return Double(entry.paidCount) / Double(entry.totalCount)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text("JUDITH")
                    .font(.system(size: 8, design: .rounded, weight: .black))
                    .foregroundStyle(Color.judithAccent)
                Spacer()
                Text("\(entry.paidCount)/\(entry.totalCount) paid")
                    .font(.system(size: 9, design: .rounded))
                    .foregroundStyle(.secondary)
            }

            Text(entry.unpaidCount == 0
                 ? "All paid up!"
                 : "\(entry.currency)\(String(format: "%.0f", entry.totalOwed)) due")
                .font(.system(.callout, design: .monospaced, weight: .bold))
                .foregroundStyle(entry.unpaidCount == 0 ? Color.judithAccent : .primary)
                .lineLimit(1)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.judithAccent.opacity(0.2))
                        .frame(height: 4)
                    Capsule()
                        .fill(Color.judithAccent)
                        .frame(width: geo.size.width * fraction, height: 4)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 2)
    }
}

// MARK: — Inline: concise one-liner

private struct InlineView: View {
    let entry: ComplicationEntry

    var body: some View {
        if entry.unpaidCount == 0 {
            Text("✓ All bills paid")
        } else {
            Text("\(entry.unpaidCount) due · \(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
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

// MARK: — Bundle (@main lives here; JudithWatchApp has no @main)
// In watchOS 9+, a WidgetBundle can be the module entry point while the
// App struct in the same target still provides the watch app UI.

@main
struct JudithComplicationBundle: WidgetBundle {
    var body: some Widget {
        JudithComplication()
    }
}
