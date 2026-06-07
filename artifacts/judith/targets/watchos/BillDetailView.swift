import SwiftUI

// MARK: — Bill detail with Mark Paid action

struct BillDetailView: View {
    let bill: UpcomingBill
    let currency: String
    let streak: Int
    let onPaid: (UpcomingBill) -> Void

    @EnvironmentObject var connectivity: ConnectivityService
    @Environment(\.dismiss) private var dismiss

    @State private var marking = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {

                // Urgency badge
                HStack {
                    Spacer()
                    UrgencyBadge(urgency: bill.urgency)
                }
                .padding(.horizontal, 4)
                .padding(.top, 8)

                // Provider name
                Text(bill.provider)
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.txtHi)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
                    .padding(.horizontal, 4)

                // Amount — big mono
                Text(bill.amountDisplay(currency: currency))
                    .font(.system(size: 36, design: .monospaced).weight(.bold))
                    .foregroundStyle(Color.txtHi)
                    .padding(.top, 6)

                // Due label
                Text(dueSubtitle)
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(bill.urgency.color)
                    .padding(.top, 4)

                // MARK: — Mark Paid
                Button {
                    guard !marking else { return }
                    marking = true
                    ConnectivityService.shared.sendMarkPaid(billId: bill.id)
                    onPaid(bill)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { dismiss() }
                } label: {
                    HStack {
                        if marking {
                            ProgressView().tint(.black).scaleEffect(0.8)
                        } else {
                            Image(systemName: "checkmark.circle.fill")
                        }
                        Text(marking ? "Marking…" : "Mark paid")
                            .font(.system(.body, design: .rounded).weight(.semibold))
                    }
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
                .background(Color.judithAccent)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .disabled(marking)
                .padding(.horizontal, 4)
                .padding(.top, 16)
                .padding(.bottom, 16)

                // Phone reachability hint
                if !connectivity.isPhoneReachable {
                    Text("Phone offline — will sync when reconnected")
                        .font(.system(.caption2))
                        .foregroundStyle(Color.txtLow)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 4)
                        .padding(.bottom, 8)
                }
            }
        }
        .background(Color.black)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var dueSubtitle: String {
        let d = bill.dueDays
        if d == 0  { return "Due today" }
        if d < 0   { return "\(-d) day\((-d) == 1 ? "" : "s") overdue" }
        if d == 1  { return "Due tomorrow" }
        return "Due in \(d) days"
    }
}

// MARK: — Urgency badge chip

private struct UrgencyBadge: View {
    let urgency: Urgency
    var body: some View {
        Text(urgency.label)
            .font(.system(size: 9, design: .rounded).weight(.semibold))
            .foregroundStyle(.black)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(urgency.color)
            .clipShape(Capsule())
    }
}
