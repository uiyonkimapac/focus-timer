import SwiftUI

// The "Runs" screen: your saved runs, read-only. No builder on the watch —
// create/edit runs on the phone or web app; here you just pick one and go.
struct RoutineListView: View {
    @EnvironmentObject var store: SyncStore

    var body: some View {
        NavigationStack {
            Group {
                if store.loading && store.routines.isEmpty {
                    ProgressView()
                } else if store.routines.isEmpty {
                    VStack(spacing: 6) {
                        Text(store.status.isEmpty ? "No saved runs." : store.status)
                            .font(.footnote)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                        Text("Create runs on your phone or the web app.")
                            .font(.caption2)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                        Button("Refresh") { Task { await store.refresh() } }
                            .font(.footnote)
                    }
                } else {
                    List(store.routines) { r in
                        NavigationLink {
                            RunReadyView(routine: r)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.name).font(.body).lineLimit(2)
                                Text("\(r.steps.count) steps · \(r.totalMins)m")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Runs")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await store.refresh() }
                    } label: { Image(systemName: "arrow.clockwise") }
                }
            }
        }
        .task { if store.routines.isEmpty { await store.refresh() } }
    }
}
