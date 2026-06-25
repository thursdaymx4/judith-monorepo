import SwiftUI

// MARK: — Up Next list (Digital Crown scrollable)

struct UpNextView: View {
    @EnvironmentObject var store: WatchStore
    @EnvironmentObject var connectivity: ConnectivityService
    @State private var paidBill: UpcomingBill? = nil
    @State private var showPaidConfirm = false

    private var needsRefresh: Bool { store.isPayloadStale && !connectivity.isPhoneReachable }

    var body: some View {
        NavigationStack {
            List {
                // Month-total header
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Up next")
                                .font(.system(Font.TextStyle.headline, design: .rounded).weight(.bold))
                                .foregroundStyle(Color.txtHi)
                            Text(needsRefresh ? "Needs refresh" : "\(store.unpaidCount) unpaid")
                                .font(.caption2)
                                .foregroundStyle(needsRefresh ? Color.judithNear : Color.txtMid)
                        }
                        Spacer()
                        Text(store.payload?.totalOwedDisplay ?? "—")
                            .font(.system(size: 24, design: .monospaced).weight(.bold))
                            .foregroundStyle(Color.judithAccent)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .allowsTightening(true)
                            .layoutPriority(1)
                    }
                    .listRowBackground(Color.surface1)
                }

                if store.upcomingBills.isEmpty {
                    Section {
                        Text(needsRefresh ? "Open Judith on iPhone to refresh." : "All paid up")
                            .font(.footnote)
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
