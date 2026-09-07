# Changelog

All notable changes to Focus Timer. Versions are `MAJOR.MINOR.PATCH.MICRO`.
Earlier work (Mountain Board map, sync, Watch companion, routines) predates this file.

## [1.1.0.0] - 2026-09-07

### Added
- **Up to five separate task lists.** A dropdown next to the List/Map toggle shows every list with the time it was last saved. Create a new empty list, rename the current one, switch between them, or delete one (with confirmation and Undo). Each list keeps its own tasks, categories, routines, history, stats and map layout. Your existing data becomes a list named "My tasks" on first load.
- **Category label on every task.** Each card shows a colored chip with its category name. Click the chip to change the category from a small inline dropdown. Uncategorized tasks show a faint "+ category" chip.

### Changed
- **List view is one flat queue.** Tasks appear in the order you set, regardless of category, so any task can sit at the top. Category header rows are gone. The Not today and Completed sections are unchanged.
- **Dragging moves a task only.** Dropping a task near another category's tasks no longer changes its category. Map view remains the only place where dragging a peak onto a range re-categorizes it.
- **Switching, creating or deleting lists is blocked while the timer or a Run is active**, with a short note asking you to pause first, so the task you are on is never lost.
- The Watch keeps showing whichever list is active on your other devices. No Watch update needed.

### Removed
- Category lane dragging and per-category collapse in List view.
- The brain emoji on the empty list state.
