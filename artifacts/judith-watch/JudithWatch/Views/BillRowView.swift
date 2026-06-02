import SwiftUI

// MARK: — Single bill row for the Up Next list

struct BillRowView: View {
    let bill: Bill

    var body: some View {
        HStack(spacing: 10) {
            // Urgency dot
            Circle()
                .fill(bill.urgency.color)
                .frame(width: 8, height: 8)

            // Name + due label
            VStack(alignment: .leading, spacing: 2) {
                Text(bill.displayName)
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(.txtHi)
                    .lineLimit(1)

                Text(bill.dueLabelShort)
                    .font(.system(.caption2, design: .rounded))
                    .foregroundStyle(dueLabelColor)
            }

            Spacer()

            // Amount
            Text(bill.amountDisplay)
                .font(.judithMono)
                .foregroundStyle(.txtHi)
                .lineLimit(1)
        }
        .padding(.vertical, 4)
    }

    private var dueLabelColor: Color {
        switch bill.urgency {
        case .overdue: return .judithOverdue
        case .urgent:  return .judithUrgent
        case .near:    return .judithNear
        case .ok:      return .txtMid
        }
    }
}
