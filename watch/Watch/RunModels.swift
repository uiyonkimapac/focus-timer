import Foundation

// A saved run ("routine") as stored in the synced blob's `routines` array.
// The watch only ever READS these — it never creates, edits, or deletes a
// saved run, so a run stays reusable forever (matches the web app: the
// template persists; only disposable instances are cleaned up, and the
// history-only watch doesn't make instances at all).

// The break that follows a step. Durations mirror the web app's MODES:
// short = 5 min, long = 15 min. The last step's gap is ignored.
enum Gap: String {
    case none, short, long

    var mins: Int {
        switch self {
        case .none: return 0
        case .short: return 5
        case .long: return 15
        }
    }

    var label: String {
        switch self {
        case .none: return ""
        case .short: return "Short break"
        case .long: return "Long break"
        }
    }
}

struct RunStep: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let mins: Int        // 1…480, focus minutes
    let gapAfter: Gap    // break after THIS step
}

struct Routine: Identifiable, Hashable {
    let id: String       // 'r_…' string id (never a numeric task id)
    let name: String
    let steps: [RunStep]
    let autoFlow: Bool    // true → auto-complete + auto-advance, no overtime

    var totalMins: Int { steps.reduce(0) { $0 + $1.mins } }
}
