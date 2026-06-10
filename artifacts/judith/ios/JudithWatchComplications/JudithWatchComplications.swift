import SwiftUI
import WidgetKit

private enum JudithComplicationConfig {
    static let appGroupID = "group.com.app.judith"
    static let payloadKey = "judith.payload_v2"
}

private enum JudithComplicationMode {
    case nextDue
    case monthlyTotal
}

private func compactPesoAmount(_ amount: Double, currency: String) -> String {
    let rounded = Int(amount.rounded())
    if rounded >= 1_000_000 {
        return "\(currency)\(rounded / 1_000_000)m"
    }
    if rounded >= 1_000 {
        return "\(currency)\(rounded / 1_000)k"
    }
    return "\(currency)\(rounded)"
}

private func dueSummary(unpaidCount: Int, totalOwed: Double, currency: String) -> String {
    "\(unpaidCount) Due · \(compactPesoAmount(totalOwed, currency: currency))"
}

private func nextDueAmountSummary(_ payload: ComplicationPayload) -> String {
    compactPesoAmount(payload.nextAmount, currency: payload.currency)
}

private func nextDueCountdown(_ payload: ComplicationPayload) -> String {
    if payload.nextDueDays <= 0 {
        return "Now"
    }
    return payload.nextDueLabel
}

private func nextDueInlineSummary(_ payload: ComplicationPayload) -> String {
    let provider = payload.nextProvider.isEmpty ? "Next bill" : payload.nextProvider
    return "\(provider) \(nextDueAmountSummary(payload)) · \(nextDueCountdown(payload))"
}

struct ComplicationPayload: Decodable {
    let generatedAt: String
    let currency: String
    let totalOwed: Double
    let unpaidCount: Int
    let nextProvider: String
    let nextAmount: Double
    let nextDueDays: Int
    let nextDueLabel: String
    let paidCount: Int
    let totalCount: Int
}

struct JudithComplicationEntry: TimelineEntry {
    let date: Date
    let payload: ComplicationPayload?

    static let placeholder = JudithComplicationEntry(
        date: Date(),
        payload: ComplicationPayload(
            generatedAt: Date().formatted(.iso8601),
            currency: "₱",
            totalOwed: 26_000,
            unpaidCount: 1,
            nextProvider: "Home",
            nextAmount: 26_000,
            nextDueDays: 17,
            nextDueLabel: "17d",
            paidCount: 4,
            totalCount: 5
        )
    )
}

struct JudithComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> JudithComplicationEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (JudithComplicationEntry) -> Void) {
        completion(context.isPreview ? .placeholder : makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<JudithComplicationEntry>) -> Void) {
        let entry = makeEntry()
        let refresh = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func makeEntry() -> JudithComplicationEntry {
        let defaults = UserDefaults(suiteName: JudithComplicationConfig.appGroupID)
        let payload: ComplicationPayload?

        if let data = defaults?.data(forKey: JudithComplicationConfig.payloadKey) {
            payload = try? JSONDecoder().decode(ComplicationPayload.self, from: data)
        } else {
            payload = nil
        }

        return JudithComplicationEntry(date: Date(), payload: payload)
    }
}

private struct CircularComplicationView: View {
    let entry: JudithComplicationEntry
    let mode: JudithComplicationMode

    private var fraction: Double {
        guard let payload = entry.payload, payload.totalCount > 0 else { return 0 }
        return Double(payload.paidCount) / Double(payload.totalCount)
    }

    var body: some View {
        switch mode {
        case .monthlyTotal:
            if let payload = entry.payload, payload.totalCount > 0 {
                Gauge(value: fraction) {
                    Image(systemName: payload.unpaidCount == 0 ? "checkmark.circle.fill" : "creditcard.fill")
                } currentValueLabel: {
                    Text(payload.unpaidCount == 0 ? "OK" : "\(payload.unpaidCount)")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                }
                .gaugeStyle(.accessoryCircular)
                .tint(payload.unpaidCount == 0 ? .green : .mint)
            } else {
                Image(systemName: "creditcard.fill")
                    .foregroundStyle(.mint)
            }

        case .nextDue:
            if let payload = entry.payload, payload.unpaidCount > 0 {
                ZStack {
                    Circle()
                        .fill(.mint.opacity(0.18))
                    VStack(spacing: 1) {
                        Image(systemName: "calendar")
                            .font(.system(size: 10, weight: .bold))
                        Text(nextDueCountdown(payload))
                            .font(.system(size: 8, weight: .bold, design: .rounded))
                    }
                    .foregroundStyle(.mint)
                }
            } else {
                ZStack {
                    Circle()
                        .fill(.green.opacity(0.18))
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }
        }
    }
}

private struct CornerComplicationView: View {
    let entry: JudithComplicationEntry
    let mode: JudithComplicationMode

    var body: some View {
        ZStack {
            Circle()
                .fill(accentColor.opacity(0.18))
            Image(systemName: iconName)
                .foregroundStyle(accentColor)
        }
        .widgetLabel {
            Text(labelText)
        }
    }

    private var iconName: String {
        guard let payload = entry.payload else { return fallbackIconName }
        switch mode {
        case .monthlyTotal:
            return payload.unpaidCount == 0 ? "checkmark.circle.fill" : "creditcard.fill"
        case .nextDue:
            return payload.unpaidCount == 0 ? "checkmark.circle.fill" : "calendar"
        }
    }

    private var fallbackIconName: String {
        switch mode {
        case .monthlyTotal:
            return "creditcard.fill"
        case .nextDue:
            return "calendar"
        }
    }

    private var accentColor: Color {
        guard let payload = entry.payload else { return .mint }
        switch mode {
        case .monthlyTotal:
            return payload.unpaidCount == 0 ? .green : .mint
        case .nextDue:
            return payload.unpaidCount == 0 ? .green : .mint
        }
    }

    private var labelText: String {
        guard let payload = entry.payload else { return "Open Judith" }

        switch mode {
        case .monthlyTotal:
            if payload.unpaidCount == 0 {
                return "All paid"
            }
            return dueSummary(
                unpaidCount: payload.unpaidCount,
                totalOwed: payload.totalOwed,
                currency: payload.currency
            )

        case .nextDue:
            if payload.unpaidCount == 0 {
                return "All paid"
            }
            return nextDueInlineSummary(payload)
        }
    }
}

private struct RectangularComplicationView: View {
    let entry: JudithComplicationEntry
    let mode: JudithComplicationMode

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(headerText)
                .font(.system(size: 8, weight: .black, design: .rounded))
                .foregroundStyle(.mint)

            if let payload = entry.payload {
                switch mode {
                case .monthlyTotal:
                    Text(payload.unpaidCount == 0 ? "All paid" : dueSummary(
                        unpaidCount: payload.unpaidCount,
                        totalOwed: payload.totalOwed,
                        currency: payload.currency
                    ))
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .lineLimit(1)

                    Text(payload.unpaidCount == 0 ? "Nothing due right now" : "Remaining this month")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                case .nextDue:
                    Text(payload.nextProvider.isEmpty ? "Next bill" : payload.nextProvider)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .lineLimit(1)

                    Text(nextDueAmountSummary(payload))
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .lineLimit(1)

                    Text(payload.unpaidCount == 0 ? "Nothing due right now" : "Due \(nextDueCountdown(payload))")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } else {
                Text("Open Judith")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                Text("Sync from iPhone")
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var headerText: String {
        switch mode {
        case .monthlyTotal:
            return "MONTHLY TOTAL"
        case .nextDue:
            return "NEXT DUE"
        }
    }
}

private struct InlineComplicationView: View {
    let entry: JudithComplicationEntry
    let mode: JudithComplicationMode

    var body: some View {
        if let payload = entry.payload {
            switch mode {
            case .monthlyTotal:
                if payload.unpaidCount > 0 {
                    Text(dueSummary(
                        unpaidCount: payload.unpaidCount,
                        totalOwed: payload.totalOwed,
                        currency: payload.currency
                    ))
                } else {
                    Text("Judith · All paid")
                }

            case .nextDue:
                if payload.unpaidCount > 0 {
                    Text(nextDueInlineSummary(payload))
                } else {
                    Text("Judith · All paid")
                }
            }
        } else {
            Text("Open Judith")
        }
    }
}

struct JudithWatchComplicationsEntryView: View {
    let entry: JudithComplicationEntry
    let mode: JudithComplicationMode
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                CircularComplicationView(entry: entry, mode: mode)
            case .accessoryCorner:
                CornerComplicationView(entry: entry, mode: mode)
            case .accessoryRectangular:
                RectangularComplicationView(entry: entry, mode: mode)
            case .accessoryInline:
                InlineComplicationView(entry: entry, mode: mode)
            default:
                CircularComplicationView(entry: entry, mode: mode)
            }
        }
        .privacySensitive()
    }
}

struct JudithNextDueComplication: Widget {
    let kind = "JudithNextDueComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: JudithComplicationProvider()) { entry in
            JudithWatchComplicationsEntryView(entry: entry, mode: .nextDue)
                .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Judith Next Due")
        .description("Show the next bill due and how much it is.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

struct JudithMonthlyTotalComplication: Widget {
    let kind = "JudithMonthlyTotalComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: JudithComplicationProvider()) { entry in
            JudithWatchComplicationsEntryView(entry: entry, mode: .monthlyTotal)
                .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Judith Monthly Total")
        .description("Show how much is still due this month.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

#Preview(as: .accessoryRectangular) {
    JudithNextDueComplication()
} timeline: {
    JudithComplicationEntry.placeholder
}
