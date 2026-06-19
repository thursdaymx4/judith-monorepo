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

    // MARK: — Offline action queue
    //
    // When the watch is in standalone mode (phone unreachable) and the user
    // asks Judith to mutate a bill, /watch-ask returns the parsed action(s).
    // We can't apply them to the canonical bill store from the watch — the
    // phone owns that — so we persist them here and replay them via
    // WCSession the moment the phone comes back into reach.
    private let pendingActionsKey = "judith.watch_pending_actions"

    private func loadPendingActions() -> [String] {
        defaults?.stringArray(forKey: pendingActionsKey) ?? []
    }

    private func savePendingActions(_ actions: [String]) {
        defaults?.set(actions, forKey: pendingActionsKey)
    }

    private func enqueuePendingActions(_ actionJSONs: [String]) {
        guard !actionJSONs.isEmpty else { return }
        var pending = loadPendingActions()
        pending.append(contentsOf: actionJSONs)
        savePendingActions(pending)
    }

    /// Drain the offline-queued actions back to the phone. Called on
    /// reachability restoration and on session activation. Each queued action
    /// is sent as a sendMessage with action="applyAction" and the raw JSON
    /// string — useWatchMessages.ts parses and routes to the correct store
    /// mutation. Items are only removed from the queue after the phone acks;
    /// a send failure falls back to transferUserInfo so the action survives
    /// across watch reboots.
    func drainPendingActions() {
        let pending = loadPendingActions()
        guard !pending.isEmpty else { return }
        guard WCSession.default.isReachable else { return }

        // Optimistically clear so we don't double-send if drain is re-entered.
        // Failed items get re-enqueued via the errorHandler below.
        savePendingActions([])

        for json in pending {
            let payload: [String: Any] = ["action": "applyAction", "payload": json]
            WCSession.default.sendMessage(
                payload,
                replyHandler: { _ in },
                errorHandler: { [weak self] _ in
                    // Persist again so we retry on the next reachability event.
                    // transferUserInfo is the durable channel — survives phone
                    // lock/background.
                    WCSession.default.transferUserInfo(payload)
                    self?.enqueuePendingActions([json])
                }
            )
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
        if session.isReachable { drainPendingActions() }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.isPhoneReachable = session.isReachable }
        if session.isReachable { drainPendingActions() }
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

    /// One turn of the watch Ask conversation. `role` is "user" or
    /// "assistant"; mirrors the shape the phone /ask endpoint expects.
    struct AskTurn: Codable, Hashable {
        let role: String
        let text: String
    }

    func sendAsk(query: String, history: [AskTurn] = []) async throws -> String {
        if WCSession.default.isReachable {
            do {
                return try await sendAskToPhone(query: query, history: history)
            } catch {
                if hasWatchToken {
                    return try await sendAskToBackend(query: query, history: history)
                }
                throw error
            }
        }

        guard hasWatchToken else { throw AskError.phoneNotReachable }
        return try await sendAskToBackend(query: query, history: history)
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

    private func sendAskToPhone(query: String, history: [AskTurn]) async throws -> String {
        guard WCSession.default.isReachable else { throw AskError.phoneNotReachable }
        var payload: [String: Any] = ["action": "ask", "query": query]
        if !history.isEmpty {
            // WCSession.sendMessage only accepts plist-safe types — convert
            // each turn to a [String: String] so the phone handler can read
            // it as a plain array of dictionaries.
            payload["history"] = history.map { ["role": $0.role, "text": $0.text] }
        }
        return try await withCheckedThrowingContinuation { cont in
            WCSession.default.sendMessage(
                payload,
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

    /// Upload a recorded .m4a clip from VoiceRecorderView to /watch-stt and
    /// return the transcription. Requires the device to have a watch token
    /// already provisioned (hasWatchToken == true) — call sites should fall
    /// back to the chooser-based flow if the token isn't present.
    func transcribeAudio(at url: URL) async throws -> String {
        guard hasWatchToken else { throw AskError.phoneNotReachable }
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw AskError.invalidReply
        }
        let body = WatchSttRequest(
            audioBase64: data.base64EncodedString(),
            mimeType: "audio/m4a"
        )
        let response: WatchSttResponse = try await sendBackendRequest(
            path: "watch-stt",
            method: "POST",
            body: body
        )
        return response.text
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

    private func sendAskToBackend(query: String, history: [AskTurn]) async throws -> String {
        let request = WatchAskRequest(
            text: query,
            localDate: Self.localDateString(),
            localWeekday: Self.localWeekdayString(),
            history: history.isEmpty ? nil : history
        )
        // We can't reuse the typed sendBackendRequest helper because /watch-ask
        // now returns `actions` as a heterogeneous JSON array (varying shapes
        // per action type — strings, numbers, bools, sub-arrays for splits).
        // Round-tripping that through Codable would require a JSONValue enum;
        // since we only need to relay each action JSON verbatim to the phone,
        // it's simpler to extract them via JSONSerialization.
        guard let token = watchToken else { throw AskError.phoneNotReachable }
        let url = Config.apiBaseURL.appendingPathComponent("watch-ask")
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.timeoutInterval = 30
        urlRequest.httpBody = try encoder.encode(request)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: urlRequest)
        } catch let err as URLError where err.code == .timedOut {
            throw AskError.serverError("Took too long — keep your wrist raised and try again.")
        }
        guard let http = response as? HTTPURLResponse else { throw AskError.invalidReply }
        guard (200..<300).contains(http.statusCode) else {
            if let err = try? decoder.decode(BackendErrorResponse.self, from: data),
               !err.error.isEmpty {
                throw AskError.serverError(err.error)
            }
            throw AskError.serverError("Judith couldn't load the latest watch data.")
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let answer = json["answer"] as? String else {
            throw AskError.invalidReply
        }

        // Queue + optimistically apply any actions Claude emitted. We only
        // hit this code path when the phone is unreachable, so every action
        // returned here is destined for the queue. mark_paid actions get a
        // best-effort local apply so the watch UI reflects the change
        // immediately — the phone will reconfirm via WatchPayload once the
        // queue drains.
        if let actions = json["actions"] as? [[String: Any]], !actions.isEmpty {
            var queued: [String] = []
            for action in actions {
                if let actionData = try? JSONSerialization.data(withJSONObject: action),
                   let actionString = String(data: actionData, encoding: .utf8) {
                    queued.append(actionString)
                }
                if let type = action["type"] as? String,
                   type == "mark_paid",
                   let id = action["id"] as? String {
                    Task { @MainActor in self.store?.optimisticallyMarkPaid(billId: id) }
                }
            }
            if !queued.isEmpty {
                enqueuePendingActions(queued)
            }
        }

        return answer
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
        // Hard cap. Without this, lowering the wrist suspends the watch app
        // AND its in-flight URLSession request — the spinner stays "thinking"
        // forever with no way to recover except force-quit. 30s is generous
        // (typical ask completes in 3-8s) and gives the user a recoverable
        // error path. URLSession honors this timer even across the lift-down
        // -lift-up lifecycle once the app resumes.
        request.timeoutInterval = 30
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let err as URLError where err.code == .timedOut {
            throw AskError.serverError("Took too long — keep your wrist raised and try again.")
        }
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
    let history: [ConnectivityService.AskTurn]?
}

private struct WatchSttRequest: Encodable {
    let audioBase64: String
    let mimeType: String
}

private struct WatchSttResponse: Decodable {
    let text: String
}

private struct BackendErrorResponse: Decodable {
    let error: String
}
