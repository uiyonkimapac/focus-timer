# TODOS

## Watch

### Verify parked lists survive a Watch completion on a real device

**What:** Complete a task from the Watch while the sync row contains `lists` and `activeList`, then confirm both keys are intact and the web app still shows all lists.

**Why:** The Watch fetches the whole sync row, edits `tasks`/`history`, and PATCHes the whole object back. Reading the Swift code says unknown keys round-trip, but it has only been verified by reading, not by running.

**Context:** `watch/Watch/SyncStore.swift` `complete()` → `push()`. Web side: `pushToCloud`/`applyRemote` in `index.html`. Shipped in v1.1.0.0 (issue #2). Also still pending from earlier: real Series-9 on-device install.

**Effort:** S
**Priority:** P1
**Depends on:** None

## List

### Tap a category chip to filter the list to that category

**What:** Optional filter: tapping a chip (or a filter control) shows only that category's active tasks; tapping again clears.

**Why:** With headers gone, a fast way to see "just this project" may be missed on long lists. Parked as a nice-to-have when the flat queue shipped; wait for real usage before building.

**Context:** Chips render in `renderTaskCard` (`.tag-cat`); a filter would be a render-time predicate in `renderTasks`, nothing in the data model. Keep it one tap, no settings.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed
