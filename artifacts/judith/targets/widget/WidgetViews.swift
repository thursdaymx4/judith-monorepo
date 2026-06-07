import WidgetKit
import SwiftUI

// MARK: — Top-level dispatcher

struct JudithWidgetView: View {
    let entry: JudithEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .systemSmall:          SmallView(entry: entry)
        case .systemMedium:         MediumView(entry: entry)
        case .systemLarge:          LargeView(entry: entry)
        case .accessoryCircular:    LockCircularView(entry: entry)
        case .accessoryRectangular: LockRectangularView(entry: entry)
        case .accessoryInline:      LockInlineView(entry: entry)
        default:                    SmallView(entry: entry)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Small
// ─────────────────────────────────────────────────────────────────────────────

private struct SmallView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            Text("JUDITH")
                .font(.system(size: 9, weight: .black, design: .rounded))
                .foregroundStyle(Color.judithAccent)
                .padding(.bottom, 10)

            if let bill = entry.nextBill {
                Text(bill.provider)
                    .font(.system(.callout, design: .rounded, weight: .bold))
                    .foregroundStyle(Color.txtHi)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.bottom, 2)

                Text(bill.amountDisplay(currency: entry.currency))
                    .font(.system(.title2, design: .monospaced, weight: .black))
                    .foregroundStyle(bill.urgency.color)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .padding(.bottom, 6)

                DueBadge(bill: bill)

            } else {
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(.title3))
                        .foregroundStyle(Color.judithAccent)
                    Text("All paid!")
                        .font(.system(.footnote, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.judithAccent)
                }
            }

            Spacer(minLength: 0)

            // Footer summary
            HStack(spacing: 3) {
                Text(entry.unpaidCount == 0 ? "No bills due" : "\(entry.unpaidCount) due")
                    .font(.system(size: 9, design: .rounded))
                    .foregroundStyle(Color.txtLow)
                if entry.unpaidCount > 0 {
                    Text("·").foregroundStyle(Color.txtLow).font(.system(size: 9))
                    Text("\(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.txtMid)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Medium  (up to 3 bills)
// ─────────────────────────────────────────────────────────────────────────────

private struct MediumView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Header
            HStack {
                Text("JUDITH")
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
                Spacer()
                SummaryLabel(count: entry.unpaidCount, total: entry.totalOwed, currency: entry.currency)
            }
            .padding(.bottom, 10)

            if entry.nextBill == nil {
                AllPaidView()
            } else {
                VStack(spacing: 5) {
                    ForEach(entry.upcomingBills.prefix(3)) { bill in
                        BillRow(bill: bill, currency: entry.currency)
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Large  (up to 6 bills + total footer)
// ─────────────────────────────────────────────────────────────────────────────

private struct LargeView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Header
            HStack {
                Text("JUDITH")
                    .font(.system(size: 10, weight: .black, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
                Spacer()
                SummaryLabel(count: entry.unpaidCount, total: entry.totalOwed, currency: entry.currency)
            }
            .padding(.bottom, 12)

            if entry.nextBill == nil {
                AllPaidView()
            } else {
                VStack(spacing: 6) {
                    ForEach(entry.upcomingBills.prefix(6)) { bill in
                        BillRow(bill: bill, currency: entry.currency)
                    }
                }
            }

            Spacer(minLength: 0)

            // Footer
            if entry.unpaidCount > 0 {
                VStack(alignment: .leading, spacing: 2) {
                    Divider().background(Color.surface2)
                    HStack {
                        Text("TOTAL UNPAID")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.txtLow)
                        Spacer()
                        Text("\(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
                            .font(.system(.title3, design: .monospaced, weight: .black))
                            .foregroundStyle(Color.txtHi)
                    }
                }
                .padding(.top, 10)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Lockscreen: Circular
// ─────────────────────────────────────────────────────────────────────────────

private struct LockCircularView: View {
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
                }
                .gaugeStyle(.accessoryCircular)
                .tint(bill.urgency.color)
            } else {
                Image(systemName: "checkmark.circle")
                    .font(.system(.body, weight: .medium))
                    .foregroundStyle(Color.judithAccent)
            }
        }
        .widgetLabel {
            if let bill = entry.nextBill {
                Text(bill.provider)
                    .font(.system(.caption2, design: .rounded))
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Lockscreen: Rectangular
// ─────────────────────────────────────────────────────────────────────────────

private struct LockRectangularView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {

            HStack(spacing: 4) {
                Text("JUDITH")
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
                Text("·")
                    .foregroundStyle(Color.txtLow)
                    .font(.system(size: 9))
                Text("NEXT DUE")
                    .font(.system(size: 9, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.txtLow)
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
                        .foregroundStyle(Color.txtHi)
                        .lineLimit(1)
                    Spacer()
                    Text(bill.amountDisplay(currency: entry.currency))
                        .font(.system(.body, design: .monospaced, weight: .bold))
                        .foregroundStyle(bill.urgency.color)
                }
                HStack(spacing: 2) {
                    Text("\(entry.unpaidCount) due")
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(Color.txtMid)
                    Text("·").foregroundStyle(Color.txtLow)
                    Text("\(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
                        .font(.system(.caption2, design: .monospaced, weight: .medium))
                        .foregroundStyle(Color.txtMid)
                }
            } else {
                Text("No unpaid bills")
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
            }
        }
        .padding(4)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Lockscreen: Inline (single line)
// ─────────────────────────────────────────────────────────────────────────────

private struct LockInlineView: View {
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

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Shared sub-views
// ─────────────────────────────────────────────────────────────────────────────

private struct BillRow: View {
    let bill: UpcomingBill
    let currency: String

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(bill.urgency.color)
                .frame(width: 5, height: 5)

            Text(bill.provider)
                .font(.system(.footnote, design: .rounded, weight: .medium))
                .foregroundStyle(Color.txtHi)
                .lineLimit(1)

            Spacer(minLength: 4)

            Text(bill.amountDisplay(currency: currency))
                .font(.system(.footnote, design: .monospaced, weight: .semibold))
                .foregroundStyle(bill.urgency.color)

            Text(bill.dueLabelShort.uppercased())
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(bill.urgency.color.opacity(0.8))
                .frame(width: 48, alignment: .trailing)
        }
    }
}

private struct DueBadge: View {
    let bill: UpcomingBill

    var body: some View {
        Text(bill.dueLabelShort.uppercased())
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(bill.urgency.color)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(bill.urgency.color.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 5))
    }
}

private struct SummaryLabel: View {
    let count: Int
    let total: Double
    let currency: String

    var body: some View {
        HStack(spacing: 3) {
            Text(count == 0 ? "All paid" : "\(count) due")
                .foregroundStyle(count == 0 ? Color.judithAccent : Color.txtMid)
            if count > 0 {
                Text("·").foregroundStyle(Color.txtLow)
                Text("\(currency)\(String(format: "%.0f", total))")
                    .foregroundStyle(Color.txtMid)
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
            }
        }
        .font(.system(size: 9))
    }
}

private struct AllPaidView: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(.title3))
                .foregroundStyle(Color.judithAccent)
            Text("All bills paid!")
                .font(.system(.callout, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.judithAccent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
