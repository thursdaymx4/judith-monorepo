import WatchKit
import SwiftUI
import UserNotifications

// MARK: — Long-look notification with Mark Paid action

class NotificationController: WKUserNotificationHostingController<NotificationView> {

    var bill: NotificationBill?

    override var body: NotificationView {
        NotificationView(bill: bill)
    }

    override func didReceive(_ notification: UNNotification) {
        let info = notification.request.content.userInfo

        // Read currency from the cached WatchPayload (App Group)
        var currency = "$"
        if let data = UserDefaults(suiteName: Config.appGroupID)?.data(forKey: Config.payloadCacheKey),
           let payload = try? JSONDecoder().decode(WatchPayload.self, from: data) {
            currency = payload.currency
        }

        bill = NotificationBill(
            id:        info["bill_id"]    as? String ?? "",
            provider:  info["provider"]   as? String ?? "Bill",
            amount:    info["amount"]     as? Double,
            daysUntil: info["days_until"] as? Int ?? 0,
            currency:  currency
        )
    }
}

// MARK: — Notification payload model

struct NotificationBill {
    let id: String
    let provider: String
    let amount: Double?
    let daysUntil: Int
    let currency: String

    var amountDisplay: String {
        guard let a = amount else { return "" }
        return "\(currency)\(String(format: "%.0f", a))"
    }

    var dueLabel: String {
        if daysUntil == 0 { return "due today" }
        if daysUntil == 1 { return "due tomorrow" }
        if daysUntil < 0  { return "\(-daysUntil) day\((-daysUntil) == 1 ? "" : "s") overdue" }
        return "due in \(daysUntil) days"
    }

    var urgencyColor: Color {
        if daysUntil < 0  { return .judithOverdue }
        if daysUntil <= 3 { return .judithUrgent }
        return .judithNear
    }
}

// MARK: — Long-look SwiftUI view

struct NotificationView: View {
    let bill: NotificationBill?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [Color(hex: "#959af4"), Color(hex: "#433a85")],
                            startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 24, height: 24)
                    Text("J")
                        .font(.system(size: 13, design: .rounded).weight(.bold))
                        .foregroundStyle(.white)
                }
                Text("Judith")
                    .font(.system(Font.TextStyle.caption, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.txtHi)
                Spacer()
                Text("now")
                    .font(.caption2)
                    .foregroundStyle(Color.txtLow)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 8)

            Divider().background(Color.surface2)

            if let b = bill {
                VStack(spacing: 6) {
                    Text(b.provider)
                        .font(.system(Font.TextStyle.headline, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.txtHi)
                        .multilineTextAlignment(.center)

                    Text(b.dueLabel.capitalized)
                        .font(.system(Font.TextStyle.caption, design: .rounded))
                        .foregroundStyle(b.urgencyColor)

                    if !b.amountDisplay.isEmpty {
                        Text(b.amountDisplay)
                            .font(.system(size: 28, design: .monospaced).weight(.bold))
                            .foregroundStyle(Color.txtHi)
                            .padding(.top, 2)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            } else {
                ProgressView().padding()
            }
        }
        .background(Color.black)
    }
}
