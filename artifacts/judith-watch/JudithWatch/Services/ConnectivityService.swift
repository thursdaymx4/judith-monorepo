import WatchConnectivity
import Foundation
import Combine

// MARK: — Receives WatchPayload pushed by the phone; sends ask/markPaid back.

final class ConnectivityService: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = ConnectivityService()

    @Published var isPhoneReachable: Bool = false

    private var store: WatchStore?

    override private init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func register(store: WatchStore) {
        self.store = store
    }

    // MARK: — WCSessionDelegate

    func session(_ session: WCSession,
                 activationDidCompleteWith state: WCSessionActivationState,
                 error: Error?) {
        DispatchQueue.main.async { self.isPhoneReachable = session.isReachable }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.isPhoneReachable = session.isReachable }
    }

    // transferUserInfo — the phone pushes WatchPayload via this channel
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handlePayload(userInfo)
    }

    // applicationContext — faster delivery for quick updates
    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        handlePayload(context)
    }

    // MARK: — Watch → Phone: Ask Judith (voice query)

    enum AskError: Error {
        case phoneNotReachable
        case invalidReply
        case serverError(String)
    }

    func sendAsk(query: String) async throws -> String {
        guard WCSession.default.isReachable else { throw AskError.phoneNotReachable }
        return try await withCheckedThrowingContinuation { cont in
            WCSession.default.sendMessage(
                ["action": "ask", "query": query],
                replyHandler: { reply in
                    if let answer = reply["answer"] as? String {
                        cont.resume(returning: answer)
                    } else if let error = reply["error"] as? String {
                        cont.resume(throwing: AskError.serverError(error))
                    } else {
                        cont.resume(throwing: AskError.invalidReply)
                    }
                },
                errorHandler: { error in cont.resume(throwing: error) }
            )
        }
    }

    // MARK: — Watch → Phone: Mark Paid

    func sendMarkPaid(billId: String) {
        // Optimistic update first — phone will confirm with a fresh payload push
        Task { @MainActor in store?.optimisticallyMarkPaid(billId: billId) }

        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(
            ["action": "markPaid", "billId": billId],
            replyHandler: nil,
            errorHandler: nil
        )
    }

    // MARK: — Private

    private func handlePayload(_ dict: [String: Any]) {
        if let json = dict["judith_payload_v2"] as? String,
           let data = json.data(using: .utf8),
           let p    = try? JSONDecoder().decode(WatchPayload.self, from: data) {
            DispatchQueue.main.async { [weak self] in
                self?.store?.applyPayload(p)
            }
        }
    }
}
