import Foundation

// MARK: — Bill (mirrors artifacts/judith/lib/bills.ts)

struct Bill: Codable, Identifiable, Equatable {
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

    // MARK: — Display helpers

    var displayName: String { provider ?? name }

    var amountDisplay: String {
        guard let amt = amount else { return "—" }
        let formatted = amt.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", amt)
            : String(format: "%.2f", amt)
        return "₱\(formatted)"
    }

    var categoryIcon: String {
        switch category {
        case "electricity":  return "bolt.fill"
        case "water":        return "drop.fill"
        case "internet":     return "wifi"
        case "mobile":       return "iphone"
        case "landline":     return "phone.fill"
        case "credit_card":  return "creditcard.fill"
        default:             return "doc.text.fill"
        }
    }

    // MARK: — Due-date computation (matches computeNextDue in bills.ts)

    var nextDue: Date? {
        let cal = Calendar.current
        if cadence == "one_time" {
            return due_date.flatMap { Bill.parseDate($0) }
        }
        guard let day = due_day else { return nil }
        let today = cal.startOfDay(for: Date())

        func clampedDate(year: Int, month: Int) -> Date? {
            var c = DateComponents()
            c.year  = year
            c.month = month
            guard let ref = cal.date(from: c),
                  let range = cal.range(of: .day, in: .month, for: ref) else { return nil }
            c.day = min(day, range.count)
            return cal.date(from: c)
        }

        let thisYear  = cal.component(.year,  from: today)
        let thisMonth = cal.component(.month, from: today)

        if let candidate = clampedDate(year: thisYear, month: thisMonth),
           candidate >= today {
            return candidate
        }
        let nextMonth = thisMonth == 12 ? 1  : thisMonth + 1
        let nextYear  = thisMonth == 12 ? thisYear + 1 : thisYear
        return clampedDate(year: nextYear, month: nextMonth)
    }

    var daysUntil: Int? {
        guard let due = nextDue else { return nil }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        return cal.dateComponents([.day], from: today, to: cal.startOfDay(for: due)).day
    }

    var urgency: Urgency {
        if status == "paid"    { return .ok }
        if status == "snoozed" { return .ok }
        guard let d = daysUntil else { return .ok }
        if d < 0 { return .overdue }
        if d <= 3 { return .urgent }
        if d <= 7 { return .near }
        return .ok
    }

    var dueLabelShort: String {
        guard let d = daysUntil else { return "—" }
        if d == 0  { return "Today" }
        if d == -1 { return "1d late" }
        if d < 0   { return "\(-d)d late" }
        if d == 1  { return "in 1d" }
        return "in \(d)d"
    }

    var isUnpaid: Bool { status != "paid" }

    // MARK: — Helpers

    static func parseDate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
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

// MARK: — Offline action queue

struct PendingAction: Codable {
    enum Kind: String, Codable { case markPaid, snooze }
    let billId: String
    let kind: Kind
    let date: Date
}
