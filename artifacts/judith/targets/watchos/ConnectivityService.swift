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
        // Hydrate immediately from the last context the phone sent — covers the
        // case where the Watch was asleep or backgrounded when the payload arrived.
        // This is more up-to-date than the UserDefaults cache when the phone has
        // pushed updates since the last Watch app launch.
        let ctx = WCSession.default.receivedApplicationContext
        if !ctx.isEmpty {
            handlePayload(ctx)
        }
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

        let payload: [String: Any] = ["action": "markPaid", "billId": billId]

        if WCSession.default.isReachable {
            // sendMessage requires a non-nil replyHandler so the phone receives it
            // via session(_:didReceiveMessage:replyHandler:) — the channel that
            // react-native-watch-connectivity's addMessageListener is hooked to.
            // With replyHandler: nil the phone gets session(_:didReceiveMessage:)
            // which is NOT forwarded to JS, so markPaid would silently be dropped.
            WCSession.default.sendMessage(
                payload,
                replyHandler: { _ in }, // reply ignored — we just need the channel
                errorHandler: { _ in
                    // sendMessage failed (e.g. phone locked mid-call) — fall back
                    // to the background queue; phone handles it via "user-info" event.
                    WCSession.default.transferUserInfo(payload)
                }
            )
        } else {
            // Phone not reachable right now — deliver in the background.
            // useWatchMessages.ts channel 2 handles this via the "user-info" event.
            WCSession.default.transferUserInfo(payload)
        }
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
