import SwiftUI
import Foundation

// MARK: — Config
// Keep in sync with JudithWatch/Config/Config.swift

enum Config {
    static let appGroupID      = "group.com.app.judith"
    static let payloadCacheKey = "judith.payload_v2"
}

// MARK: — Design tokens (mirrors constants/theme.ts)

extension Color {
    static let judithAccent  = Color(hex: "#29d5a5")
    static let judithOverdue = Color(hex: "#ea1d3b")
    static let judithUrgent  = Color(hex: "#ff645f")
    static let judithNear    = Color(hex: "#f7b83d")
    static let judithOK      = Color(hex: "#56d1a3")
    static let bgBase        = Color(hex: "#0e1018")
    static let surface1      = Color(hex: "#181b22")
    static let surface2      = Color(hex: "#1f232c")
    static let txtHi         = Color(hex: "#f3f5f8")
    static let txtMid        = Color(hex: "#a7adba")
    static let txtLow        = Color(hex: "#6a7180")

    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        self.init(
            red:   Double((int >> 16) & 0xFF) / 255,
            green: Double((int >>  8) & 0xFF) / 255,
            blue:  Double( int        & 0xFF) / 255
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
}

// MARK: — WatchPayload (Codable — must stay in sync with lib/watch.ts)

struct UpcomingBill: Codable, Identifiable {
    let id: String
    let provider: String
    let amount: Double
    let dueDays: Int
    let dueLabel: String
    let isOverdue: Bool

    var urgency: Urgency {
        if dueDays < 0  { return .overdue }
        if dueDays <= 3 { return .urgent }
        if dueDays <= 7 { return .near }
        return .ok
    }

    func amountDisplay(currency: String) -> String {
        "\(currency)\(amount.formattedAmount)"
    }

    var dueLabelShort: String {
        if dueDays == 0 { return "Today" }
        if dueDays < 0  { return "\(-dueDays)d late" }
        if dueDays == 1 { return "Tomorrow" }
        return "\(dueDays)d"
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
    /// Bills already marked paid this cycle — drives watch complication gauge.
    let paidCount: Int
    /// Total tracked bills (paid + unpaid) — gauge denominator.
    let totalCount: Int
}

private extension Double {
    var formattedAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: self)) ?? String(format: "%.0f", self)
    }
}
