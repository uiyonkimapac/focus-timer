import SwiftUI

struct TaskListView: View {
    @EnvironmentObject var store: SyncStore

    var body: some View {
        NavigationStack {
            Group {
                if store.loading && store.tasks.isEmpty {
                    ProgressView()
                } else if store.tasks.isEmpty {
                    VStack(spacing: 6) {
                        Text(store.status.isEmpty ? "No tasks today." : store.status)
                            .font(.footnote)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                        Button("Refresh") { Task { await store.refresh() } }
                            .font(.footnote)
                    }
                } else {
                    List(store.tasks) { t in
                        NavigationLink {
                            TimerView(task: t)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text((t.isMIT ? "★ " : "") + t.name)
                                    .font(.body)
                                    .lineLimit(2)
                                HStack(spacing: 4) {
                                    Text("\(Int((Double(t.secsRemaining) / 60).rounded()))m")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    if let c = t.categoryName {
                                        Text("· \(c)")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await store.refresh() }
                    } label: { Image(systemName: "arrow.clockwise") }
                }
            }
        }
        .task { await store.refresh() }
    }
}
