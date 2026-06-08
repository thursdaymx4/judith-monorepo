// JudithWatchApp.swift — entry point + the main "Up next" surface.
// Surfaces (WATCH_APP.md): Up-next list · Bill detail · Marked-paid confirmation.
// The Today glance + Smart Stack live in the widget extension (JudithWidgets.swift).
import SwiftUI

@main
struct JudithWatchApp: App {
    @StateObject private var store = BillStore.shared
    var body: some Scene {
        WindowGroup {
            UpNextView().environmentObject(store)
        }
    }
}

/// Page 0 — "Up next": month total header + crown-scrollable bill rows → detail.
struct UpNextView: View {
    @EnvironmentObject var store: BillStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    // Header: total still due this month.
                    VStack(spacing: 2) {
                        Text("DUE THIS MONTH")
                            .font(.system(size: 9, weight: .semibold))
                            .tracking(1.4)
                            .foregroundStyle(WatchTheme.textMid)
                        Text(Money.format(store.totalDue))
                            .font(WatchTheme.mono(26))
                            .foregroundStyle(WatchTheme.textHi)
                        Text("\(store.dueCount) unpaid")
                            .font(.system(size: 11))
                            .foregroundStyle(WatchTheme.textLow)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)

                    ForEach(store.upcoming) { bill in
                        NavigationLink(value: bill) {
                            BillRow(bill: bill)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 4)
            }
            .background(WatchTheme.canvas)
            .navigationTitle("Up next")
            .navigationDestination(for: Bill.self) { BillDetailView(billID: $0.id) }
        }
        .tint(WatchTheme.accent)
    }
}

/// One bill row: urgency dot · provider + due · amount.
struct BillRow: View {
    let bill: Bill
    var body: some View {
        HStack(spacing: 10) {
            Circle().fill(bill.urgency.color).frame(width: 9, height: 9)
            VStack(alignment: .leading, spacing: 1) {
                Text(bill.provider)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(WatchTheme.textHi)
                    .lineLimit(1)
                Text(bill.dueShort)
                    .font(.system(size: 11))
                    .foregroundStyle(bill.urgency == .overdue ? WatchTheme.overdue : WatchTheme.textLow)
            }
            Spacer(minLength: 4)
            Text(Money.format(bill.amount))
                .font(WatchTheme.mono(14, .semibold))
                .foregroundStyle(WatchTheme.textHi)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}
