import SwiftUI
import WatchKit
import UserNotifications

// Countdown for one task. Time comes from wall-clock (endDate), so backgrounding
// self-corrects; a local notification fires at zero even if the app is asleep;
// past zero the display flips to amber overtime and keeps counting, exactly like
// the web app's run mode: nothing completes until YOU say done.
struct TimerView: View {
    let task: FocusTask
    @EnvironmentObject var store: SyncStore
    @Environment(\.dismiss) private var dismiss

    @State private var startDate = Date()
    @State private var endDate = Date()
    @State private var remain = 0
    @State private var chimed = false
    @State private var saving = false

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 6) {
            Text(task.name)
                .font(.headline)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            Text(fmt(remain))
                .font(.system(size: 34, weight: .medium, design: .monospaced))
                .foregroundStyle(remain < 0 ? .orange : .primary)
            Text(remain < 0 ? "OVERTIME" : (task.categoryName ?? ""))
                .font(.caption2)
                .foregroundStyle(remain < 0 ? .orange : .secondary)
                .textCase(.uppercase)

            Button {
                finish()
            } label: {
                saving ? AnyView(ProgressView()) : AnyView(Text("✓ Done"))
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(saving)
        }
        .onAppear { start() }
        .onDisappear { cancelNotification() }
        .onReceive(tick) { _ in
            let r = Int(endDate.timeIntervalSinceNow.rounded())
            remain = r
            if r <= 0 && !chimed {
                chimed = true
                WKInterfaceDevice.current().play(.notification)
            }
        }
    }

    private func start() {
        startDate = Date()
        endDate = startDate.addingTimeInterval(TimeInterval(task.secsRemaining))
        remain = task.secsRemaining
        scheduleNotification(after: task.secsRemaining)
    }

    private func finish() {
        saving = true
        cancelNotification()
        let elapsed = Int(Date().timeIntervalSince(startDate).rounded())
        Task {
            let ok = await store.complete(task, elapsedSecs: elapsed)
            saving = false
            if ok { dismiss() }
        }
    }

    private func fmt(_ s: Int) -> String {
        let sign = s < 0 ? "-" : ""
        let a = abs(s)
        return String(format: "%@%02d:%02d", sign, a / 60, a % 60)
    }

    private var noteId: String { "ft_timer_\(task.id)" }

    private func scheduleNotification(after secs: Int) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
        let content = UNMutableNotificationContent()
        content.title = "Time's up"
        content.body = task.name
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(max(1, secs)), repeats: false)
        center.add(UNNotificationRequest(identifier: noteId, content: content, trigger: trigger))
    }

    private func cancelNotification() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [noteId])
    }
}
