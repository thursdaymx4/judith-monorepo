import SwiftUI

// MARK: — Single bill row for the Up Next list

struct BillRowView: View {
    let bill: UpcomingBill
    let currency: String

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(bill.urgency.color)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(bill.provider)
                    .font(.system(.body, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.txtHi)
                    .lineLimit(1)

                Text(bill.dueLabelShort)
                    .font(.system(.caption2, design: .rounded))
                    .foregroundStyle(dueLabelColor)
            }

            Spacer()

            Text(bill.amountDisplay(currency: currency))
                .font(.judithMono)
                .foregroundStyle(Color.txtHi)
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
