// BillDetailView.swift — one bill: provider, big amount, due, Mark paid / Snooze.
import SwiftUI

struct BillDetailView: View {
    @EnvironmentObject var store: BillStore
    let billID: String
    @State private var showPaid = false

    private var bill: Bill? { store.bills.first { $0.id == billID } }

    var body: some View {
        ScrollView {
            if let bill {
                VStack(spacing: 12) {
                    // category cap + urgency dot
                    HStack(spacing: 6) {
                        Circle().fill(bill.urgency.color).frame(width: 8, height: 8)
                        Text(bill.category.uppercased())
                            .font(.system(size: 10, weight: .semibold)).tracking(1.0)
                            .foregroundStyle(WatchTheme.textMid)
                    }
                    Text(bill.provider)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(WatchTheme.textHi)
                    Text(Money.format(bill.amount))
                        .font(WatchTheme.mono(40))
                        .foregroundStyle(bill.urgency == .overdue ? WatchTheme.overdue : WatchTheme.textHi)
                    Text(bill.duePhrase)
                        .font(.system(size: 13))
                        .foregroundStyle(bill.urgency == .overdue ? WatchTheme.overdue : WatchTheme.textMid)

                    // Mark paid (primary) — records payment, advances to next reminder.
                    Button {
                        store.markPaid(bill.id)
                        showPaid = true
                    } label: {
                        Text("Mark paid").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(WatchTheme.accent)

                    // Snooze 1 day (secondary).
                    Button { store.snooze(bill.id) } label: {
                        Text("Snooze 1 day").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(WatchTheme.textMid)
                }
                .padding(.horizontal, 6)
                .padding(.top, 4)
            } else {
                Text("Bill not found").foregroundStyle(WatchTheme.textMid).padding()
            }
        }
        .background(WatchTheme.canvas)
        .navigationTitle("Bill")
        .navigationDestination(isPresented: $showPaid) {
            if let bill { MarkedPaidView(provider: bill.provider, amount: bill.amount) }
        }
    }
}
