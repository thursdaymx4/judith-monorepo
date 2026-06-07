import SwiftUI

// MARK: — Up Next list (Digital Crown scrollable)

struct UpNextView: View {
    @EnvironmentObject var store: WatchStore
    @State private var paidBill: UpcomingBill? = nil
    @State private var showPaidConfirm = false

    var body: some View {
        NavigationStack {
            List {
                // Month-total header
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Up next")
                                .font(.system(.headline, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.txtHi)
                            Text("\(store.unpaidCount) unpaid")
                                .font(.system(.caption2))
                                .foregroundStyle(Color.txtMid)
                        }
                        Spacer()
                        Text(store.payload?.totalOwedDisplay ?? "—")
                            .font(.judithMonoLarge)
                            .foregroundStyle(Color.judithAccent)
                    }
                    .listRowBackground(Color.surface1)
                }

                if store.upcomingBills.isEmpty {
                    Section {
                        Text("All paid up 🎉")
                            .font(.system(.footnote))
                            .foregroundStyle(Color.txtMid)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .listRowBackground(Color.clear)
                    }
                } else {
                    Section {
                        ForEach(store.upcomingBills) { bill in
                            NavigationLink(value: bill) {
                                BillRowView(bill: bill, currency: store.currency)
                            }
                            .listRowBackground(Color.surface1)
                        }
                    }
                }
            }
            .listStyle(.carousel)
            .background(Color.black)
            .navigationDestination(for: UpcomingBill.self) { bill in
                BillDetailView(bill: bill,
                               currency: store.currency,
                               streak: store.streak,
                               onPaid: { paid in
                                   paidBill = paid
                                   showPaidConfirm = true
                               })
            }
            .sheet(isPresented: $showPaidConfirm) {
                if let bill = paidBill {
                    PaidConfirmView(
                        provider: bill.provider,
                        amountDisplay: bill.amountDisplay(currency: store.currency),
                        streak: store.streak
                    )
                }
            }
        }
    }
}
