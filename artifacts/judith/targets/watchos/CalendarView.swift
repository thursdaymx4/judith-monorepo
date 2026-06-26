import SwiftUI

// MARK: — Calendar summary (mirrors the iPhone Calendar tab current month)

struct CalendarView: View {
    @EnvironmentObject var store: WatchStore

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 7)
    private let weekdays = ["S", "M", "T", "W", "T", "F", "S"]

    private var daysByNumber: [Int: CalendarDaySummary] {
        Dictionary(uniqueKeysWithValues: store.calendarDays.map { ($0.day, $0) })
    }

    private var monthGrid: [Int?] {
        var cells: [Int?] = Array(repeating: nil, count: firstWeekday)
        cells.append(contentsOf: (1...daysInMonth).map { Optional($0) })
        while cells.count % 7 != 0 { cells.append(nil) }
        return cells
    }

    private var daysInMonth: Int {
        guard let date = monthStart else { return 31 }
        return Calendar.current.range(of: .day, in: .month, for: date)?.count ?? 31
    }

    private var firstWeekday: Int {
        guard let date = monthStart else { return 0 }
        return Calendar.current.component(.weekday, from: date) - 1
    }

    private var monthStart: Date? {
        guard let key = store.payload?.calendarMonth else { return Date() }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: "\(key)-01")
    }

    private var maxDayAmount: Double {
        max(1, store.calendarDays.map(\.amount).max() ?? 1)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                header

                if store.calendarDays.isEmpty {
                    emptyState
                } else {
                    legend
                    nextDueStrip
                    calendarGrid
                }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 18)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.black)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Calendar")
                        .font(.system(Font.TextStyle.headline, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.txtHi)
                    Text(store.calendarMonthLabel)
                        .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.txtMid)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Text("\(store.currency)\(store.calendarMonthTotal.formattedForJudithWatchAmount)")
                    .font(.system(size: 22, design: .monospaced).weight(.bold))
                    .foregroundStyle(Color.judithAccent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .allowsTightening(true)
            }

            HStack(spacing: 8) {
                CalendarStat(label: "unpaid", value: "\(store.calendarDays.reduce(0) { $0 + $1.dueCount })")
                CalendarStat(label: "this week", value: "\(store.calendarThisWeekCount)")
            }
        }
        .padding(10)
        .background(Color.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var legend: some View {
        HStack(spacing: 8) {
            CalendarLegendDot(color: Color.judithUrgent, label: "soon")
            CalendarLegendDot(color: Color.judithNear, label: "week")
            CalendarLegendDot(color: Color.judithOK, label: "later")
        }
        .padding(.horizontal, 2)
    }

    private var nextDueDays: [CalendarDaySummary] {
        store.calendarDays
            .filter { $0.dueCount > 0 }
            .sorted {
                if $0.minDueDays != $1.minDueDays { return $0.minDueDays < $1.minDueDays }
                return $0.amount > $1.amount
            }
    }

    private var nextDueStrip: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Next due")
                .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.txtLow)

            HStack(spacing: 6) {
                ForEach(Array(nextDueDays.prefix(3))) { day in
                    CalendarDateBubble(
                        day: day.day,
                        summary: day,
                        currency: store.currency,
                        maxAmount: maxDayAmount,
                        compact: true
                    )
                }
                Spacer(minLength: 0)
            }
        }
        .padding(8)
        .background(Color.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var calendarGrid: some View {
        VStack(spacing: 5) {
            HStack(spacing: 3) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { _, day in
                    Text(day)
                        .font(.system(size: 8, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.txtLow)
                        .frame(maxWidth: .infinity)
                }
            }

            LazyVGrid(columns: columns, spacing: 5) {
                ForEach(Array(monthGrid.enumerated()), id: \.offset) { _, day in
                    if let day {
                        CalendarDateBubble(
                            day: day,
                            summary: daysByNumber[day],
                            currency: store.currency,
                            maxAmount: maxDayAmount
                        )
                    } else {
                        Color.clear.frame(height: 36)
                    }
                }
            }
        }
        .padding(8)
        .background(Color.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var emptyState: some View {
        Text("Open Judith on iPhone to sync your bill calendar.")
            .font(.system(Font.TextStyle.caption, design: .rounded))
            .foregroundStyle(Color.txtMid)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(16)
            .background(Color.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct CalendarDateBubble: View {
    let day: Int
    let summary: CalendarDaySummary?
    let currency: String
    let maxAmount: Double
    var compact: Bool = false

    private var amountText: String {
        guard let summary, summary.amount > 0 else { return "" }
        if summary.amount >= 1_000 {
            return "\(currency)\(String(format: "%.1fk", summary.amount / 1_000).replacingOccurrences(of: ".0k", with: "k"))"
        }
        return "\(currency)\(summary.amount.formattedForJudithWatchAmount)"
    }

    private var bubbleSize: CGFloat {
        guard let summary, summary.dueCount > 0 else { return 0 }
        return (compact ? 24 : 14) + CGFloat(summary.amount / maxAmount) * (compact ? 18 : 20)
    }

    var body: some View {
        ZStack {
            if let summary, summary.dueCount > 0 {
                Circle()
                    .fill(summary.urgency.color.opacity(0.88))
                    .frame(width: bubbleSize, height: bubbleSize)
                    .shadow(color: summary.urgency.color.opacity(0.35), radius: 5)
            } else if summary?.paidCount ?? 0 > 0 {
                Circle()
                    .stroke(Color.txtLow.opacity(0.35), lineWidth: 1)
                    .frame(width: 24, height: 24)
            }

            VStack(spacing: 0) {
                Text(amountText)
                    .font(.system(size: compact ? 8 : 6.5, design: .monospaced).weight(.bold))
                    .foregroundStyle(Color.txtHi)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .frame(height: compact ? 10 : 8)
                Text("\(day)")
                    .font(.system(size: compact ? 15 : 10, design: .rounded).weight(summary == nil ? .medium : .bold))
                    .foregroundStyle(summary == nil ? Color.txtLow : Color.txtHi)
                    .frame(height: compact ? 18 : 14)
            }
        }
        .frame(height: compact ? 48 : 36)
        .frame(maxWidth: .infinity)
    }
}

private struct CalendarLegendDot: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 8, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.txtLow)
        }
    }
}

private struct CalendarStat: View {
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 4) {
            Text(value)
                .font(.system(Font.TextStyle.caption, design: .rounded).weight(.bold))
                .foregroundStyle(Color.txtHi)
            Text(label)
                .font(.system(Font.TextStyle.caption2, design: .rounded))
                .foregroundStyle(Color.txtMid)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color.surface2)
        .clipShape(Capsule())
    }
}
