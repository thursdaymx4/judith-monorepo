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
// MARK: — Judith brand avatar (circular crop of JudithAvatar.png)
// ─────────────────────────────────────────────────────────────────────────────

private struct JudithAvatar: View {
    var size: CGFloat = 24
    var body: some View {
        Image("JudithAvatar")
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .clipShape(Circle())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Small
// ─────────────────────────────────────────────────────────────────────────────

private struct SmallView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Brand header
            HStack(spacing: 5) {
                JudithAvatar(size: 18)
                Text("JUDITH")
                    .font(.system(size: 8, weight: .black, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
                    .kerning(1.4)
                Spacer()
            }
            .padding(.bottom, 11)

            if let bill = entry.nextBill {

                // Provider
                Text(bill.provider)
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .foregroundStyle(Color.txtMid)
                    .lineLimit(1)
                    .padding(.bottom, 1)

                // Amount — hero number
                Text(bill.amountDisplay(currency: entry.currency))
                    .font(.system(.title2, design: .monospaced, weight: .black))
                    .foregroundStyle(bill.urgency.color)
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                    .padding(.bottom, 8)

                DueBadge(bill: bill)

            } else {
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(Color.judithAccent.opacity(0.14))
                            .frame(width: 32, height: 32)
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.judithAccent)
                    }
                    Text("All paid!")
                        .font(.system(.caption, design: .rounded, weight: .bold))
                        .foregroundStyle(Color.judithAccent)
                }
            }

            Spacer(minLength: 0)

            // Footer count
            HStack(spacing: 3) {
                if entry.unpaidCount == 0 {
                    Text("Nothing due")
                        .font(.system(size: 9, design: .rounded, weight: .medium))
                        .foregroundStyle(Color.judithAccent.opacity(0.7))
                } else {
                    Text("\(entry.unpaidCount) due")
                        .font(.system(size: 9, design: .rounded, weight: .medium))
                        .foregroundStyle(Color.txtLow)
                    Text("·").foregroundStyle(Color.txtLow).font(.system(size: 9))
                    Text("\(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.txtMid)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Medium  (up to 3 bills)
// ─────────────────────────────────────────────────────────────────────────────

private struct MediumView: View {
    let entry: JudithEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Brand header
            HStack(spacing: 7) {
                JudithAvatar(size: 22)
                Text("JUDITH")
                    .font(.system(size: 10, weight: .black, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
                    .kerning(1.2)
                Spacer()
                SummaryPill(count: entry.unpaidCount,
                            total: entry.totalOwed,
                            currency: entry.currency)
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

            // Brand header
            HStack(spacing: 8) {
                JudithAvatar(size: 28)
                VStack(alignment: .leading, spacing: 0) {
                    Text("JUDITH")
                        .font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(Color.judithAccent)
                        .kerning(1.2)
                    Text("Bill tracker")
                        .font(.system(size: 8, design: .rounded))
                        .foregroundStyle(Color.txtLow)
                }
                Spacer()
                SummaryPill(count: entry.unpaidCount,
                            total: entry.totalOwed,
                            currency: entry.currency)
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

            // Footer total
            if entry.unpaidCount > 0 {
                VStack(spacing: 7) {
                    Rectangle()
                        .fill(Color.surface2)
                        .frame(height: 1)
                    HStack {
                        HStack(spacing: 4) {
                            JudithAvatar(size: 14)
                            Text("TOTAL DUE")
                                .font(.system(size: 8, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.txtLow)
                                .kerning(0.5)
                        }
                        Spacer()
                        Text("\(entry.currency)\(String(format: "%.0f", entry.totalOwed))")
                            .font(.system(.title3, design: .monospaced, weight: .black))
                            .foregroundStyle(Color.txtHi)
                    }
                }
                .padding(.top, 8)
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
                    Text("J")
                        .font(.system(size: 7, weight: .black, design: .rounded))
                        .foregroundStyle(Color.judithAccent)
                } currentValueLabel: {
                    Text(bill.dueDays <= 0 ? "!" : "\(bill.dueDays)")
                        .font(.system(.body, design: .monospaced, weight: .bold))
                        .foregroundStyle(bill.urgency.color)
                }
                .gaugeStyle(.accessoryCircular)
                .tint(bill.urgency.color)
            } else {
                // All paid state
                ZStack {
                    Circle()
                        .strokeBorder(Color.judithAccent.opacity(0.5), lineWidth: 2)
                    VStack(spacing: 0) {
                        Text("J")
                            .font(.system(size: 10, weight: .black, design: .rounded))
                            .foregroundStyle(Color.judithAccent)
                        Image(systemName: "checkmark")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.judithAccent)
                    }
                }
            }
        }
        .widgetLabel {
            if let bill = entry.nextBill {
                Label(bill.provider, systemImage: "creditcard.fill")
            } else {
                Label("Judith · All paid", systemImage: "checkmark.seal.fill")
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
        HStack(alignment: .center, spacing: 9) {

            // Branded left block
            VStack(spacing: 3) {
                JudithAvatar(size: 26)
                Text("JUDITH")
                    .font(.system(size: 6, weight: .black, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
                    .kerning(0.6)
            }

            // Divider
            Rectangle()
                .fill(Color.judithAccent.opacity(0.25))
                .frame(width: 1)
                .frame(maxHeight: .infinity)

            // Bill info
            VStack(alignment: .leading, spacing: 3) {
                if let bill = entry.nextBill {
                    HStack(spacing: 4) {
                        Text("NEXT DUE")
                            .font(.system(size: 7, weight: .bold, design: .rounded))
                            .foregroundStyle(.secondary)
                            .kerning(0.4)
                        Spacer()
                        Text(bill.dueLabelShort.uppercased())
                            .font(.system(size: 8, weight: .bold, design: .monospaced))
                            .foregroundStyle(bill.urgency.color)
                    }

                    Text(bill.provider)
                        .font(.system(.footnote, design: .rounded, weight: .bold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    HStack(spacing: 3) {
                        Text(bill.amountDisplay(currency: entry.currency))
                            .font(.system(.callout, design: .monospaced, weight: .black))
                            .foregroundStyle(bill.urgency.color)
                        Spacer()
                        Text("\(entry.unpaidCount) due")
                            .font(.system(size: 8, design: .rounded))
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("All bills paid!")
                        .font(.system(.footnote, design: .rounded, weight: .bold))
                        .foregroundStyle(Color.judithAccent)
                    Text("You're on top of it.")
                        .font(.system(size: 9, design: .rounded))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 3)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Lockscreen: Inline (single line — system-rendered text only)
// ─────────────────────────────────────────────────────────────────────────────

private struct LockInlineView: View {
    let entry: JudithEntry

    var body: some View {
        if let bill = entry.nextBill {
            Label(
                "\(bill.provider) · \(bill.amountDisplay(currency: entry.currency)) · \(bill.dueLabelShort)",
                systemImage: "j.circle.fill"
            )
        } else {
            Label("All bills paid", systemImage: "j.circle.fill")
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
        HStack(spacing: 0) {
            // Urgency accent bar
            RoundedRectangle(cornerRadius: 2)
                .fill(bill.urgency.color)
                .frame(width: 3)
                .padding(.vertical, 4)
                .padding(.trailing, 8)

            Text(bill.provider)
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.txtHi)
                .lineLimit(1)

            Spacer(minLength: 4)

            Text(bill.amountDisplay(currency: currency))
                .font(.system(.caption, design: .monospaced, weight: .bold))
                .foregroundStyle(Color.txtHi)
                .lineLimit(1)

            Text(bill.dueLabelShort.uppercased())
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundStyle(bill.urgency.color)
                .frame(width: 44, alignment: .trailing)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 7))
    }
}

private struct DueBadge: View {
    let bill: UpcomingBill

    var body: some View {
        Text(bill.dueLabelShort.uppercased())
            .font(.system(size: 8, weight: .bold, design: .monospaced))
            .foregroundStyle(bill.urgency.color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(bill.urgency.color.opacity(0.15))
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .strokeBorder(bill.urgency.color.opacity(0.35), lineWidth: 0.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 5))
    }
}

private struct SummaryPill: View {
    let count: Int
    let total: Double
    let currency: String

    var body: some View {
        Group {
            if count == 0 {
                HStack(spacing: 3) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 8))
                    Text("All paid")
                }
                .foregroundStyle(Color.judithAccent)
            } else {
                Text("\(count) · \(currency)\(String(format: "%.0f", total))")
                    .foregroundStyle(Color.txtMid)
            }
        }
        .font(.system(size: 9, weight: .semibold, design: .rounded))
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Color.surface1)
        .clipShape(Capsule())
    }
}

private struct AllPaidView: View {
    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(Color.judithAccent.opacity(0.12))
                    .frame(width: 38, height: 38)
                Image(systemName: "checkmark")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color.judithAccent)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("All bills paid!")
                    .font(.system(.callout, design: .rounded, weight: .bold))
                    .foregroundStyle(Color.judithAccent)
                Text("Nothing due right now.")
                    .font(.system(.caption2, design: .rounded))
                    .foregroundStyle(Color.txtLow)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}
