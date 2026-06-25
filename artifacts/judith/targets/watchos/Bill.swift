import Foundation
import SwiftUI

// MARK: — WatchPayload (mirrors lib/watch.ts WatchPayload interface)
// Decoded from the `judith_payload_v2` JSON string pushed by the phone app
// via WatchConnectivity transferUserInfo.

struct UpcomingBill: Codable, Identifiable, Hashable {
    let id: String
    let provider: String
    let cat: String?
    let amount: Double
    let dueDays: Int
    let dueLabel: String
    let isOverdue: Bool
    let optimisticTotalOwedDelta: Double
    let optimisticUnpaidCountDelta: Int

    // MARK: — Display helpers

    func amountDisplay(currency: String) -> String {
        "\(currency)\(amount.formattedForJudithWatchAmount)"
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
    // Optional fields added 2026-06-14: mirror phone hero card so the watch
    // ring + complications can show amount-based progress and overdue alerts
    // without opening the app. Decoded as nil for older cached payloads.
    let paidAmount: Double?
    let overdueCount: Int?
    let overdueTotal: Double?
    let next7Total: Double?
    /// Whether the user has accepted the AI-data-sharing disclosure on the
    /// paired iPhone. Apple Guideline 5.1.1(i)/5.1.2(i): the watch must not
    /// hit /watch-ask (Claude) or /watch-stt (ElevenLabs) until the user
    /// has explicitly opted in. Older cached payloads decode as nil, which
    /// the watch treats as "not consented" (safe default).
    let aiConsented: Bool?

    // MARK: — Derived helpers

    var totalOwedDisplay: String {
        "\(currency)\(totalOwed.formattedForJudithWatchAmount)"
    }

    var nextAmountDisplay: String {
        "\(currency)\(nextAmount.formattedForJudithWatchAmount)"
    }

    /// Amount-based paid fraction — matches the phone hero card. Falls back to
    /// count-based when an older cached payload lacks `paidAmount`.
    var paidFractionByAmount: Double? {
        guard let paid = paidAmount else { return nil }
        let grand = paid + totalOwed
        guard grand > 0 else { return nil }
        return paid / grand
    }

    var overdueTotalDisplay: String {
        "\(currency)\((overdueTotal ?? 0).formattedForJudithWatchAmount)"
    }

    var next7TotalDisplay: String {
        "\(currency)\((next7Total ?? 0).formattedForJudithWatchAmount)"
    }

    /// Optimistically remove a bill when mark-paid is tapped on the watch.
    func removing(billId: String) -> WatchPayload {
        guard let removed = upcomingBills.first(where: { $0.id == billId }) else { return self }
        let filtered = upcomingBills.filter { $0.id != billId }
        let removedAmount = removed.optimisticTotalOwedDelta
        let wasOverdue = removed.isOverdue
        let wasInNext7 = !wasOverdue && removed.dueDays <= 7
        return WatchPayload(
            generatedAt: generatedAt,
            currency: currency,
            totalOwed: max(0, totalOwed - removedAmount),
            unpaidCount: max(0, unpaidCount - removed.optimisticUnpaidCountDelta),
            nextProvider: filtered.first?.provider ?? "",
            nextAmount: filtered.first?.amount ?? 0,
            nextDueDays: filtered.first?.dueDays ?? 0,
            nextDueLabel: filtered.first?.dueLabel ?? "",
            persona: persona,
            upcomingBills: filtered,
            paidCount: paidCount + 1,
            totalCount: totalCount,
            paidAmount: paidAmount.map { max(0, $0) + removedAmount },
            overdueCount: overdueCount.map { wasOverdue ? max(0, $0 - 1) : $0 },
            overdueTotal: overdueTotal.map { wasOverdue ? max(0, $0 - removedAmount) : $0 },
            next7Total: next7Total.map { wasInNext7 ? max(0, $0 - removedAmount) : $0 },
            aiConsented: aiConsented
        )
    }
}

extension Double {
    var formattedForJudithWatchAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.positiveFormat = "#,##0"
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: self)) ?? String(format: "%.0f", self)
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
