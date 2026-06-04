/**
 * JudithWatchSession.swift
 *
 * Add this file to your JudithWatch Xcode target.
 * It receives bill data from the Judith iOS app via WatchConnectivity
 * and exposes it as @Published properties for SwiftUI.
 *
 * How it works:
 *   1. The Judith iOS app calls transferUserInfo() whenever bills change.
 *   2. WatchConnectivity delivers the payload to this delegate — even if
 *      the Watch app is in the background.
 *   3. SwiftUI views observe @Published properties and re-render automatically.
 */

import Foundation
import WatchConnectivity

struct UrgentBill: Identifiable {
    let id: String
    let provider: String
    let amount: Double
    let dueDays: Int

    var dueDaysText: String {
        switch dueDays {
        case 0: return "TODAY"
        case 1: return "tomorrow"
        default: return "in \(dueDays)d"
        }
    }
}

class JudithWatchSession: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = JudithWatchSession()

    @Published var totalOwed: Double = 0
    @Published var unpaidCount: Int = 0
    @Published var nextProvider: String = ""
    @Published var nextAmount: Double = 0
    @Published var nextDueDays: Int = 0
    @Published var nextDueLabel: String = ""
    @Published var persona: String = "professional"
    @Published var urgentBills: [UrgentBill] = []
    @Published var hasData: Bool = false

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {}

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async {
            self.totalOwed    = userInfo["totalOwed"]    as? Double ?? 0
            self.unpaidCount  = userInfo["unpaidCount"]  as? Int    ?? 0
            self.nextProvider = userInfo["nextProvider"] as? String ?? ""
            self.nextAmount   = userInfo["nextAmount"]   as? Double ?? 0
            self.nextDueDays  = userInfo["nextDueDays"]  as? Int    ?? 0
            self.nextDueLabel = userInfo["nextDueLabel"] as? String ?? ""
            self.persona      = userInfo["persona"]      as? String ?? "professional"
            self.hasData      = true

            if let raw = userInfo["urgentBills"] as? [[String: Any]] {
                self.urgentBills = raw.compactMap { d in
                    guard let id       = d["id"]       as? String,
                          let provider = d["provider"] as? String,
                          let amount   = d["amount"]   as? Double,
                          let dueDays  = d["dueDays"]  as? Int
                    else { return nil }
                    return UrgentBill(id: id, provider: provider,
                                      amount: amount, dueDays: dueDays)
                }
            }
        }
    }

    // MARK: - Helpers

    func pesoStr(_ amount: Double) -> String {
        let n = Int(amount)
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        return "₱\(fmt.string(from: NSNumber(value: n)) ?? "\(n)")"
    }

    var nextDueDaysText: String {
        switch nextDueDays {
        case 0:  return "Due TODAY"
        case 1:  return "Due tomorrow"
        default: return "Due in \(nextDueDays) days"
        }
    }

    var urgencyColor: String {
        nextDueDays == 0 ? "red" : nextDueDays <= 3 ? "orange" : "purple"
    }
}
