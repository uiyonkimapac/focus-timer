# Tests

Automated regression tests for Focus Timer. The app ships as a single static
`index.html` (no build), so these tests load the **real** page in a headless
browser and exercise the actual shipped functions — no code is extracted or
mocked, so a passing run means the real app behaves.

## Run

```bash
npm install            # first time only (installs @playwright/test)
npx playwright install chromium   # first time only, if the browser is missing
npm test               # run everything
npm run test:headed    # watch it drive a real browser
npm run test:ui        # interactive Playwright UI
```

A local static server (`python3 -m http.server 8099`) is started automatically
for the run.

## What's covered

- **`unit.spec.js`** — pure logic: `parseTime`, `fmtMins`, `dayKey`,
  `recurNextDue` (daily / weekdays / weekly), `newId` uniqueness.
- **`flows.spec.js`** — the bug-dense behaviours: precise history removal on
  un-complete (the data-loss regression), recurring-task revival + history
  preservation, the recurrence cycle, "Not today" excluded from the map,
  the storage-full toast, and basic complete→history.

Add a test whenever you fix a bug or add logic — it's the cheapest insurance
against silently breaking the single file as it grows.
