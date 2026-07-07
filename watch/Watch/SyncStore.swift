import Foundation

// A task as the watch shows it. `id` matches the numeric id in the web app.
struct FocusTask: Identifiable, Hashable {
    let id: Int
    let name: String
    let mins: Int
    let secsRemaining: Int
    let categoryName: String?
    let isMIT: Bool
}

// Talks to the same focus_sync row as the web app, in the same format.
// The full data blob is kept verbatim as [String: Any] and only the fields
// the watch changes are touched — unknown/future fields survive a write-back.
@MainActor
final class SyncStore: ObservableObject {
    @Published var tasks: [FocusTask] = []
    @Published var routines: [Routine] = []
    @Published var status = ""
    @Published var loading = false

    private var raw: [String: Any] = [:]

    // ── Read ──

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            raw = try await fetchData()
            project()
            parseRoutines()
            status = ""
        } catch {
            status = "Can't reach sync — check iPhone nearby / Wi-Fi."
        }
    }

    private func fetchData() async throws -> [String: Any] {
        var req = restRequest(query: "sync_id=eq.\(SyncConfig.syncCode)&select=data")
        req.httpMethod = "GET"
        let (body, resp) = try await URLSession.shared.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200,
              let rows = try JSONSerialization.jsonObject(with: body) as? [[String: Any]],
              let data = rows.first?["data"] as? [String: Any]
        else { throw URLError(.badServerResponse) }
        return data
    }

    private func project() {
        let today = Self.dayKey(Date())
        let cats = raw["categories"] as? [[String: Any]] ?? []
        func catName(_ id: Any?) -> String? {
            guard let id = id as? String else { return nil }
            return cats.first { ($0["id"] as? String) == id }?["name"] as? String
        }
        let arr = raw["tasks"] as? [[String: Any]] ?? []
        tasks = arr.compactMap { t in
            guard let id = (t["id"] as? NSNumber)?.intValue else { return nil }
            let done = t["done"] as? Bool ?? false
            let hiddenToday = (t["notTodayDayKey"] as? String) == today
            guard !done, !hiddenToday else { return nil }
            let mins = (t["mins"] as? NSNumber)?.intValue ?? 25
            let rem = (t["secsRemaining"] as? NSNumber)?.intValue ?? mins * 60
            return FocusTask(id: id,
                             name: t["name"] as? String ?? "?",
                             mins: mins,
                             secsRemaining: rem > 0 ? rem : mins * 60,
                             categoryName: catName(t["categoryId"]),
                             isMIT: t["isMIT"] as? Bool ?? false)
        }
    }

    // Saved runs from the `routines` array, sorted by `order` like the web
    // strip. Read-only: the watch never writes back to `routines`.
    private func parseRoutines() {
        let arr = raw["routines"] as? [[String: Any]] ?? []
        let parsed: [(Int, Routine)] = arr.enumerated().compactMap { (i, r) in
            guard let id = r["id"] as? String, !id.isEmpty else { return nil }
            let stepsArr = r["steps"] as? [[String: Any]] ?? []
            let steps: [RunStep] = stepsArr.compactMap { s in
                guard let nm = s["name"] as? String else { return nil }
                let mins = (s["mins"] as? NSNumber)?.intValue ?? 25
                let gap = Gap(rawValue: (s["gapAfter"] as? String) ?? "none") ?? .none
                return RunStep(name: nm, mins: max(1, min(480, mins)), gapAfter: gap)
            }
            guard !steps.isEmpty else { return nil }
            let name = (r["name"] as? String) ?? "Untitled"
            let auto = (r["autoFlow"] as? Bool) ?? false
            let order = (r["order"] as? NSNumber)?.intValue ?? i
            return (order, Routine(id: id, name: name, steps: steps, autoFlow: auto))
        }
        routines = parsed.sorted { $0.0 < $1.0 }.map { $0.1 }
    }

    // Log one finished run step to history ONLY — no task is created, so
    // nothing can be orphaned if the watch suspends mid-run. Reports and the
    // Done count read `history`, so this keeps them correct. Same pull-fresh →
    // mutate → push, monotonic dataTimestamp, and lastClearedAt carried forward
    // verbatim (whole blob re-sent) as every other write.
    func logRunStep(name: String, mins: Int, secsSpent: Int) async -> Bool {
        do { raw = try await fetchData() } catch {
            status = "Offline — step not saved."
            return false
        }
        let nowMs = Int(Date().timeIntervalSince1970 * 1000)
        var hist = raw["history"] as? [[String: Any]] ?? []
        hist.insert(["id": "h_\(nowMs)",
                     "name": name,
                     "mins": mins,
                     "secsSpent": max(0, secsSpent),
                     "sessions": 0,
                     "source": "routine",
                     "completedAt": nowMs,
                     "createdAt": nowMs], at: 0)
        raw["history"] = hist

        let oldTs = (raw["dataTimestamp"] as? NSNumber)?.intValue ?? 0
        raw["dataTimestamp"] = max(oldTs + 1, nowMs)
        raw["ts"] = nowMs

        do {
            try await push()
            status = ""
            return true
        } catch {
            status = "Offline — step not saved."
            return false
        }
    }

    // ── Write (mirrors toggleDone() in index.html) ──
    // Pull-fresh → mutate → push whole state: the same last-write-wins model
    // every other device uses.

    func complete(_ task: FocusTask, elapsedSecs: Int) async -> Bool {
        do { raw = try await fetchData() } catch {
            status = "Offline — couldn't save. Try again."
            return false
        }
        guard var arr = raw["tasks"] as? [[String: Any]],
              let i = arr.firstIndex(where: { ($0["id"] as? NSNumber)?.intValue == task.id })
        else {
            // Task vanished on another device; just resync the list.
            project()
            status = "That task changed on another device."
            return false
        }
        var t = arr[i]
        if (t["done"] as? Bool) == true { project(); return true }

        let nowMs = Int(Date().timeIntervalSince1970 * 1000)
        let spent = ((t["secsSpent"] as? NSNumber)?.intValue ?? 0) + max(0, elapsedSecs)
        t["done"] = true
        t["completedAt"] = nowMs
        t["secsRemaining"] = 0
        t["secsSpent"] = spent
        arr[i] = t
        raw["tasks"] = arr

        // History entry in the exact shape the web app writes (sanitizeHistory-safe).
        var hist = raw["history"] as? [[String: Any]] ?? []
        hist.insert(["id": "h_\(nowMs)",
                     "name": t["name"] ?? "?",
                     "mins": t["mins"] ?? 25,
                     "secsSpent": spent,
                     "sessions": t["sessions"] ?? 0,
                     "source": t["source"] ?? "manual",
                     "completedAt": nowMs,
                     "createdAt": t["createdAt"] ?? 0], at: 0)
        raw["history"] = hist

        let oldTs = (raw["dataTimestamp"] as? NSNumber)?.intValue ?? 0
        raw["dataTimestamp"] = max(oldTs + 1, nowMs)
        raw["ts"] = nowMs

        do {
            try await push()
            project()
            status = ""
            return true
        } catch {
            status = "Offline — couldn't save. Try again."
            return false
        }
    }

    private func push() async throws {
        var req = restRequest(query: "sync_id=eq.\(SyncConfig.syncCode)")
        req.httpMethod = "PATCH"
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "data": raw,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ])
        let (_, resp) = try await URLSession.shared.data(for: req)
        guard let code = (resp as? HTTPURLResponse)?.statusCode, (200...299).contains(code)
        else { throw URLError(.badServerResponse) }
    }

    private func restRequest(query: String) -> URLRequest {
        var comps = URLComponents(url: SyncConfig.supabaseURL.appendingPathComponent("rest/v1/focus_sync"),
                                  resolvingAgainstBaseURL: false)!
        comps.percentEncodedQuery = query
        var req = URLRequest(url: comps.url!)
        req.setValue(SyncConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(SyncConfig.anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    // Same yyyy-MM-dd local-day key the web app's dayKey() produces.
    static func dayKey(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }
}
