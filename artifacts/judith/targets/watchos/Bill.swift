import Foundation
import SwiftUI

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
    let optimisticTotalOwedDelta: Double
    let optimisticUnpaidCountDelta: Int

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
    /// Bills already marked paid this month — drives the watch complication gauge.
    let paidCount: Int
    /// Bills due this month (paid + unpaid) — gauge denominator.
    let totalCount: Int

    // MARK: — Derived helpers

    var totalOwedDisplay: String {
        "\(currency)\(String(format: "%.0f", totalOwed))"
    }

    var nextAmountDisplay: String {
        "\(currency)\(String(format: "%.0f", nextAmount))"
    }

    /// Optimistically remove a bill when mark-paid is tapped on the watch.
    func removing(billId: String) -> WatchPayload {
        guard let removed = upcomingBills.first(where: { $0.id == billId }) else { return self }
        let filtered = upcomingBills.filter { $0.id != billId }
        return WatchPayload(
            generatedAt: generatedAt,
            currency: currency,
            totalOwed: max(0, totalOwed - removed.optimisticTotalOwedDelta),
            unpaidCount: max(0, unpaidCount - removed.optimisticUnpaidCountDelta),
            nextProvider: filtered.first?.provider ?? "",
            nextAmount: filtered.first?.amount ?? 0,
            nextDueDays: filtered.first?.dueDays ?? 0,
            nextDueLabel: filtered.first?.dueLabel ?? "",
            persona: persona,
            upcomingBills: filtered,
            paidCount: paidCount + 1,
            totalCount: totalCount
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
