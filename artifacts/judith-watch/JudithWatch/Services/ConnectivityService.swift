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

    // applicationContext — phone pushes WatchPayload via updateApplicationContext
    // (replaces previous value in-place, fastest delivery)
    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        handlePayload(context)
    }

    // transferUserInfo — kept as a legacy fallback in case older builds still use it
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handlePayload(userInfo)
    }

    // MARK: — Watch → Phone: Ask Judith (text / dictation query)
    //
    // sendMessage requires the phone to be reachable. A 25-second hard timeout
    // (ResumeOnce) ensures the watch never gets stuck on "Judith is thinking…"
    // if the AI API call on the phone side takes too long.

    enum AskError: Error {
        case phoneNotReachable
        case invalidReply
        case serverError(String)
    }

    func sendAsk(query: String) async throws -> String {
        guard WCSession.default.isReachable else { throw AskError.phoneNotReachable }
        return try await withCheckedThrowingContinuation { cont in
            let box = ResumeOnce(cont)

            // Hard 25-second timeout — ensures continuation always resumes
            // even if WCSession drops the connection without calling errorHandler.
            DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
                box.resume(throwing: AskError.serverError(
                    "Judith took too long to respond. Try again in a moment."))
            }

            WCSession.default.sendMessage(
                ["action": "ask", "query": query],
                replyHandler: { reply in
                    if let answer = reply["answer"] as? String {
                        box.resume(returning: answer)
                    } else if let error = reply["error"] as? String {
                        box.resume(throwing: AskError.serverError(error))
                    } else {
                        box.resume(throwing: AskError.invalidReply)
                    }
                },
                errorHandler: { error in box.resume(throwing: error) }
            )
        }
    }

    // MARK: — Watch → Phone: Mark Paid
    //
    // When the phone is reachable (app foregrounded), sendMessage delivers
    // instantly. When not reachable, transferUserInfo queues the action for
    // reliable background delivery — the phone's 'user-info' listener picks
    // it up via useWatchMessages.

    func sendMarkPaid(billId: String) {
        // Optimistic update — phone will confirm with a fresh payload push.
        Task { @MainActor in store?.optimisticallyMarkPaid(billId: billId) }

        let payload: [String: Any] = ["action": "markPaid", "billId": billId]

        if WCSession.default.isReachable {
            WCSession.default.sendMessage(
                payload,
                replyHandler: nil,
                errorHandler: { _ in
                    // sendMessage failed mid-flight — fall back to queued delivery
                    WCSession.default.transferUserInfo(payload)
                }
            )
        } else {
            // Phone not in foreground — queue for reliable background delivery
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

// MARK: — ResumeOnce
//
// Thread-safe wrapper that ensures a CheckedContinuation is resumed exactly
// once. Prevents "continuation resumed multiple times" crashes when both the
// replyHandler and the timeout fire close together.

private final class ResumeOnce<T>: @unchecked Sendable {
    private let cont: CheckedContinuation<T, Error>
    private var done = false
    private let lock = NSLock()

    init(_ cont: CheckedContinuation<T, Error>) { self.cont = cont }

    func resume(returning val: T) {
        lock.lock(); defer { lock.unlock() }
        guard !done else { return }
        done = true
        cont.resume(returning: val)
    }

    func resume(throwing err: Error) {
        lock.lock(); defer { lock.unlock() }
        guard !done else { return }
        done = true
        cont.resume(throwing: err)
    }
}
