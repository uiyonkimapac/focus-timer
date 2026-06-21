# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this is

**Focus Timer** (UI brand: "Now This") is an ADHD-first focus app shipped as a
**single static `index.html`** — a Progressive Web App with **no build step, no
framework, no bundler, and no backend of its own**. The entire app (HTML, CSS,
and JavaScript) lives inline in one file. It's deployed to GitHub Pages and runs
offline via a service worker.

It offers two views of the same tasks:
- **List view (`≡`)** — a fast execution list with categories, a Pomodoro timer,
  and a full-screen "Focus Sanctuary" run mode.
- **Map view (`⛰`)** — the "Mountain Board", an SVG canvas where each task is a
  hand-drawn peak (size = duration, x = time-of-day along an hour ruler,
  y = priority), and categories are mountain ranges.

The single guiding principle: **hold the user's working memory for them** and
make the next action one tap away.

## The golden rule: it stays one file

`index.html` is the product. There is **no compile/transpile step** — what's in
the file is exactly what ships. Do **not** introduce a build system, split the
app into modules/imports, add npm runtime dependencies, or pull in a framework.
The only npm usage here is **dev-only test tooling** (Playwright).

When editing the app, edit `index.html` directly. Match the surrounding style:
plain ES (classic inline script with top-level `function`/`let`), vanilla DOM
APIs, template-literal HTML strings, and CSS custom properties for theming.

## Repository layout

```
index.html              ← THE APP (HTML + inline <style> + inline <script>). ~5,700 lines.
sw.js                   ← Service worker: offline shell + asset caching strategy.
manifest.webmanifest    ← PWA manifest (installability, icons, theme color).
icons/                  ← App icons (PNG + SVG). These are real assets, not gitignored.
sounds/                 ← Timer/run sound effects + focus music (mp3).
docs/
  USER-MANUAL.md        ← End-user manual. Keep in sync with feature changes.
  img/                  ← README/manual screenshots.
README.md               ← Public-facing product pitch.
package.json            ← Dev-only: Playwright scripts + devDependency. No runtime deps.
playwright.config.js    ← Test config; serves the folder with python http.server on :8099.
tests/                  ← Playwright regression tests (see "Testing").
```

Note: a few planning docs (`docs/COMMERCIALIZATION-ROADMAP.md`,
`docs/RECOMMENDATIONS.md`) and local backups (`*.backup.html`) are gitignored —
keep them out of the repo.

## Inside `index.html`

The file has three regions (line numbers drift as it grows — search by marker):

1. `<head>` / inline `<style>` (≈ lines 14–1545) — all CSS. Theming is driven by
   CSS custom properties (`--accent`, `--blue`, `--amber`, …); light theme is a
   `body.light` class. Dark = ink on slate, light = sepia on parchment.
2. `<body>` markup (≈ 1547–1866) — static shell: timer panel, tab bar, list
   container, map `<svg>`, and modals (`#runModal`, `#syncModal`, category modal,
   import/save modals). Most task/map content is rendered dynamically into these.
3. Inline `<script>` (≈ 1867–5619) — all app logic, plus a second small inline
   `<style>` at the end. The Supabase JS client is loaded from a CDN
   `<script>` just before the main script.

### State model (top-level `let` in the main script)

The app keeps in-memory arrays/vars that are read and mutated directly by name
(this matters for tests — see below):

- `tasks` — array of task objects. A task looks like:
  ```js
  { id, name, mins, secsRemaining, done, sessions, secsSpent, source,
    createdAt, notes, categoryId, isMIT,
    notTodayDayKey, lastHiddenDayKey, notTodayStreak,
    recur?, recurDay? }   // recur: 'daily' | 'weekdays' | 'weekly'
  ```
- `history` — completed-task log entries (drives stats + export).
- `categories` — `{ id, name, color, collapsed }`. Colors come from `CAT_COLORS`.
- `activeId` — id of the currently-selected task.
- Timer: `mode` ('focus'|'short'|'long'), `remaining`, `running`, `ticker`, etc.
- Map view: `mapView` (SVG viewBox), `WORLD_W/H`, `mapSelection`, `mapDrag`.
- Sync: `syncCode`, `syncChannel`, `dataTimestamp`, `lastClearedAt`.

### Persistence

State is saved to **`localStorage`** under `focustimer_*` keys (see the
`STORAGE_*` constants: `_tasks`, `_history`, `_stats`, `_categories`,
`_synccode`, `_dataTs`, `_clearedAt`). `saveAll()` writes; `loadAll()` reads on
boot. `notifyStorageFull()` surfaces a toast if the quota is exceeded.

### Optional realtime sync (Supabase)

Sync is **opt-in** via a sync code. When enabled, state is upserted to a single
Supabase table `focus_sync` (row keyed by `sync_id`, payload in a `data` column)
and changes stream back over a realtime channel. Key functions: `schedulePush`,
`applyRemote`, `subscribeRealtime`, `generateSyncCode`, `disconnectSync`. The
`SUPABASE_URL`/`SUPABASE_KEY` are a publishable anon config embedded in the file.
Conflict resolution uses `dataTimestamp` / `lastClearedAt` for last-writer-wins.
If `supabase-js` fails to load, `sb` is null and the app degrades gracefully
(local-only).

### Notable subsystems & where to find them (search these function names)

- **Tasks/list rendering:** `renderTasks`, `renderTaskCard`, `renderCategoryHeader`,
  `addTask`, `toggleDone`, `deleteTask`, `setTaskTime`, `renameTask`.
- **Categories:** `addCategory`, `openCategoryModal`, `confirmCategoryModal`,
  `renameCategory`, `deleteCategory`.
- **Pomodoro timer:** `setMode`, `toggleTimer`, `startTimer`, `tick`,
  `pauseTimer`, `resetTimer`, `skipSession`, `updateDisplay`, `updateRing`.
- **"Not today" / snooze:** `toggleNotToday`, `isHiddenToday`,
  `clearExpiredNotToday` (snoozed tasks return next day; 3-day streak → FACE IT!).
- **Recurrence:** `cycleRecur`, `recurNextDue`, `reviveRecurringTasks`,
  `recurLabel` (daily / weekdays / weekly).
- **MIT (Most Important Task):** `toggleMIT`.
- **Mountain Board (map):** `renderMap`, `fitMapCanvas`, peak geometry helpers
  (`peakPos`, `peakPathD`, `peakHeight`, `peakWidth`, `snowCapD`), range geometry
  (`rangeRidgeD`, `rangeSpurD`), pointer handling (`onMapPointerDown/Move/Up`,
  `mergeTasks`, `mapZoomAt`, `clampMapView`), and `mapAddPeakAt`/`mapRenamePeak`.
  `WORKDAY_MIN = 480` (8h) defines the full map width / overflow tint.
- **Focus Sanctuary (full-screen run mode):** the `window.Sanctuary` IIFE near
  the end. Entered via `openRunSetup` → `startRunFromSetup` → `Sanctuary.startRun`.
  Plays focus/break music ("Tick Lab" tracks) and walks a queue of tasks.
- **Export/import:** `doSave` / `exportHistory` (formatted HTML report),
  `doImport` (brain-dump text → tasks).
- **Stats:** `updateStats` — three-card glance (Focused / Remaining / Done).

## Service worker (`sw.js`)

- **Navigations → network-first**, falling back to cached `index.html`. The app
  is one unhashed file, so cache-first would pin users to a stale build; this
  picks up deploys on the next online refresh with **no version bump needed**.
- **Same-origin static** (sounds/icons/manifest) → cache-first (precached list).
- **Fonts + CDN** (Google Fonts, jsdelivr) → stale-while-revalidate.
- **`*.supabase.co` and all non-GET requests** are never intercepted.

If you add a new precached asset (e.g. a new sound/icon), add it to `PRECACHE`.

## Testing

Tests use **Playwright** and load the **real shipped `index.html`** in headless
Chromium — nothing is extracted or mocked, so a green run means the real app
behaves. Tests reach the app's top-level functions and state as **bare global
identifiers** inside `page.evaluate` (e.g. `tasks`, `newId()`, `toggleDone()`,
`renderTasks()`). `tests/helpers.js` exposes `open(page)` (loads + resets state)
and `seedTasks(page, specs)`.

```bash
npm install                       # first time: installs @playwright/test
npx playwright install chromium   # first time, if the browser is missing
npm test                          # run everything (auto-starts a static server)
npm run test:headed               # watch it drive a real browser
npm run test:ui                   # interactive Playwright UI
```

Coverage map (`tests/`):
- `unit.spec.js` — pure logic: `parseTime`, `fmtMins`, `dayKey`, `recurNextDue`,
  `newId` uniqueness.
- `flows.spec.js` — bug-dense behaviours: precise history removal on un-complete,
  recurring revival + history preservation, recurrence cycle, "Not today"
  excluded from the map, storage-full toast, complete→history.
- `run.spec.js` — Focus Sanctuary run-mode behaviours.
- `addrow.spec.js`, `ui.spec.js` — add-task input + general UI affordances.

**Convention:** add a test whenever you fix a bug or add logic. It's the cheapest
insurance against silently breaking the single file as it grows.

## Conventions & expectations

- **Edit `index.html` in place**; never add a build/transpile step or split it up.
- **No runtime dependencies.** Browser APIs only. The one CDN script (supabase-js)
  must remain optional (null-guarded).
- **Escape user input** when injecting into HTML — use the existing `esc` /
  `escHtml` helpers (task names render via template literals).
- **Theme via CSS variables**, not hardcoded colors; support both `body.light`
  and dark. Update `theme-color` meta via `syncThemeColorMeta` if relevant.
- **Touch + mouse parity** — the app is mobile-first and installable; map and
  list interactions must work with both pointers (pinch/pan/drag).
- **Keep docs in sync** — when you change user-facing behavior, update
  `README.md` and `docs/USER-MANUAL.md` (recent commits show this is expected).
- **Offline-first** — don't assume network. New assets should be precached in
  `sw.js` if they must work offline.

## Git workflow

- Active development branch for this work: **`claude/claude-md-docs-8viygm`**.
  Create it locally if missing; commit there and push with
  `git push -u origin claude/claude-md-docs-8viygm`. Don't push to other branches
  without explicit permission.
- `main` deploys to GitHub Pages (the live app), so treat it as production.
- Don't open a pull request unless explicitly asked.
- Commit messages in this repo are concise and scoped (e.g. `Run: …`,
  `Mobile: …`, `docs: …`) — follow that style.
