import WidgetKit
import SwiftUI

// MARK: — Complication views (all watchOS 9+ accessor families)

struct ComplicationViews: View {
    let entry: JudithEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:    CircularView(entry: entry)
        case .accessoryCorner:      CornerView(entry: entry)
        case .accessoryRectangular: RectangularView(entry: entry)
        case .accessoryInline:      InlineView(entry: entry)
        case .systemSmall:          SmartStackView(entry: entry)
        default:                    SmartStackView(entry: entry)
        }
    }
}

// MARK: — Circular: urgency ring + days until

private struct CircularView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            // Gauge ring
            if let bill = entry.nextBill {
                let d = Double(max(0, min(bill.daysUntil, 30)))
                Gauge(value: 1.0 - d / 30.0) {
                    EmptyView()
                } currentValueLabel: {
                    Text(bill.daysUntil <= 0 ? "!" : "\(bill.daysUntil)")
                        .font(.system(.body, design: .monospaced, weight: .bold))
                        .foregroundStyle(bill.urgency.color)
                }
                .gaugeStyle(.accessoryCircular)
                .tint(bill.urgency.color)
            } else {
                Image(systemName: "checkmark.circle")
                    .font(.system(.body, weight: .medium))
                    .foregroundStyle(.judithAccent)
            }
        }
        .widgetLabel {
            if let bill = entry.nextBill {
                Text(bill.provider)
                    .font(.system(.caption2, design: .rounded))
                    .foregroundStyle(.txtMid)
            }
        }
    }
}

// MARK: — Corner: due-count badge

private struct CornerView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(.title3))
                .foregroundStyle(.judithAccent)
        }
        .widgetLabel {
            let count = entry.unpaidCount
            Text(count == 0 ? "All paid" : "\(count) due")
                .font(.system(.caption2, design: .rounded, weight: .semibold))
                .foregroundStyle(count == 0 ? Color.judithOK : Color.judithNear)
        }
    }
}

// MARK: — Rectangular (Modular): large complication — NEXT DUE + count/total

private struct RectangularView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            // "JUDITH · NEXT DUE"
            HStack(spacing: 4) {
                Text("JUDITH")
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(.judithAccent)
                Text("·")
                    .foregroundStyle(.txtLow)
                    .font(.system(size: 9))
                Text("NEXT DUE")
                    .font(.system(size: 9, weight: .semibold, design: .rounded))
                    .foregroundStyle(.txtLow)
                Spacer()
                if let bill = entry.nextBill {
                    Text(bill.dueLabelShort.uppercased())
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(bill.urgency.color)
                }
            }

            if let bill = entry.nextBill {
                // Provider + amount
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(bill.provider)
                        .font(.system(.body, design: .rounded, weight: .semibold))
                        .foregroundStyle(.txtHi)
                        .lineLimit(1)
                    Spacer()
                    Text(bill.amountDisplay)
                        .font(.system(.body, design: .monospaced, weight: .bold))
                        .foregroundStyle(bill.urgency.color)
                }
                // Count / total row
                HStack(spacing: 2) {
                    Text("\(entry.unpaidCount) due")
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(.txtMid)
                    Text("·")
                        .foregroundStyle(.txtLow)
                    Text("₱\(String(format: "%.0f", entry.monthTotal))")
                        .font(.system(.caption2, design: .monospaced, weight: .medium))
                        .foregroundStyle(.txtMid)
                }
            } else {
                Text("No unpaid bills")
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(.judithAccent)
            }
        }
        .padding(4)
    }
}

// MARK: — Inline: single-line text

private struct InlineView: View {
    let entry: JudithEntry

    var body: some View {
        if let bill = entry.nextBill {
            Label("\(bill.provider) · \(bill.amountDisplay) · \(bill.dueLabelShort)",
                  systemImage: "calendar.badge.exclamationmark")
        } else {
            Label("No bills due", systemImage: "checkmark.circle")
        }
    }
}

// MARK: — Smart Stack: rises in stack as due date nears

struct SmartStackView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 4) {
                Text("JUDITH")
                    .font(.system(size: 10, weight: .black, design: .rounded))
                    .foregroundStyle(.judithAccent)
                Spacer()
                if let bill = entry.nextBill {
                    Circle()
                        .fill(bill.urgency.color)
                        .frame(width: 6, height: 6)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            Spacer()

            if let bill = entry.nextBill {
                VStack(alignment: .leading, spacing: 3) {
                    Text(bill.provider)
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(.txtHi)
                        .lineLimit(1)
                    Text(bill.amountDisplay)
                        .font(.system(.title3, design: .monospaced, weight: .bold))
                        .foregroundStyle(.txtHi)
                    Text("due \(bill.dueLabelShort.lowercased()) · tap to pay")
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(bill.urgency.color)
                }
                .padding(.horizontal, 14)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.judithAccent)
                        .font(.title3)
                    Text("All paid up")
                        .font(.system(.footnote, design: .rounded, weight: .semibold))
                        .foregroundStyle(.txtHi)
                }
                .padding(.horizontal, 14)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .containerBackground(Color.black, for: .widget)
    }
}
