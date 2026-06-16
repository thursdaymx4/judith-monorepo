import WatchConnectivity
import Foundation
import Combine

// MARK: — Receives WatchPayload pushed by the phone; sends ask/markPaid back.

final class ConnectivityService: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = ConnectivityService()

    @Published var isPhoneReachable: Bool = false

    private var store: WatchStore?
    private let defaults = UserDefaults(suiteName: Config.appGroupID)
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

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
        requestPayloadRefresh()
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
        if WCSession.default.isReachable {
            do {
                return try await sendAskToPhone(query: query)
            } catch {
                if hasWatchToken {
                    return try await sendAskToBackend(query: query)
                }
                throw error
            }
        }

        guard hasWatchToken else { throw AskError.phoneNotReachable }
        return try await sendAskToBackend(query: query)
    }

    // MARK: — Watch → Phone: request latest summary

    func requestPayloadRefresh() {
        Task { try? await fetchSummaryFromBackend() }

        let payload: [String: Any] = ["action": "refreshWatchPayload"]

        if WCSession.default.isReachable {
            WCSession.default.sendMessage(
                payload,
                replyHandler: { _ in },
                errorHandler: { _ in
                    WCSession.default.transferUserInfo(payload)
                }
            )
        } else {
            WCSession.default.transferUserInfo(payload)
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

    private var watchToken: String? {
        defaults?.string(forKey: Config.watchTokenKey)
    }

    private var hasWatchToken: Bool {
        watchToken?.isEmpty == false
    }

    private func sendAskToPhone(query: String) async throws -> String {
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

    private func fetchSummaryFromBackend() async throws {
        let response: WatchSummaryResponse = try await sendBackendRequest(
            path: "watch-summary",
            method: "GET",
            body: Optional<EmptyBody>.none
        )
        await MainActor.run { [weak self] in
            self?.store?.applyPayload(response.payload)
        }
    }

    private func sendAskToBackend(query: String) async throws -> String {
        let request = WatchAskRequest(
            text: query,
            localDate: Self.localDateString(),
            localWeekday: Self.localWeekdayString()
        )
        let response: WatchAskResponse = try await sendBackendRequest(
            path: "watch-ask",
            method: "POST",
            body: request
        )
        return response.answer
    }

    private func sendBackendRequest<ResponseBody: Decodable, RequestBody: Encodable>(
        path: String,
        method: String,
        body: RequestBody?
    ) async throws -> ResponseBody {
        guard let token = watchToken else { throw AskError.phoneNotReachable }
        let url = Config.apiBaseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AskError.invalidReply }
        guard (200..<300).contains(http.statusCode) else {
            if let error = try? decoder.decode(BackendErrorResponse.self, from: data),
               !error.error.isEmpty {
                throw AskError.serverError(error.error)
            }
            throw AskError.serverError("Judith couldn't load the latest watch data.")
        }
        return try decoder.decode(ResponseBody.self, from: data)
    }

    private static func localDateString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private static func localWeekdayString() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEEE"
        return formatter.string(from: Date())
    }

    private func handlePayload(_ dict: [String: Any]) {
        if let token = dict["judith_watch_token"] as? String,
           !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            defaults?.set(token, forKey: Config.watchTokenKey)
        }

        if let json = dict["judith_payload_v2"] as? String,
           let data = json.data(using: .utf8),
           let p    = try? decoder.decode(WatchPayload.self, from: data) {
            DispatchQueue.main.async { [weak self] in
                self?.store?.applyPayload(p)
            }
        }
    }
}

private struct EmptyBody: Encodable {}

private struct WatchSummaryResponse: Decodable {
    let payload: WatchPayload
    let updatedAt: String?
}

private struct WatchAskRequest: Encodable {
    let text: String
    let localDate: String
    let localWeekday: String
}

private struct WatchAskResponse: Decodable {
    let answer: String
}

private struct BackendErrorResponse: Decodable {
    let error: String
}
