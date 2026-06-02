import SwiftUI
import Foundation

// MARK: — Types duplicated for the widget extension target
// (Widget extensions are sandboxed — they can't import from the watch app target.
//  Keep this file in sync with JudithWatch/Config/Config.swift and Models/Bill.swift.)

// MARK: — Config

enum Config {
    static let supabaseURL     = "https://YOUR_PROJECT.supabase.co"
    static let supabaseAnonKey = "YOUR_ANON_KEY"
    static let appGroupID      = "group.com.app.judith"
    static let billsCacheKey   = "judith.bills_cache"
    static let sessionTokenKey = "judith.session_token"
    static let pendingActionsKey = "judith.pending_actions"
    static let streakKey       = "judith.streak"
}

// MARK: — Design tokens

extension Color {
    static let judithAccent  = Color(hex: "#29d5a5")
    static let judithOverdue = Color(hex: "#ea1d3b")
    static let judithUrgent  = Color(hex: "#ff645f")
    static let judithNear    = Color(hex: "#f7b83d")
    static let judithOK      = Color(hex: "#56d1a3")
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
            green: Double((int >> 8)  & 0xFF) / 255,
            blue:  Double(int         & 0xFF) / 255
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

// MARK: — Bill (minimal Codable — must match JudithWatch/Models/Bill.swift)

struct Bill: Codable, Identifiable {
    let id: String
    let user_id: String
    let name: String
    let category: String
    let provider: String?
    let amount_type: String
    let amount: Double?
    let due_day: Int?
    let due_date: String?
    let cadence: String
    var status: String
    var snoozed_until: String?
    let created_at: String

    var displayName: String { provider ?? name }
    var isUnpaid: Bool { status != "paid" }

    var nextDue: Date? {
        let cal = Calendar.current
        if cadence == "one_time" {
            return due_date.flatMap { parseDate($0) }
        }
        guard let day = due_day else { return nil }
        let today = cal.startOfDay(for: Date())

        func clampedDate(year: Int, month: Int) -> Date? {
            var c = DateComponents(); c.year = year; c.month = month
            guard let ref = cal.date(from: c),
                  let range = cal.range(of: .day, in: .month, for: ref) else { return nil }
            c.day = min(day, range.count)
            return cal.date(from: c)
        }

        let y = cal.component(.year, from: today)
        let m = cal.component(.month, from: today)
        if let candidate = clampedDate(year: y, month: m), candidate >= today { return candidate }
        return clampedDate(year: m == 12 ? y + 1 : y, month: m == 12 ? 1 : m + 1)
    }

    var daysUntil: Int? {
        guard let due = nextDue else { return nil }
        let cal = Calendar.current
        return cal.dateComponents([.day],
                                  from: cal.startOfDay(for: Date()),
                                  to: cal.startOfDay(for: due)).day
    }

    var urgency: Urgency {
        if status == "paid" || status == "snoozed" { return .ok }
        guard let d = daysUntil else { return .ok }
        if d < 0 { return .overdue }
        if d <= 3 { return .urgent }
        if d <= 7 { return .near }
        return .ok
    }

    private func parseDate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
    }
}

// MARK: — Pending action (offline queue, shared via App Group)

struct PendingAction: Codable {
    enum Kind: String, Codable { case markPaid, snooze }
    let billId: String
    let kind: Kind
    let date: Date
}
