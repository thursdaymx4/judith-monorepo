import Foundation

// MARK: — WatchPayload (mirrors lib/watch.ts WatchPayload interface)
// Decoded from the `judith_payload_v2` JSON string pushed by the phone app
// via WatchConnectivity transferUserInfo.

struct UpcomingBill: Codable, Identifiable, Hashable {
    let id: String
    let provider: String
    let amount: Double
    let dueDays: Int
    let dueLabel: String
    let isOverdue: Bool

    // MARK: — Display helpers

    func amountDisplay(currency: String) -> String {
        "\(currency)\(String(format: "%.0f", amount))"
    }

    var dueLabelShort: String {
        if dueDays == 0  { return "Today" }
        if dueDays < 0   { return "\(-dueDays)d late" }
        if dueDays == 1  { return "Tomorrow" }
        return "\(dueDays)d"
    }

    var urgency: Urgency {
        if dueDays < 0  { return .overdue }
        if dueDays <= 3 { return .urgent }
        if dueDays <= 7 { return .near }
        return .ok
    }
}

struct WatchPayload: Codable {
    let generatedAt: String
    let currency: String
    let totalOwed: Double
    let unpaidCount: Int
    let nextProvider: String
    let nextAmount: Double
    let nextDueDays: Int
    let nextDueLabel: String
    let persona: String
    let upcomingBills: [UpcomingBill]

    // MARK: — Derived helpers

    var totalOwedDisplay: String {
        "\(currency)\(String(format: "%.0f", totalOwed))"
    }

    var nextAmountDisplay: String {
        "\(currency)\(String(format: "%.0f", nextAmount))"
    }

    func removing(billId: String) -> WatchPayload {
        WatchPayload(
            generatedAt: generatedAt,
            currency: currency,
            totalOwed: totalOwed,
            unpaidCount: max(0, unpaidCount - 1),
            nextProvider: nextProvider,
            nextAmount: nextAmount,
            nextDueDays: nextDueDays,
            nextDueLabel: nextDueLabel,
            persona: persona,
            upcomingBills: upcomingBills.filter { $0.id != billId }
        )
    }
}

// MARK: — Urgency

enum Urgency: Int, Comparable {
    case overdue = 0, urgent = 1, near = 2, ok = 3

    static func < (lhs: Urgency, rhs: Urgency) -> Bool { lhs.rawValue < rhs.rawValue }

    var color: Color {
        switch self {
        case .overdue: return .judithOverdue
        case .urgent:  return .judithUrgent
        case .near:    return .judithNear
        case .ok:      return .judithOK
        }
    }

    var label: String {
        switch self {
        case .overdue: return "Overdue"
        case .urgent:  return "Due soon"
        case .near:    return "Coming up"
        case .ok:      return "Upcoming"
        }
    }
}
