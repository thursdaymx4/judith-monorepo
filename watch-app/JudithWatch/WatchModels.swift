// WatchModels.swift — shared domain model for the Judith watchOS app.
// Judith is a TRACKER, not a payer: "Mark paid" records a payment, never moves money.
//
// In production these values are synced from the phone via an App Group +
// WatchConnectivity (see WATCH_BUILD.md). Here we ship a sample store so the UI
// compiles and previews; swap `BillStore.shared` to read the shared container.

import Foundation
import SwiftUI

enum Urgency {
    case overdue, urgent, near, ok, paid

    /// Maps days-until-due to urgency (matches the phone app exactly).
    static func from(daysUntilDue d: Int, paid: Bool) -> Urgency {
        if paid { return .paid }
        if d < 0 { return .overdue }
        if d <= 3 { return .urgent }
        if d <= 7 { return .near }
        return .ok
    }

    var color: Color {
        switch self {
        case .overdue: return WatchTheme.overdue
        case .urgent:  return WatchTheme.urgent
        case .near:    return WatchTheme.near
        case .ok:      return WatchTheme.ok
        case .paid:    return WatchTheme.accent
        }
    }
}

struct Bill: Identifiable, Hashable {
    let id: String
    let provider: String
    let category: String
    let amount: Int          // whole units, no decimals
    let dueDays: Int         // days until due (negative = overdue)
    let dueLabel: String     // "Jun 2"
    var paid: Bool

    var urgency: Urgency { Urgency.from(daysUntilDue: dueDays, paid: paid) }

    /// "Due in 3 days" / "Due today" / "2 days late".
    var duePhrase: String {
        if paid { return "Paid" }
        if dueDays < 0 { let n = -dueDays; return "\(n) day\(n == 1 ? "" : "s") late" }
        if dueDays == 0 { return "Due today" }
        if dueDays == 1 { return "Due tomorrow" }
        return "Due in \(dueDays) days"
    }

    /// Compact "in 3d" / "2d late" for list rows.
    var dueShort: String {
        if paid { return "paid" }
        if dueDays < 0 { return "\(-dueDays)d late" }
        if dueDays == 0 { return "today" }
        return "in \(dueDays)d"
    }
}

/// Whole-unit currency formatting, e.g. ₱18,000. Symbol comes from the phone's country.
enum Money {
    static var symbol: String = "₱"   // synced from phone; default PH
    static func format(_ amount: Int) -> String {
        let n = NSNumber(value: amount)
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return symbol + (f.string(from: n) ?? "\(amount)")
    }
}

/// Observable store the watch UI reads. Replace the sample seed with the
/// App-Group/WatchConnectivity payload from the phone (see WATCH_BUILD.md).
final class BillStore: ObservableObject {
    static let shared = BillStore()

    @Published var bills: [Bill]
    @Published var streakMonths: Int = 7

    init() {
        bills = [
            Bill(id: "skycable", provider: "Sky Cable", category: "TV / Streaming", amount: 699, dueDays: -2, dueLabel: "May 30", paid: false),
            Bill(id: "meralco", provider: "Meralco", category: "Electricity", amount: 3450, dueDays: 2, dueLabel: "Jun 2", paid: false),
            Bill(id: "maynilad", provider: "Maynilad", category: "Water", amount: 890, dueDays: 6, dueLabel: "Jun 6", paid: false),
            Bill(id: "pldt", provider: "PLDT Home", category: "Internet", amount: 1699, dueDays: 6, dueLabel: "Jun 6", paid: false),
            Bill(id: "bpi", provider: "BPI", category: "Credit card", amount: 5200, dueDays: 18, dueLabel: "Jun 18", paid: false),
        ]
    }

    /// Unpaid bills, soonest first.
    var upcoming: [Bill] { bills.filter { !$0.paid }.sorted { $0.dueDays < $1.dueDays } }
    /// The single most-urgent unpaid bill (drives the complication + glance).
    var nextDue: Bill? { upcoming.first }
    var dueCount: Int { upcoming.count }
    var totalDue: Int { upcoming.reduce(0) { $0 + $1.amount } }

    /// Mark a bill paid — records payment + advances to the next reminder.
    /// In production this also writes back to the phone/Supabase via WatchConnectivity.
    func markPaid(_ id: String) {
        guard let i = bills.firstIndex(where: { $0.id == id }) else { return }
        bills[i].paid = true
        WatchSync.shared.sendMarkPaid(id: id)
    }

    /// Snooze a reminder by one day.
    func snooze(_ id: String) {
        guard let i = bills.firstIndex(where: { $0.id == id }) else { return }
        let b = bills[i]
        bills[i] = Bill(id: b.id, provider: b.provider, category: b.category, amount: b.amount,
                        dueDays: b.dueDays + 1, dueLabel: b.dueLabel, paid: b.paid)
        WatchSync.shared.sendSnooze(id: id)
    }
}
