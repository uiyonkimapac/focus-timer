# Focus Timer — project guide for Claude

ADHD-first focus app. The entire app is **one static file — `index.html`** (HTML + CSS + JS,
no build step, no framework, no bundler). That is a deliberate design decision, not an
accident: keep it a single file.

## Ground rules

- **Never split `index.html`** into modules or introduce a build step.
- **Run `npm test` before every commit.** The suite loads the real `index.html` in headless
  Chromium and exercises the shipped code — a passing run means the real app behaves.
- **Every bug fix ships with a regression test.** Add a spec to `tests/` reproducing the bug
  before or alongside the fix (see `tests/README.md`).
- **`main` is production.** GitHub Pages serves `main` directly — anything pushed there is
  live for users immediately. Never push to `main` with a red test suite.
- No trackers, no accounts, no external network calls at runtime except the optional
  Supabase sync (vendored + pinned in `vendor/`, CSP-pinned in `index.html`).

## Commands

```bash
npm install                        # first time only
npx playwright install chromium    # first time only, if browser missing
npm test                           # full Playwright suite (auto-starts a static server on :8099)
npm run test:headed                # watch it drive a real browser
python3 -m http.server 8099        # serve the app manually at http://127.0.0.1:8099
```

## Layout

- `index.html` — the whole app: List view, Mountain Board (Map), Pomodoro timer, Run mode,
  routines, sync. Large file (~340 KB); search for section comments / function names rather
  than reading it top to bottom.
- `tests/` — Playwright specs. `unit.spec.js` covers pure logic (`parseTime`, `fmtMins`,
  `dayKey`, `recurNextDue`, `newId`); `flows.spec.js` covers the bug-dense flows
  (un-complete history removal, recurring revival, "Not today", storage-full toast);
  plus `ui.spec.js`, `addrow.spec.js`, `run.spec.js`.
- `sw.js` + `manifest.webmanifest` — PWA/offline. **Bump the cache version in `sw.js`**
  whenever shipped assets change, or users keep the stale version.
- `watch/` — native watchOS companion (Xcode project; cannot build in Linux/cloud
  sessions — edit Swift sources only, build/verify happens on a Mac).
- `vendor/` — pinned third-party code (supabase-js). Update deliberately, never casually.
- `docs/` — user manual and specs.

## Known bug-dense areas (test first, edit second)

- History add/removal on complete/un-complete (past data-loss regression).
- Recurrence (`recurNextDue`): daily / weekdays / weekly revival and history preservation.
- Snooze ("Not today") interactions with the map and the FACE IT! badge.
- localStorage quota handling (storage-full toast).
