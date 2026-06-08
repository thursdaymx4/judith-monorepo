// WatchSync.swift — phone ↔ watch bridge (WatchConnectivity).
// Minimal, compiles standalone. On the phone side, implement the matching
// session delegate to receive {action, billId} and apply markPaid/snooze, then
// push updated bills back to the watch (see WATCH_BUILD.md). Queues offline and
// flushes when reachable.
import Foundation
#if canImport(WatchConnectivity)
import WatchConnectivity
#endif

final class WatchSync: NSObject {
    static let shared = WatchSync()

    #if canImport(WatchConnectivity)
    private var session: WCSession? {
        guard WCSession.isSupported() else { return nil }
        let s = WCSession.default
        if s.activationState != .activated { s.delegate = self; s.activate() }
        return s
    }
    #endif

    func sendMarkPaid(id: String) { send(["action": "markPaid", "billId": id]) }
    func sendSnooze(id: String)   { send(["action": "snooze", "billId": id]) }

    private func send(_ message: [String: Any]) {
        #if canImport(WatchConnectivity)
        guard let s = session else { return }
        if s.isReachable {
            s.sendMessage(message, replyHandler: nil, errorHandler: { _ in
                try? s.updateApplicationContext(message) // fall back to queued context
            })
        } else {
            try? s.updateApplicationContext(message)      // delivered when reachable
        }
        #endif
    }
}

#if canImport(WatchConnectivity)
extension WatchSync: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
}
#endif
