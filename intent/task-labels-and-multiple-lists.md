# Intent: category labels on tasks + multiple saved lists
Author: Uiyon Kim (FOCUS TIMER). Status: draft. Date: 2026-09-07 (KST).

## Problem
The List view and Run setup group tasks under category headers, so ordering is
really category ordering: moving one task to the top drags its whole category
along, and a single task can't sit above tasks from another category. Separately,
there is only one task list, so unrelated bodies of work (different projects,
home vs. work) pile into the same list and the same map with no way to park one
and switch to another.

## Proposed outcome
(1) In List and Run, every task is an independent row in one flat queue that
carries its category as a colored label; the user can drag any task to any
position regardless of category. Category headers disappear from List and Run.
Map view keeps its current category-based mountains as the "grouped" view.
(2) The user can keep up to five named lists: save the current one, start a
fresh empty list, switch between them, and delete one. Each list is a fully
separate world (own tasks, categories, routines, map positions, history).
Map view shows the active list's map and also lets the user pick another saved
list's map directly. The Watch mirrors whatever list is active.

## Affected users and systems
- Sole user (ADHD; see memory: externalize working memory, low friction).
- `index.html` List view rendering + drag/reorder, Run setup ordering, Map view
  (category → peak mapping, mapX/mapY), category modals and picker.
- Task/category/routine data model (`tasks[].categoryId`, `categories[].order`,
  `routines`) and its localStorage keys; Supabase sync rows.
- Routines (saved runs materialize tasks under a category named after the
  routine) — must still work when tasks are no longer grouped.
- Apple Watch companion (reads the synced tasks for Today list + Run mode).
- Existing Playwright tests under `tests/`.

## Constraints
- No data loss: existing tasks, categories, history, routines and map positions
  become the first saved list unchanged on upgrade; a saved list is never
  silently discarded (deleting a list requires a deliberate confirm and offers
  Undo, matching the app's existing patterns).
- Lists are fully separate: categories, routines, map positions and history all
  belong to one list; nothing is shared across lists.
- Maximum five lists.
- Map view behavior (category mountains, proximity stacking, etched-cartography
  design) stays as is; only which list it displays changes, plus a picker to
  view another list's map.
- ADHD-first: switching lists is one tap; no nested menus, no settings screen;
  the active list name is always visible so the user never wonders "which list
  am I in".
- Watch shows only the active list and has no list switcher of its own; Watch
  and Supabase sync keep working end to end.
- Do not re-propose killed features (Delegate, Energy tags, auto Crunch Mode).
- Minimal design: reuse existing category colors as the label; no new
  dependencies.

## Open questions
- Does "task independent" ordering also apply to done/completed tasks, or only
  to the active queue?
- Stats/history screens: shown per list only, or is an "all lists" total ever
  wanted?
- Nice-to-have for later, not day one: tapping a category label in List view to
  filter to that category.
