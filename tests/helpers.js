// Shared test helpers. Each Playwright test gets a fresh browser context
// (empty localStorage, no service worker), so we just load the real app and
// reset the in-memory state to a clean slate before exercising it.
//
// The app is a classic inline script: its top-level functions (newId,
// toggleDone, recurNextDue, …) and `let` state (tasks, history, categories,
// activeId, …) are reachable as bare identifiers inside page.evaluate.

async function open(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    tasks.length = 0; history.length = 0; categories.length = 0;
    if (typeof routines !== 'undefined') routines.length = 0;
    activeId = null;
    if (typeof uncatCollapsed !== 'undefined') uncatCollapsed = false;
    if (typeof doneCollapsed !== 'undefined') doneCollapsed = false;
    if (typeof singleFocus !== 'undefined') singleFocus = false;
    renderTasks();
  });
}

// Seed active tasks from light specs: [{name, mins?, categoryId?, recur?}]
async function seedTasks(page, specs) {
  await page.evaluate((specs) => {
    for (const s of specs) {
      const mins = s.mins || 25;
      const t = {
        id: newId(), name: s.name, mins, secsRemaining: mins * 60,
        done: false, sessions: 0, secsSpent: 0, source: 'manual',
        createdAt: Date.now(), notes: '', categoryId: s.categoryId || null,
        isMIT: false, notTodayDayKey: null, lastHiddenDayKey: null, notTodayStreak: 0,
      };
      if (s.recur) { t.recur = s.recur; if (s.recur === 'weekly') t.recurDay = new Date().getDay(); }
      tasks.push(t);
    }
    renderTasks();
  }, specs);
}

module.exports = { open, seedTasks };
