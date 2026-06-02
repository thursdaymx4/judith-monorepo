import WatchKit
import SwiftUI
import UserNotifications

// MARK: — Screen 2: Long-look notification with inline Mark Paid / Remind Tomorrow

class NotificationController: WKUserNotificationHostingController<NotificationView> {

    var bill: NotificationBill?

    override var body: NotificationView {
        NotificationView(bill: bill)
    }

    override func didReceive(_ notification: UNNotification) {
        let info = notification.request.content.userInfo
        bill = NotificationBill(
            id:       info["bill_id"]      as? String ?? "",
            provider: info["provider"]     as? String ?? "Bill",
            amount:   info["amount"]       as? Double,
            daysUntil: info["days_until"]  as? Int ?? 0
        )
    }
}

// MARK: — Notification payload model

struct NotificationBill {
    let id: String
    let provider: String
    let amount: Double?
    let daysUntil: Int

    var amountDisplay: String {
        guard let a = amount else { return "" }
        return "₱\(String(format: "%.0f", a))"
    }

    var dueLabel: String {
        if daysUntil == 0 { return "due today" }
        if daysUntil == 1 { return "due tomorrow" }
        return "due in \(daysUntil) days"
    }

    var urgencyColor: Color {
        if daysUntil < 0 { return .judithOverdue }
        if daysUntil <= 3 { return .judithUrgent }
        return .judithNear
    }
}

// MARK: — Long-look SwiftUI view

struct NotificationView: View {
    let bill: NotificationBill?

    var body: some View {
        VStack(spacing: 0) {
            // Header: Judith avatar + wordmark
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [Color(hex: "#959af4"), Color(hex: "#433a85")],
                            startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 24, height: 24)
                    Text("J")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                Text("Judith")
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .foregroundStyle(.txtHi)
                Spacer()
                Text("now")
                    .font(.system(.caption2))
                    .foregroundStyle(.txtLow)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 8)

            Divider().background(Color.surface2)

            if let b = bill {
                VStack(spacing: 6) {
                    // Title
                    Text(b.provider)
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(.txtHi)
                        .multilineTextAlignment(.center)

                    // Due label
                    Text(b.dueLabel.capitalized)
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(b.urgencyColor)

                    // Amount
                    if !b.amountDisplay.isEmpty {
                        Text(b.amountDisplay)
                            .font(.system(size: 28, weight: .bold, design: .monospaced))
                            .foregroundStyle(.txtHi)
                            .padding(.top, 2)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            } else {
                ProgressView()
                    .padding()
            }
        }
        .background(Color.black)
        // The system appends the UNNotificationAction buttons below this view
    }
}
