import SwiftUI
import WatchKit
import UserNotifications

// Executes a saved run on the wrist, mirroring the web app's Run mode:
// focus countdown → wrist tap at 0:00 → amber OVERTIME that HOLDS (nothing
// advances until you tap ✓), re-chime at 5 min over; then the step's break
// (5/15 min, floors at 0) → a "Begin →" wait screen (deliberately NOT
// auto-advance, so idle minutes aren't billed to the next task). autoFlow
// runs auto-complete + auto-advance with no overtime. `none` gaps skip
// straight to the next task. Completions are logged history-only.
@MainActor
final class RunEngine: ObservableObject {
    enum Phase { case focus, breakTime, ready, done }

    let routine: Routine

    @Published var idx = 0
    @Published var phase: Phase = .focus
    @Published var remain = 0
    @Published var saving = false
    @Published var completedCount = 0

    private weak var store: SyncStore?
    private var started = false
    private var endDate = Date()
    private var stepStart = Date()
    private var chimed = false
    private var renudged = false

    init(routine: Routine) { self.routine = routine }

    func bind(_ s: SyncStore) { store = s }

    var step: RunStep { routine.steps[min(idx, routine.steps.count - 1)] }
    var nextName: String { idx + 1 < routine.steps.count ? routine.steps[idx + 1].name : "" }

    // ── Lifecycle ──

    func start() {
        guard !started else { return }   // don't reset if the view reappears
        started = true
        idx = 0
        beginFocus()
    }

    func stop() { cancelNote() }

    // ── Tick (wall-clock, so backgrounding self-corrects) ──

    func onTick() {
        switch phase {
        case .focus:
            remain = clampedFocus()
            if remain <= 0 && !chimed { chimed = true; haptic(.notification) }
            if routine.autoFlow && remain <= 0 { finishFocus(); return }
            if !routine.autoFlow && remain <= -300 && !renudged {
                renudged = true; haptic(.notification)   // 5-min overtime re-chime
            }
        case .breakTime:
            let r = max(0, Int(endDate.timeIntervalSinceNow.rounded()))
            remain = r
            if r <= 0 && !chimed { chimed = true; haptic(.notification); phase = .ready }
        case .ready, .done:
            break
        }
    }

    // ── User actions ──

    func done() { finishFocus() }               // ✓ during a focus step
    func advanceUser() { cancelNote(); advance() } // skip a step/break, or "Begin →"

    // ── Transitions ──

    private func beginFocus() {
        phase = .focus
        chimed = false; renudged = false
        stepStart = Date()
        let secs = routine.steps[idx].mins * 60
        endDate = Date().addingTimeInterval(TimeInterval(secs))
        remain = secs
        scheduleNote(after: secs, title: "Time's up")
    }

    private func finishFocus() {
        guard phase == .focus, !saving else { return }
        saving = true
        cancelNote()
        // Bill real time spent, incl. overtime, but cap at 2× the step so a
        // watch that slept mid-step can't inflate reports.
        let spent = min(step.mins * 60 * 2, max(0, step.mins * 60 - clampedFocus()))
        let nm = step.name, mn = step.mins
        Task {
            _ = await store?.logRunStep(name: nm, mins: mn, secsSpent: spent)
            completedCount += 1
            saving = false
            startBreak()
        }
    }

    private func startBreak() {
        let gap = routine.steps[idx].gapAfter
        // No break after the last step, and `none` gaps go straight through.
        if gap == .none || idx >= routine.steps.count - 1 { advance(); return }
        phase = .breakTime
        chimed = false
        stepStart = Date()
        endDate = Date().addingTimeInterval(TimeInterval(gap.mins * 60))
        remain = gap.mins * 60
        scheduleNote(after: gap.mins * 60, title: "Break over")
    }

    private func advance() {
        idx += 1
        if idx >= routine.steps.count {
            phase = .done
            haptic(.success)
            cancelNote()
        } else {
            beginFocus()
        }
    }

    private func clampedFocus() -> Int {
        var r = Int(endDate.timeIntervalSinceNow.rounded())
        let floor = -step.mins * 60
        if r < floor { r = floor }
        return r
    }

    // ── Haptics + wrist-tap-while-asleep notification ──

    private let noteId = "ft_run_step"

    private func haptic(_ t: WKHapticType) { WKInterfaceDevice.current().play(t) }

    private func scheduleNote(after secs: Int, title: String) {
        let c = UNUserNotificationCenter.current()
        c.requestAuthorization(options: [.alert, .sound]) { _, _ in }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = step.name
        content.sound = .default
        let trig = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(max(1, secs)), repeats: false)
        c.add(UNNotificationRequest(identifier: noteId, content: content, trigger: trig))
    }

    private func cancelNote() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [noteId])
    }
}

// The pre-run screen: shows the whole sequence, then a Start button.
struct RunReadyView: View {
    let routine: Routine

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(routine.steps.enumerated()), id: \.element.id) { i, s in
                    HStack {
                        Text(s.name).font(.caption).lineLimit(1)
                        Spacer()
                        Text("\(s.mins)m").font(.caption2).foregroundStyle(.secondary)
                    }
                    if s.gapAfter != .none && i < routine.steps.count - 1 {
                        Text("• \(s.gapAfter.label) \(s.gapAfter.mins)m")
                            .font(.caption2).foregroundStyle(.blue)
                    }
                }
                NavigationLink {
                    RunPlayerView(routine: routine)
                } label: {
                    Text("Start").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .padding(.top, 4)
            }
            .padding(.horizontal, 2)
        }
        .navigationTitle(routine.name)
    }
}

struct RunPlayerView: View {
    @EnvironmentObject var store: SyncStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var engine: RunEngine

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(routine: Routine) {
        _engine = StateObject(wrappedValue: RunEngine(routine: routine))
    }

    var body: some View {
        VStack(spacing: 6) {
            switch engine.phase {
            case .focus: focusView
            case .breakTime: breakView
            case .ready: readyView
            case .done: doneView
            }
        }
        .onReceive(tick) { _ in engine.onTick() }
        .onAppear { engine.bind(store); engine.start() }
        .onDisappear { engine.stop() }
    }

    private var focusView: some View {
        VStack(spacing: 5) {
            Text(engine.step.name)
                .font(.headline).lineLimit(2).multilineTextAlignment(.center)
            Text(fmt(engine.remain))
                .font(.system(size: 34, weight: .medium, design: .monospaced))
                .foregroundStyle(engine.remain < 0 ? .orange : .primary)
            Text(engine.remain < 0 ? "OVERTIME" : "\(engine.idx + 1) of \(engine.routine.steps.count)")
                .font(.caption2)
                .foregroundStyle(engine.remain < 0 ? .orange : .secondary)
                .textCase(.uppercase)
            Button {
                engine.done()
            } label: {
                (engine.saving ? AnyView(ProgressView()) : AnyView(Text("✓ Done")))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).tint(.green).disabled(engine.saving)
            Button("Skip") { engine.advanceUser() }
                .font(.caption2).disabled(engine.saving)
        }
    }

    private var breakView: some View {
        VStack(spacing: 6) {
            Text("Break").font(.headline).foregroundStyle(.blue)
            Text(fmt(engine.remain))
                .font(.system(size: 34, weight: .medium, design: .monospaced))
                .foregroundStyle(.blue)
            Button("Skip break") { engine.advanceUser() }.font(.caption)
        }
    }

    private var readyView: some View {
        VStack(spacing: 8) {
            Text("Break over").font(.headline)
            if !engine.nextName.isEmpty {
                Text("Next: \(engine.nextName)")
                    .font(.caption2).foregroundStyle(.secondary)
                    .lineLimit(2).multilineTextAlignment(.center)
            }
            Button {
                engine.advanceUser()
            } label: {
                Text("Begin →").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).tint(.green)
        }
    }

    private var doneView: some View {
        VStack(spacing: 8) {
            Text("Run complete").font(.headline)
            Text("\(engine.completedCount) logged")
                .font(.caption).foregroundStyle(.secondary)
            Button("Done") { dismiss() }.buttonStyle(.borderedProminent)
        }
    }

    private func fmt(_ s: Int) -> String {
        let sign = s < 0 ? "-" : ""
        let a = abs(s)
        return String(format: "%@%02d:%02d", sign, a / 60, a % 60)
    }
}
