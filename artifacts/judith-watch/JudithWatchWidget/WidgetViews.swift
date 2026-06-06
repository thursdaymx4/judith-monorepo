import WidgetKit
import SwiftUI

// MARK: — Design tokens (self-contained so widget target needs no shared Config)

private extension Color {
    static let judithAccent  = Color(hex: "#29d5a5")
    static let judithOK      = Color(hex: "#56d1a3")
    static let judithNear    = Color(hex: "#f7b83d")
    static let txtHi         = Color(hex: "#f3f5f8")
    static let txtMid        = Color(hex: "#a7adba")
    static let txtLow        = Color(hex: "#6a7180")

    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: — Complication views (watchOS 9+ accessor families)

struct ComplicationViews: View {
    let entry: JudithEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:    CircularView(entry: entry)
        case .accessoryCorner:      CornerView(entry: entry)
        case .accessoryRectangular: RectangularView(entry: entry)
        case .accessoryInline:      InlineView(entry: entry)
        default:                    RectangularView(entry: entry)
        }
    }
}

// MARK: — Circular: urgency ring + days until

private struct CircularView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            if let bill = entry.nextBill {
                let d = Double(max(0, min(bill.dueDays, 30)))
                Gauge(value: 1.0 - d / 30.0) {
                    EmptyView()
                } currentValueLabel: {
                    Text(bill.dueDays <= 0 ? "!" : "\(bill.dueDays)")
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

// MARK: — Rectangular: NEXT DUE + count/total

private struct RectangularView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
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
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(bill.provider)
                        .font(.system(.body, design: .rounded, weight: .semibold))
                        .foregroundStyle(.txtHi)
                        .lineLimit(1)
                    Spacer()
                    Text(bill.amountDisplay(currency: entry.currency))
                        .font(.system(.body, design: .monospaced, weight: .bold))
                        .foregroundStyle(bill.urgency.color)
                }
                HStack(spacing: 2) {
                    Text("\(entry.unpaidCount) due")
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(.txtMid)
                    Text("·")
                        .foregroundStyle(.txtLow)
                    Text("\(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
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
            Label(
                "\(bill.provider) · \(bill.amountDisplay(currency: entry.currency)) · \(bill.dueLabelShort)",
                systemImage: "calendar.badge.exclamationmark"
            )
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
                    Text(bill.amountDisplay(currency: entry.currency))
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
