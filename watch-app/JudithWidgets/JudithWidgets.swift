// JudithWidgets.swift — watch-face complications + Smart Stack widget.
// Surfaces the single most-urgent unpaid bill (NEXT DUE) + count/total.
// In production the TimelineProvider reads the shared App Group container that
// the phone/watch app writes; here it uses the sample store so it compiles.
//
// Build as a separate Widget Extension target embedded in the watch app.
import WidgetKit
import SwiftUI

struct JudithEntry: TimelineEntry {
    let date: Date
    let provider: String
    let amount: Int
    let dueDays: Int
    let dueCount: Int
    let totalDue: Int
    let over: Bool
}

struct JudithProvider: TimelineProvider {
    private func current() -> JudithEntry {
        let s = BillStore.shared
        let b = s.nextDue
        return JudithEntry(
            date: Date(),
            provider: b?.provider ?? "All clear",
            amount: b?.amount ?? 0,
            dueDays: b?.dueDays ?? 0,
            dueCount: s.dueCount,
            totalDue: s.totalDue,
            over: (b?.dueDays ?? 0) < 0
        )
    }
    func placeholder(in context: Context) -> JudithEntry { current() }
    func getSnapshot(in context: Context, completion: @escaping (JudithEntry) -> Void) { completion(current()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<JudithEntry>) -> Void) {
        // Refresh on data change + a daily reload.
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date()) ?? Date().addingTimeInterval(21600)
        completion(Timeline(entries: [current()], policy: .after(next)))
    }
}

struct JudithComplicationView: View {
    @Environment(\.widgetFamily) var family
    let entry: JudithEntry

    var tint: Color { entry.over ? WatchTheme.overdue : WatchTheme.near }
    var daysText: String { entry.over ? "\(-entry.dueDays)d late" : "\(entry.dueDays)d" }

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text("\(entry.dueCount)").font(WatchTheme.mono(18)).foregroundStyle(tint)
                    Text("due").font(.system(size: 9)).foregroundStyle(WatchTheme.textMid)
                }
            }
        case .accessoryInline:
            Text("\(entry.provider) · \(daysText)")
        case .accessoryRectangular:
            // Smart Stack / rectangular complication: "Meralco due in 3 days · ₱3,450"
            VStack(alignment: .leading, spacing: 1) {
                Text("NEXT DUE · \(daysText.uppercased())")
                    .font(.system(size: 10, weight: .semibold)).tracking(0.6)
                    .foregroundStyle(tint)
                Text(entry.provider)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(WatchTheme.textHi).lineLimit(1)
                Text("\(Money.format(entry.amount)) · \(entry.dueCount) due · \(Money.format(entry.totalDue))")
                    .font(.system(size: 11)).foregroundStyle(WatchTheme.textMid).lineLimit(1)
            }
        default:
            Text(entry.provider)
        }
    }
}

@main
struct JudithWidgetBundle: WidgetBundle {
    var body: some Widget { JudithComplication() }
}

struct JudithComplication: Widget {
    let kind = "JudithComplication"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: JudithProvider()) { entry in
            JudithComplicationView(entry: entry)
                .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Next due")
        .description("Your most-urgent unpaid bill, due count, and total.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
