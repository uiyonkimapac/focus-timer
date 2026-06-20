// Run (auto-loop) behaviour. The Run mode loops a chosen set of tasks, with
// optional inter-task breaks, inside the focus Sanctuary. These flows have all
// regressed at least once, so they're driven against the real shipped code.
const { test, expect } = require('@playwright/test');
const { open, seedTasks } = require('./helpers');

test.beforeEach(async ({ page }) => { await open(page); });

test('an inter-task break does not eat into the next task\'s remaining time', async ({ page }) => {
  await seedTasks(page, [{ name: 'A', mins: 15 }, { name: 'B', mins: 20 }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), 'short');
    Sanctuary.doneRun();                       // finish A -> enter break, B is now active
    const b = tasks.find(t => t.name === 'B');
    const before = b.secsRemaining;
    running = true; tickAnchorMs = Date.now() - 60000; tickAnchorRemaining = remaining; tick(); // 60s of break
    return { mode, before, after: b.secsRemaining, onBreak: document.body.classList.contains('break') };
  });
  expect(r.onBreak).toBe(true);
  expect(r.mode).not.toBe('focus');
  expect(r.after).toBe(r.before);              // break time must not be drained from B
});

test('queue strip escapes task names (no HTML injection)', async ({ page }) => {
  await seedTasks(page, [{ name: '<img src=x onerror=alert(1)>' }, { name: 'B' }]);
  const html = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), 'none');
    return document.getElementById('sxQueue').innerHTML;
  });
  expect(html).not.toMatch(/<img/i);
  expect(html).toContain('&lt;img');
});

test('no break runs after the final task; the run completes', async ({ page }) => {
  await seedTasks(page, [{ name: 'Only', mins: 5 }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), 'short');
    Sanctuary.doneRun();                        // finishing the last (only) task
    return { cat: document.getElementById('sxCat').textContent, onBreak: document.body.classList.contains('break') };
  });
  expect(r.cat).toBe('RUN COMPLETE');
  expect(r.onBreak).toBe(false);
});

test('letting each focus timer expire logs the work to history', async ({ page }) => {
  await seedTasks(page, [{ name: 'A', mins: 5 }, { name: 'B', mins: 5 }, { name: 'C', mins: 5 }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), 'none');
    Sanctuary.onFinish('focus'); Sanctuary.onFinish('focus'); Sanctuary.onFinish('focus');
    return { done: tasks.filter(t => t.done).length, hist: history.length,
             title: document.getElementById('sxEndTitle').textContent };
  });
  expect(r.done).toBe(3);
  expect(r.hist).toBe(3);
  expect(r.title).toBe('3 mountains climbed.');
});

test('the completion count reflects tasks actually done, not skipped ones', async ({ page }) => {
  await seedTasks(page, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), 'none');
    Sanctuary.doneRun();                         // complete A
    Sanctuary.skipRun(); Sanctuary.skipRun();    // skip B and C
    return { done: tasks.filter(t => t.done).length, title: document.getElementById('sxEndTitle').textContent };
  });
  expect(r.done).toBe(1);
  expect(r.title).toBe('1 mountain climbed.');
});
