import SwiftUI

// MARK: — Calendar summary (mirrors the iPhone Calendar tab current month)

struct CalendarView: View {
    @EnvironmentObject var store: WatchStore

    private var maxWeekAmount: Double {
        max(1, store.calendarWeeks.map(\.amount).max() ?? 1)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                header

                if store.calendarDays.isEmpty {
                    emptyState
                } else {
                    weekBars
                    dayMarkers
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
                CalendarStat(label: "bills", value: "\(store.calendarDays.reduce(0) { $0 + $1.dueCount })")
                CalendarStat(label: "this week", value: "\(store.calendarThisWeekCount)")
            }
        }
        .padding(10)
        .background(Color.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var weekBars: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Weekly totals")
                .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.txtLow)

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(store.calendarWeeks) { week in
                    VStack(spacing: 4) {
                        Text(week.amount > 0 ? shortAmount(week.amount) : "-")
                            .font(.system(size: 8, design: .monospaced).weight(.semibold))
                            .foregroundStyle(week.amount > 0 ? Color.txtHi : Color.txtLow)
                            .lineLimit(1)
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .fill(week.amount > 0 ? Color.judithAccent : Color.surface2)
                            .frame(height: max(8, CGFloat(week.amount / maxWeekAmount) * 44))
                        Text(week.label)
                            .font(.system(size: 8, design: .rounded).weight(.medium))
                            .foregroundStyle(Color.txtLow)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(minHeight: 74, alignment: .bottom)
        }
        .padding(10)
        .background(Color.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var dayMarkers: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Due dates")
                .font(.system(Font.TextStyle.caption2, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.txtLow)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                ForEach(store.calendarDays) { day in
                    VStack(spacing: 3) {
                        Text("\(day.day)")
                            .font(.system(size: 15, design: .rounded).weight(.bold))
                            .foregroundStyle(Color.txtHi)
                        Text(day.dueCount > 0 ? "\(day.dueCount) due" : "paid")
                            .font(.system(size: 8, design: .rounded).weight(.semibold))
                            .foregroundStyle(day.dueCount > 0 ? day.urgency.color : Color.txtLow)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, minHeight: 42)
                    .background(Color.surface2)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(day.dueCount > 0 ? day.urgency.color.opacity(0.8) : Color.txtLow.opacity(0.25), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
        .padding(10)
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

    private func shortAmount(_ amount: Double) -> String {
        if amount >= 1_000 {
            return "\(store.currency)\(Int((amount / 1_000).rounded()))k"
        }
        return "\(store.currency)\(amount.formattedForJudithWatchAmount)"
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
