import Foundation
import Combine
import WatchConnectivity

// MARK: — Receives the Supabase session + live bill summary from the paired phone app

final class ConnectivityService: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = ConnectivityService()

    // Auth
    @Published var receivedToken: String? = nil

    // Live bill summary pushed by the phone (updates without waiting for Supabase)
    @Published var phoneTotalOwed: Double = 0
    @Published var phoneUnpaidCount: Int = 0
    @Published var phoneNextProvider: String = ""
    @Published var phoneNextAmount: Double = 0
    @Published var phoneNextDueDays: Int = 0
    @Published var phoneNextDueLabel: String = ""
    @Published var phonePersona: String = "professional"
    @Published var phoneUrgentBills: [PhoneUrgentBill] = []
    @Published var hasPhoneData: Bool = false

    private var store: BillStore?

    override private init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func register(store: BillStore) {
        self.store = store
    }

    // MARK: — WCSessionDelegate

    func session(_ session: WCSession,
                 activationDidCompleteWith state: WCSessionActivationState,
                 error: Error?) {}

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handlePayload(userInfo)
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        handlePayload(context)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handlePayload(message)
    }

    // MARK: — Private

    private func handlePayload(_ payload: [String: Any]) {
        // Auth token from phone sign-in
        if let token = payload["access_token"] as? String {
            DispatchQueue.main.async { [weak self] in
                self?.receivedToken = token
                self?.store?.applyToken(token)
            }
        }

        // Full bill list (JSON-encoded) pushed by phone after changes
        if let data = payload["bills_json"] as? Data,
           let bills = try? JSONDecoder().decode([Bill].self, from: data) {
            DispatchQueue.main.async { [weak self] in
                self?.store?.applyBills(bills)
            }
        }

        // Live bill summary pushed by the Judith phone app (fast real-time update)
        // Keys match WatchPayload in lib/watch.ts on the phone side
        if let unpaidCount = payload["unpaidCount"] as? Int {
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.phoneTotalOwed      = payload["totalOwed"]      as? Double ?? 0
                self.phoneUnpaidCount    = unpaidCount
                self.phoneNextProvider   = payload["nextProvider"]   as? String ?? ""
                self.phoneNextAmount     = payload["nextAmount"]      as? Double ?? 0
                self.phoneNextDueDays    = payload["nextDueDays"]     as? Int    ?? 0
                self.phoneNextDueLabel   = payload["nextDueLabel"]    as? String ?? ""
                self.phonePersona        = payload["persona"]         as? String ?? "professional"

                if let raw = payload["urgentBills"] as? [[String: Any]] {
                    self.phoneUrgentBills = raw.compactMap { d in
                        guard let id       = d["id"]       as? String,
                              let provider = d["provider"] as? String,
                              let amount   = d["amount"]   as? Double,
                              let dueDays  = d["dueDays"]  as? Int
                        else { return nil }
                        return PhoneUrgentBill(id: id, provider: provider,
                                               amount: amount, dueDays: dueDays)
                    }
                }
                self.hasPhoneData = true
            }
        }
    }

    // MARK: — Send actions back to phone

    func sendMarkPaid(billId: String) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(
            ["action": "markPaid", "billId": billId],
            replyHandler: nil,
            errorHandler: nil
        )
    }

    func sendSnooze(billId: String) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(
            ["action": "snooze", "billId": billId],
            replyHandler: nil,
            errorHandler: nil
        )
    }
}

// MARK: — Lightweight bill model for phone-pushed urgent bills

struct PhoneUrgentBill: Identifiable {
    let id: String
    let provider: String
    let amount: Double
    let dueDays: Int

    var dueDaysText: String {
        switch dueDays {
        case 0:  return "TODAY"
        case 1:  return "tomorrow"
        default: return "in \(dueDays)d"
        }
    }

    var pesoAmount: String {
        let fmt = NumberFormatter()
        fmt.numberStyle = .decimal
        return "₱\(fmt.string(from: NSNumber(value: Int(amount))) ?? "\(Int(amount))")"
    }
}
