import Foundation
import WatchConnectivity

// Receives the sync code from the iPhone companion (applicationContext survives
// even if the watch app wasn't running when the phone sent it).
final class WatchConnector: NSObject, WCSessionDelegate {
    static let shared = WatchConnector()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        apply(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext ctx: [String: Any]) {
        apply(ctx)
    }

    private func apply(_ ctx: [String: Any]) {
        if let code = ctx["syncCode"] as? String, !code.isEmpty {
            SyncConfig.syncCode = code
        }
    }
}
