// Behaviour tests — the bug-dense flows that have actually broken before.
// These drive the real shipped functions, so a regression fails the suite.
const { test, expect } = require('@playwright/test');
const { open, seedTasks } = require('./helpers');

test.beforeEach(async ({ page }) => { await open(page); });

test('un-completing one task keeps other same-named history rows (no data loss)', async ({ page }) => {
  await seedTasks(page, [{ name: 'Email' }, { name: 'Email' }]);
  const r = await page.evaluate(() => {
    const [a, b] = tasks;
    toggleDone(a.id); toggleDone(b.id);          // complete both
    const afterBoth = history.length;
    toggleDone(b.id);                            // un-complete only B
    return {
      afterBoth,
      afterUncomplete: history.length,
      remainingIsA: history.length === 1 && history[0].id === a._histId,
    };
  });
  expect(r.afterBoth).toBe(2);
  expect(r.afterUncomplete).toBe(1);   // not 0 — the old bug wiped both
  expect(r.remainingIsA).toBe(true);
});

test('recurring daily task revives on its next due day, preserving history', async ({ page }) => {
  await seedTasks(page, [{ name: 'Standup', recur: 'daily' }]);
  const r = await page.evaluate(() => {
    const t = tasks[0];
    toggleDone(t.id);
    const histAfter = history.length;
    t.completedAt = Date.now() - 26 * 3600 * 1000; // pretend it was finished ~yesterday
    const revived = reviveRecurringTasks();
    return { histAfter, revived, done: t.done, histStill: history.length, reset: t.secsRemaining === t.mins * 60 };
  });
  expect(r.histAfter).toBe(1);
  expect(r.revived).toBe(true);
  expect(r.done).toBe(false);
  expect(r.histStill).toBe(1);   // the past completion stays archived
  expect(r.reset).toBe(true);
});

test('recurring task completed today does not revive', async ({ page }) => {
  await seedTasks(page, [{ name: 'Standup', recur: 'daily' }]);
  const r = await page.evaluate(() => {
    const t = tasks[0];
    toggleDone(t.id);                  // completed now (today)
    return { revived: reviveRecurringTasks(), done: t.done };
  });
  expect(r.revived).toBe(false);
  expect(r.done).toBe(true);
});

test('cycleRecur cycles off -> daily -> weekdays -> weekly -> off', async ({ page }) => {
  await seedTasks(page, [{ name: 'x' }]);
  const seq = await page.evaluate(() => {
    const t = tasks[0]; const out = [];
    for (let i = 0; i < 5; i++) { out.push(t.recur || 'off'); cycleRecur(t.id); }
    return out;
  });
  expect(seq).toEqual(['off', 'daily', 'weekdays', 'weekly', 'off']);
});

test('"Not today" tasks are excluded from the Map', async ({ page }) => {
  await seedTasks(page, [{ name: 'Active' }, { name: 'Snoozed' }]);
  const peakIds = await page.evaluate(() => {
    toggleNotToday(tasks[1].id);
    setViewMode('map');
    return [...document.querySelectorAll('#mapSvg .map-peak')].map(el => Number(el.getAttribute('data-task-id')));
  });
  expect(peakIds.length).toBe(1);
  expect(peakIds[0]).toBe(await page.evaluate(() => tasks[0].id));
});

test('a storage write failure surfaces the "Storage full" toast', async ({ page }) => {
  const open = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
    storageFullNotified = false;
    saveAll();
    const shown = document.getElementById('storageToast').classList.contains('open');
    Storage.prototype.setItem = orig; // restore so later writes work
    return shown;
  });
  expect(open).toBe(true);
});

test('completing a task logs it to history and the count reflects it', async ({ page }) => {
  await seedTasks(page, [{ name: 'Write report', mins: 25 }]);
  const r = await page.evaluate(() => {
    toggleDone(tasks[0].id);
    return { done: tasks[0].done, hist: history.length, histName: history[0] && history[0].name };
  });
  expect(r.done).toBe(true);
  expect(r.hist).toBe(1);
  expect(r.histName).toBe('Write report');
});
