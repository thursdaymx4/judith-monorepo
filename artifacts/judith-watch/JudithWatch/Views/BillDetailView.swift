import SwiftUI

// MARK: — Screen 4: Bill detail with Mark Paid + Snooze

struct BillDetailView: View {
    let bill: Bill
    let onPaid: (Bill) -> Void

    @EnvironmentObject var store: BillStore
    @Environment(\.dismiss) private var dismiss

    @State private var marking = false
    @State private var snoozing = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {

                // Category + urgency badge
                HStack(spacing: 6) {
                    Image(systemName: bill.categoryIcon)
                        .font(.system(size: 11))
                        .foregroundStyle(.txtMid)
                    Text(bill.category.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.system(.caption2, design: .rounded))
                        .foregroundStyle(.txtMid)
                    Spacer()
                    UrgencyBadge(urgency: bill.urgency)
                }
                .padding(.horizontal, 4)
                .padding(.top, 8)

                // Provider name
                Text(bill.displayName)
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .foregroundStyle(.txtHi)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)
                    .padding(.horizontal, 4)

                // Amount — big mono
                Text(bill.amountDisplay)
                    .font(.system(size: 36, weight: .bold, design: .monospaced))
                    .foregroundStyle(.txtHi)
                    .padding(.top, 6)

                // Due label
                Text(dueSubtitle)
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(bill.urgency.color)
                    .padding(.top, 4)

                // MARK: — Actions
                VStack(spacing: 8) {
                    // Primary: Mark paid
                    Button {
                        guard !marking else { return }
                        marking = true
                        Task {
                            await store.markPaid(bill: bill)
                            onPaid(bill)
                            dismiss()
                        }
                    } label: {
                        HStack {
                            if marking {
                                ProgressView().tint(.black).scaleEffect(0.8)
                            } else {
                                Image(systemName: "checkmark.circle.fill")
                            }
                            Text(marking ? "Marking…" : "Mark paid")
                                .font(.system(.body, design: .rounded, weight: .semibold))
                        }
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                    }
                    .background(Color.judithAccent)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .disabled(marking)

                    // Secondary: Snooze
                    Button {
                        guard !snoozing else { return }
                        snoozing = true
                        Task {
                            await store.snooze(bill: bill)
                            dismiss()
                        }
                    } label: {
                        HStack {
                            if snoozing {
                                ProgressView().tint(.txtMid).scaleEffect(0.8)
                            } else {
                                Image(systemName: "moon.zzz.fill")
                            }
                            Text("Snooze 1 day")
                                .font(.system(.footnote, design: .rounded, weight: .medium))
                        }
                        .foregroundStyle(.txtMid)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                    }
                    .background(Color.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .disabled(snoozing)
                }
                .padding(.horizontal, 4)
                .padding(.top, 16)
                .padding(.bottom, 16)
            }
        }
        .background(Color.black)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var dueSubtitle: String {
        guard let d = bill.daysUntil else { return "No due date" }
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
            .font(.system(size: 9, weight: .semibold, design: .rounded))
            .foregroundStyle(.black)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(urgency.color)
            .clipShape(Capsule())
    }
}
