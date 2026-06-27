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

test('Run queue reorders by dragging the grip (arrows are gone)', async ({ page }) => {
  await seedTasks(page, [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }]);
  const out = await page.evaluate(() => {
    openRunSetup();
    const box = document.getElementById('runTaskList');
    const hadArrows = /run-move|runMove/.test(box.innerHTML);
    const orderBefore = runSetupOrder.slice();
    const rows = [...box.querySelectorAll('.run-row')];
    const grip = rows[0].querySelector('.run-grip');           // drag "First"...
    const target = rows[2].getBoundingClientRect();            // ...down onto "Third"
    const gr = grip.getBoundingClientRect();
    const down = { clientX: gr.left + 2, clientY: gr.top + 2, pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' };
    const move = { clientX: target.left + 2, clientY: target.top + target.height - 1, pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' };
    grip.dispatchEvent(new PointerEvent('pointerdown', down));
    document.dispatchEvent(new PointerEvent('pointermove', move));
    document.dispatchEvent(new PointerEvent('pointerup', move));
    const orderAfter = runSetupOrder.slice();
    closeRunSetup();
    return { hadArrows, orderBefore, orderAfter };
  });
  expect(out.hadArrows).toBe(false);                 // arrow buttons removed
  expect(out.orderAfter).not.toEqual(out.orderBefore);  // drag changed the order
  expect(out.orderAfter[out.orderAfter.length - 1]).toBe(out.orderBefore[0]); // "First" moved to the end
});

test('Run rows show a category-name kicker (categorized only)', async ({ page }) => {
  const out = await page.evaluate(() => {
    categories.push({ id: 'c1', name: 'Kagoshima PTW', color: '#84977a' });
    return null;
  });
  await seedTasks(page, [{ name: 'Pushback brief', categoryId: 'c1' }, { name: 'Loose task' }]);
  const res = await page.evaluate(() => {
    openRunSetup();
    const rows = [...document.querySelectorAll('#runTaskList .run-row')];
    const byName = (n) => rows.find(r => r.querySelector('.run-row-name').textContent === n);
    const catRow = byName('Pushback brief');
    const looseRow = byName('Loose task');
    const out = {
      catKicker: catRow.querySelector('.run-cat-kicker') ? catRow.querySelector('.run-cat-kicker').textContent : null,
      catKickerColor: catRow.querySelector('.run-cat-kicker') ? catRow.querySelector('.run-cat-kicker').style.color : null,
      looseHasKicker: !!looseRow.querySelector('.run-cat-kicker'),
    };
    closeRunSetup();
    return out;
  });
  expect(res.catKicker).toBe('Kagoshima PTW');     // full name, not truncated in markup
  expect(res.catKickerColor).toBeTruthy();         // colour-matched to the category
  expect(res.looseHasKicker).toBe(false);          // uncategorized stays single-line
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
