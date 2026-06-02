import SwiftUI

// MARK: — Screen 3: Up Next list (Digital Crown scrollable)

struct UpNextView: View {
    @EnvironmentObject var store: BillStore
    @State private var selectedBill: Bill? = nil
    @State private var showPaidConfirm = false
    @State private var paidBill: Bill? = nil

    var body: some View {
        NavigationStack {
            List {
                // Month-total header
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Up next")
                                .font(.system(.headline, design: .rounded, weight: .bold))
                                .foregroundStyle(.txtHi)
                            Text("Total due")
                                .font(.system(.caption2))
                                .foregroundStyle(.txtMid)
                        }
                        Spacer()
                        Text(store.monthTotalDisplay)
                            .font(.judithMonoLarge)
                            .foregroundStyle(.judithAccent)
                    }
                    .listRowBackground(Color.surface1)
                }

                // Bill rows
                if store.isLoading && store.unpaidBills.isEmpty {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView().tint(.judithAccent)
                            Spacer()
                        }
                        .listRowBackground(Color.clear)
                    }
                } else if store.unpaidBills.isEmpty {
                    Section {
                        Text("No unpaid bills 🎉")
                            .font(.system(.footnote))
                            .foregroundStyle(.txtMid)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .listRowBackground(Color.clear)
                    }
                } else {
                    Section {
                        ForEach(store.unpaidBills) { bill in
                            NavigationLink(value: bill) {
                                BillRowView(bill: bill)
                            }
                            .listRowBackground(Color.surface1)
                        }
                    }
                }
            }
            .listStyle(.carousel)
            .background(Color.black)
            .navigationDestination(for: Bill.self) { bill in
                BillDetailView(bill: bill,
                               onPaid: { paid in
                                    paidBill = paid
                                    showPaidConfirm = true
                               })
            }
            .sheet(isPresented: $showPaidConfirm) {
                if let bill = paidBill {
                    PaidConfirmView(bill: bill, streak: store.streak)
                }
            }
            .refreshable { await store.refresh() }
        }
    }
}

private extension BillStore {
    var monthTotalDisplay: String {
        let t = monthTotal
        return t == 0 ? "₱0" : "₱\(String(format: "%.0f", t))"
    }
}
