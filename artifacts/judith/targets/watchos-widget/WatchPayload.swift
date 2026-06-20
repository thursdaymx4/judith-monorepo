import Foundation

// MARK: — WatchPayload (mirrors lib/watch.ts WatchPayload interface)
// Duplicated from targets/watchos/Bill.swift on purpose — the extension is
// a separate Xcode target and cannot import from the watch app. Keep the
// codable shape strictly in sync with the watch app's copy.

struct UpcomingBill: Codable, Hashable {
    let id: String
    let provider: String
    let amount: Double
    let dueDays: Int
    let dueLabel: String
    let isOverdue: Bool
    let optimisticTotalOwedDelta: Double
    let optimisticUnpaidCountDelta: Int
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
    let paidCount: Int
    let totalCount: Int
    // Optional fields added 2026-06-14 — older cached payloads decode as nil.
    let paidAmount: Double?
    let overdueCount: Int?
    let overdueTotal: Double?
    let next7Total: Double?
    /// Whether the user accepted the AI-data-sharing disclosure on the
    /// paired iPhone. Mirrors the field in the watch app's Bill.swift —
    /// the complication doesn't use it, but the codable shape must match.
    let aiConsented: Bool?

    /// Amount-based paid fraction — mirrors the phone hero card. Returns nil
    /// when the cached payload predates the field so the complication can
    /// fall back to count-based.
    var paidFractionByAmount: Double? {
        guard let paid = paidAmount else { return nil }
        let grand = paid + totalOwed
        guard grand > 0 else { return nil }
        return paid / grand
    }
}
