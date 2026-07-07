import SwiftUI

@main
struct FocusTimerWatchApp: App {
    @StateObject private var store = SyncStore()
    @Environment(\.scenePhase) private var scenePhase

    init() { WatchConnector.shared.activate() }

    var body: some Scene {
        WindowGroup {
            TabView {
                TaskListView()      // Today's tasks
                RoutineListView()   // Saved runs
            }
            .environmentObject(store)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await store.refresh() } }
        }
    }
}
