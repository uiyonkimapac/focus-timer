import SwiftUI
import WatchConnectivity

@main
struct FocusTimerPhoneApp: App {
    init() { PhoneConnector.shared.activate() }

    var body: some Scene {
        WindowGroup { SetupView() }
    }
}

// The companion's single screen: set the sync code, beam it to the watch.
struct SetupView: View {
    @State private var code = SyncConfig.syncCode
    @State private var message = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Sync code") {
                    TextField("FT-XXXX-XX", text: $code)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                        .font(.system(.body, design: .monospaced))
                    Button("Send to Watch") { send() }
                    if !message.isEmpty {
                        Text(message).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                Section {
                    Text("This app only pairs your watch with your Focus Timer sync code — the same code shown under Sync in the web app. Everything else happens on the watch and at focus-timer web app.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Focus Timer Watch")
        }
    }

    private func send() {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !trimmed.isEmpty else { return }
        SyncConfig.syncCode = trimmed
        do {
            try WCSession.default.updateApplicationContext(["syncCode": trimmed])
            message = "Sent. The watch uses this code from its next refresh."
        } catch {
            message = "Couldn't reach the watch — is it paired and nearby?"
        }
    }
}

final class PhoneConnector: NSObject, WCSessionDelegate {
    static let shared = PhoneConnector()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
