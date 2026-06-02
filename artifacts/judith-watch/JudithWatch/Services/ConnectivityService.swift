import WatchConnectivity
import Foundation

// MARK: — Receives the Supabase session from the paired phone app

final class ConnectivityService: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = ConnectivityService()

    @Published var receivedToken: String? = nil

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

    // Receive session token pushed by the phone app on sign-in
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handlePayload(userInfo)
    }

    // Also accept applicationContext updates (for quick delivery)
    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        handlePayload(context)
    }

    // Handle mark-paid replies sent from the phone to confirm sync
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handlePayload(message)
    }

    // MARK: — Private

    private func handlePayload(_ payload: [String: Any]) {
        if let token = payload["access_token"] as? String {
            DispatchQueue.main.async { [weak self] in
                self?.receivedToken = token
                self?.store?.applyToken(token)
            }
        }
        // The phone can push a fresh bill array too (e.g. after a phone-side change)
        if let data = payload["bills_json"] as? Data,
           let bills = try? JSONDecoder().decode([Bill].self, from: data) {
            DispatchQueue.main.async { [weak self] in
                self?.store?.applyBills(bills)
            }
        }
    }

    // MARK: — Send mark-paid back to phone (phone then syncs to Supabase as backup)
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
