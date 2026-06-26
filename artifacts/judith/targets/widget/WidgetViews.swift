import WidgetKit
import SwiftUI

// Standard Apple Dynamic Type point sizes used throughout this file:
// caption2=11, caption=12, footnote=13, callout=16, body=17, title3=20, title2=22

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
        ZStack {
            WidgetCardBackground()

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 5) {
                    JudithAvatar(size: 18)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("JUDITH")
                            .font(.system(size: 8, weight: .black, design: .rounded))
                            .foregroundStyle(Color.judithAccent)
                            .kerning(1.4)
                        Text("Bill tracker")
                            .font(.system(size: 7, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.txtLow)
                    }
                    Spacer()
                    if entry.unpaidCount > 0 {
                        Text("\(entry.unpaidCount)")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.txtHi)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(
                                Capsule()
                                    .fill(Color.surface1.opacity(0.9))
                            )
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.judithAccent)
                    }
                }
                .padding(.bottom, 12)

                if let bill = entry.nextBill {
                    Text("DUE THIS MONTH")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.txtLow)
                        .kerning(0.8)
                        .padding(.bottom, 6)

                    Text(fullAmount(entry.totalOwed, currency: entry.currency))
                        .font(.system(size: 24, weight: .black, design: .monospaced))
                        .foregroundStyle(Color.txtHi)
                        .minimumScaleFactor(0.72)
                        .lineLimit(1)
                        .padding(.bottom, 8)

                    Text(bill.provider)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.judithAccent)
                        .lineLimit(1)
                        .padding(.bottom, 4)

                    HStack(spacing: 6) {
                        DueBadge(bill: bill)
                        Text(bill.amountDisplay(currency: entry.currency))
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(bill.urgency.color)
                            .lineLimit(1)
                    }
                } else {
                    Spacer(minLength: 0)
                    AllPaidViewCompact(isStale: entry.isDataStale, debugState: entry.debugState)
                }

                Spacer(minLength: 0)

                HStack(spacing: 5) {
                    StatusDot(color: entry.nextBill?.urgency.color ?? Color.judithAccent)
                    Text(entry.unpaidCount == 0 ? "Nothing due right now" : "Next: \(entry.nextBill?.dueLabelShort ?? "")")
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.txtMid)
                }
            }
            .padding(14)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Medium  (up to 3 bills)
// ─────────────────────────────────────────────────────────────────────────────

private struct MediumView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            WidgetCardBackground()

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 10) {
                    JudithAvatar(size: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("JUDITH")
                            .font(.system(size: 10, weight: .black, design: .rounded))
                            .foregroundStyle(Color.judithAccent)
                            .kerning(1.3)
                        Text(entry.nextBill == nil ? "Everything settled" : "Live bill snapshot")
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.txtLow)
                    }
                    Spacer()
                    SummaryPill(count: entry.unpaidCount,
                                total: entry.totalOwed,
                                currency: entry.currency)
                }
                .padding(.bottom, 12)

                if entry.nextBill == nil {
                    AllPaidView(isStale: entry.isDataStale, debugState: entry.debugState)
                } else {
                    VStack(spacing: 10) {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("Due this month")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundStyle(Color.txtLow)
                                    .kerning(0.5)
                                Text(fullAmount(entry.totalOwed, currency: entry.currency))
                                    .font(.system(size: 28, weight: .black, design: .monospaced))
                                    .foregroundStyle(Color.txtHi)
                                    .minimumScaleFactor(0.75)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(entry.nextBill?.provider.uppercased() ?? "")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundStyle(entry.nextBill?.urgency.color ?? Color.judithAccent)
                                    .kerning(0.7)
                                    .lineLimit(1)
                                Text(entry.nextBill?.dueLabelShort.uppercased() ?? "")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Color.txtMid)
                            }
                        }

                        HStack(spacing: 8) {
                            StatChip(label: "\(entry.unpaidCount) unpaid", color: entry.nextBill?.urgency.color ?? Color.judithAccent)
                            if let bill = entry.nextBill {
                                StatChip(label: compactAmount(bill.amount, currency: entry.currency), color: bill.urgency.color)
                            }
                            Spacer(minLength: 0)
                        }

                        VStack(spacing: 7) {
                            ForEach(entry.upcomingBills.prefix(2)) { bill in
                                BillRow(bill: bill, currency: entry.currency)
                            }
                        }
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color.surface1.opacity(0.95))
                    )
                }

                Spacer(minLength: 0)
            }
            .padding(14)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Large  (up to 6 bills + total footer)
// ─────────────────────────────────────────────────────────────────────────────

private struct LargeView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            WidgetCardBackground()

            VStack(alignment: .leading, spacing: 0) {
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
                    AllPaidView(isStale: entry.isDataStale, debugState: entry.debugState)
                } else {
                    VStack(spacing: 10) {
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Due this month")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundStyle(Color.txtLow)
                                    .kerning(0.5)
                                Text(fullAmount(entry.totalOwed, currency: entry.currency))
                                    .font(.system(size: 32, weight: .black, design: .monospaced))
                                    .foregroundStyle(Color.txtHi)
                                    .minimumScaleFactor(0.8)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 10)
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(entry.nextBill?.provider.uppercased() ?? "")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundStyle(entry.nextBill?.urgency.color ?? Color.judithAccent)
                                    .kerning(0.8)
                                    .lineLimit(1)
                                Text(entry.nextBill?.dueLabelShort.uppercased() ?? "")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Color.txtMid)
                            }
                        }
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Color.surface1.opacity(0.95))
                        )
                        .padding(14)

                        HStack(spacing: 8) {
                            StatChip(label: "\(entry.unpaidCount) unpaid", color: entry.nextBill?.urgency.color ?? Color.judithAccent)
                            if let bill = entry.nextBill {
                                StatChip(label: compactAmount(bill.amount, currency: entry.currency), color: bill.urgency.color)
                            }
                            Spacer(minLength: 0)
                        }

                        VStack(spacing: 6) {
                            ForEach(entry.upcomingBills.prefix(4)) { bill in
                                BillRow(bill: bill, currency: entry.currency)
                            }
                        }
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Homescreen: Calendar Widget
// ─────────────────────────────────────────────────────────────────────────────

struct JudithCalendarWidgetView: View {
    let entry: JudithEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .systemSmall:  CalendarSmallView(entry: entry)
        case .systemMedium: CalendarMediumView(entry: entry)
        case .systemLarge:  CalendarLargeView(entry: entry)
        default:            CalendarSmallView(entry: entry)
        }
    }
}

private struct CalendarSmallView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            CalendarWidgetBackground()
            VStack(alignment: .leading, spacing: 9) {
                CalendarHeader(entry: entry, compact: true)
                Text(fullAmount(entry.calendarMonthTotal, currency: entry.currency))
                    .font(.system(size: 26, weight: .black, design: .monospaced))
                    .foregroundStyle(Color.judithAccent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.68)
                CalendarBubbleStrip(entry: entry, limit: 4)
                Spacer(minLength: 0)
                CalendarLegendInline()
            }
            .padding(14)
        }
    }
}

private struct CalendarMediumView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            CalendarWidgetBackground()
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    CalendarHeader(entry: entry, compact: false)
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(fullAmount(entry.calendarMonthTotal, currency: entry.currency))
                            .font(.system(size: 24, weight: .black, design: .monospaced))
                            .foregroundStyle(Color.judithAccent)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Text("\(entry.calendarThisWeekCount) this week")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(Color.txtLow)
                    }
                }
                CalendarBubbleStrip(entry: entry, limit: 7)
                CalendarLegendInline()
                Spacer(minLength: 0)
            }
            .padding(14)
        }
    }
}

private struct CalendarLargeView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            CalendarWidgetBackground()
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    CalendarHeader(entry: entry, compact: false)
                    Spacer(minLength: 10)
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(fullAmount(entry.calendarMonthTotal, currency: entry.currency))
                            .font(.system(size: 30, weight: .black, design: .monospaced))
                            .foregroundStyle(Color.judithAccent)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                        Text("\(entry.calendarDays.reduce(0) { $0 + $1.dueCount }) unpaid · \(entry.calendarThisWeekCount) this week")
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundStyle(Color.txtMid)
                    }
                }
                CalendarMonthGrid(entry: entry)
                CalendarLegendInline()
                Spacer(minLength: 0)
            }
            .padding(16)
        }
    }
}

private struct CalendarHeader: View {
    let entry: JudithEntry
    let compact: Bool

    var body: some View {
        HStack(spacing: compact ? 6 : 8) {
            JudithAvatar(size: compact ? 18 : 24)
            VStack(alignment: .leading, spacing: 1) {
                Text("CALENDAR")
                    .font(.system(size: compact ? 8 : 10, weight: .black, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
                    .kerning(1.2)
                Text(entry.calendarMonthLabel)
                    .font(.system(size: compact ? 8 : 10, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.txtLow)
                    .lineLimit(1)
            }
        }
    }
}

private struct CalendarWidgetBackground: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Color(hex: "#171a22"), Color(hex: "#20242e")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.06), lineWidth: 1)
            )
    }
}

private struct CalendarBubbleStrip: View {
    let entry: JudithEntry
    let limit: Int

    var body: some View {
        HStack(alignment: .center, spacing: 7) {
            ForEach(Array(entry.calendarDays.prefix(limit))) { day in
                CalendarAmountBubble(
                    day: day,
                    currency: entry.currency,
                    maxAmount: maxDayAmount(entry.calendarDays),
                    compact: true
                )
            }
            Spacer(minLength: 0)
        }
    }
}

private struct CalendarMonthGrid: View {
    let entry: JudithEntry

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
    private let weekdays = ["S", "M", "T", "W", "T", "F", "S"]

    private var daysByNumber: [Int: CalendarDaySummary] {
        Dictionary(uniqueKeysWithValues: entry.calendarDays.map { ($0.day, $0) })
    }

    private var monthStart: Date? {
        guard let key = entry.calendarMonth else { return Date() }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: "\(key)-01")
    }

    private var daysInMonth: Int {
        guard let monthStart else { return 31 }
        return Calendar.current.range(of: .day, in: .month, for: monthStart)?.count ?? 31
    }

    private var firstWeekday: Int {
        guard let monthStart else { return 0 }
        return Calendar.current.component(.weekday, from: monthStart) - 1
    }

    private var cells: [Int?] {
        var result: [Int?] = Array(repeating: nil, count: firstWeekday)
        result.append(contentsOf: (1...daysInMonth).map { Optional($0) })
        while result.count % 7 != 0 { result.append(nil) }
        return result
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { _, weekday in
                    Text(weekday)
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.txtLow)
                        .frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: columns, spacing: 3) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
                    if let day {
                        CalendarAmountBubble(
                            day: daysByNumber[day],
                            fallbackDay: day,
                            currency: entry.currency,
                            maxAmount: maxDayAmount(entry.calendarDays),
                            compact: false
                        )
                    } else {
                        Color.clear.frame(height: 33)
                    }
                }
            }
        }
    }
}

private struct CalendarAmountBubble: View {
    let day: CalendarDaySummary?
    var fallbackDay: Int? = nil
    let currency: String
    let maxAmount: Double
    let compact: Bool

    private var displayDay: Int {
        day?.day ?? fallbackDay ?? 0
    }

    private var bubbleSize: CGFloat {
        guard let day, day.dueCount > 0 else { return day?.paidCount ?? 0 > 0 ? 22 : 0 }
        let maxSize: CGFloat = compact ? 40 : 32
        let minSize: CGFloat = compact ? 24 : 14
        return minSize + CGFloat(day.amount / maxAmount) * (maxSize - minSize)
    }

    private var amountText: String {
        guard let day, day.amount > 0 else { return "" }
        return compactAmount(day.amount, currency: currency)
    }

    var body: some View {
        ZStack {
            if let day, day.dueCount > 0 {
                Circle()
                    .fill(day.urgency.color.opacity(0.88))
                    .frame(width: bubbleSize, height: bubbleSize)
                    .shadow(color: day.urgency.color.opacity(compact ? 0.35 : 0.2), radius: compact ? 6 : 3)
            } else if day?.paidCount ?? 0 > 0 {
                Circle()
                    .stroke(Color.txtLow.opacity(0.35), lineWidth: 1)
                    .frame(width: bubbleSize, height: bubbleSize)
            }

            VStack(spacing: compact ? 1 : 0) {
                Text(amountText)
                    .font(.system(size: compact ? 8 : 6, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.txtHi)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .frame(height: compact ? 10 : 7)
                Text("\(displayDay)")
                    .font(.system(size: compact ? 15 : 9, weight: day == nil ? .medium : .black, design: .rounded))
                    .foregroundStyle(day == nil ? Color.txtLow.opacity(0.55) : Color.txtHi)
                    .frame(height: compact ? 18 : 11)
            }
        }
        .frame(height: compact ? 48 : 33)
        .frame(maxWidth: .infinity)
    }
}

private struct CalendarLegendInline: View {
    var body: some View {
        HStack(spacing: 10) {
            CalendarLegendItem(color: Color.judithUrgent, label: "soon")
            CalendarLegendItem(color: Color.judithNear, label: "week")
            CalendarLegendItem(color: Color.judithOK, label: "later")
        }
    }
}

private struct CalendarLegendItem: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 8, weight: .bold, design: .rounded))
                .foregroundStyle(Color.txtLow)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK: — Lockscreen: Circular
// ─────────────────────────────────────────────────────────────────────────────

private struct LockCircularCurrentValue: View {
    let bill: UpcomingBill
    var body: some View {
        Text(bill.dueDays <= 0 ? "!" : "\(bill.dueDays)")
            .font(.system(size: 17, weight: .bold, design: .monospaced))
            .foregroundStyle(bill.urgency.color)
    }
}

private struct LockCircularLabel: View {
    var body: some View {
        Text("J")
            .font(.system(size: 7, weight: .black, design: .rounded))
            .foregroundStyle(Color.judithAccent)
    }
}

private struct LockCircularView: View {
    let entry: JudithEntry

    var body: some View {
        ZStack {
            if let bill = entry.nextBill {
                let d = Double(max(0, min(bill.dueDays, 30)))
                Gauge(value: 1.0 - d / 30.0) {
                    LockCircularLabel()
                } currentValueLabel: {
                    LockCircularCurrentValue(bill: bill)
                }
                .gaugeStyle(.accessoryCircular)
                .tint(bill.urgency.color)
            } else {
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
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    HStack(spacing: 3) {
                        Text(bill.amountDisplay(currency: entry.currency))
                            .font(.system(size: 16, weight: .black, design: .monospaced))
                            .foregroundStyle(bill.urgency.color)
                        Spacer()
                        Text("\(entry.unpaidCount) due")
                            .font(.system(size: 8, design: .rounded))
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("All bills paid!")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
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
            RoundedRectangle(cornerRadius: 2)
                .fill(bill.urgency.color)
                .frame(width: 4)
                .padding(.vertical, 5)
                .padding(.trailing, 10)

            Text(bill.provider)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.txtHi)
                .lineLimit(1)
                .layoutPriority(1)

            Spacer(minLength: 4)

            Text(compactAmount(bill.amount, currency: currency))
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.txtHi)
                .lineLimit(1)
                .fixedSize()

            Text(bill.dueLabelShort.uppercased())
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(bill.urgency.color)
                .frame(width: 46, alignment: .trailing)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.surface1.opacity(0.95))
        )
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
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(count)")
                        .foregroundStyle(Color.txtHi)
                    Text("\(currency)\(String(format: "%.0f", total))")
                        .foregroundStyle(Color.txtMid)
                }
            }
        }
        .font(.system(size: 9, weight: .semibold, design: .rounded))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color.surface1.opacity(0.92))
        )
    }
}

private struct AllPaidView: View {
    let isStale: Bool
    let debugState: String?

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill((isStale ? Color.judithNear : Color.judithAccent).opacity(0.12))
                    .frame(width: 38, height: 38)
                Image(systemName: isStale ? "clock.arrow.circlepath" : "checkmark")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(isStale ? Color.judithNear : Color.judithAccent)
            }
            VStack(alignment: .leading, spacing: 2) {
                if let debugState {
                    Text("Widget sync: \(debugState)")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Color.judithUrgent)
                } else if isStale {
                    Text("Open Judith to refresh")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.judithNear)
                    Text("Widget data may be outdated.")
                        .font(.system(size: 11, design: .rounded))
                        .foregroundStyle(Color.txtLow)
                } else {
                    Text("All bills paid!")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.judithAccent)
                    Text("Nothing due right now.")
                        .font(.system(size: 11, design: .rounded))
                        .foregroundStyle(Color.txtLow)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct AllPaidViewCompact: View {
    let isStale: Bool
    let debugState: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack {
                Circle()
                    .fill((isStale ? Color.judithNear : Color.judithAccent).opacity(0.14))
                    .frame(width: 32, height: 32)
                Image(systemName: isStale ? "clock.arrow.circlepath" : "checkmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(isStale ? Color.judithNear : Color.judithAccent)
            }
            if let debugState {
                Text(debugState)
                    .font(.system(size: 8, design: .monospaced))
                    .foregroundStyle(Color.judithUrgent)
            } else if isStale {
                Text("Tap to refresh")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.judithNear)
            } else {
                Text("All paid!")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
            }
        }
    }
}

private struct WidgetCardBackground: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.surface1, Color.surface2],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Circle()
                .fill(Color.judithAccent.opacity(0.14))
                .frame(width: 120, height: 120)
                .offset(x: -90, y: 70)

            Circle()
                .fill(Color.judithAccent.opacity(0.08))
                .frame(width: 160, height: 160)
                .offset(x: 110, y: -80)

            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color.white.opacity(0.05), lineWidth: 1)
        }
    }
}

private struct MiniSummaryPill: View {
    let count: Int
    let total: Double
    let currency: String

    var body: some View {
        HStack(spacing: 4) {
            if count == 0 {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Color.judithAccent)
                Text("CLEAR")
                    .font(.system(size: 8, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.judithAccent)
            } else {
                Text("\(count)")
                    .font(.system(size: 8, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.txtHi)
                Text("·")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Color.txtLow)
                Text("\(currency)\(String(format: "%.0f", total))")
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.txtMid)
            }
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color.surface1.opacity(0.9))
        )
    }
}

private struct StatusDot: View {
    let color: Color

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 7, height: 7)
    }
}

private struct StatChip: View {
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            StatusDot(color: color)
            Text(label)
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.txtMid)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color.surface1.opacity(0.92))
        )
    }
}

private func maxDayAmount(_ days: [CalendarDaySummary]) -> Double {
    max(1, days.map(\.amount).max() ?? 1)
}

private func compactAmount(_ amount: Double, currency: String) -> String {
    let absolute = abs(amount)
    if absolute >= 10_000 {
        return "\(currency)\(Int((amount / 1_000).rounded()))k"
    }
    if absolute >= 1_000 {
        return "\(currency)\(String(format: "%.1f", amount / 1_000))k"
            .replacingOccurrences(of: ".0k", with: "k")
    }
    return "\(currency)\(String(format: "%.0f", amount))"
}

private func fullAmount(_ amount: Double, currency: String) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = 0
    formatter.groupingSeparator = ","
    let number = formatter.string(from: NSNumber(value: amount)) ?? String(format: "%.0f", amount)
    return "\(currency)\(number)"
}
