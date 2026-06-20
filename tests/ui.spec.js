const { test, expect } = require('@playwright/test');
const { open, seedTasks } = require('./helpers');
test.beforeEach(async ({ page }) => { await open(page); });

test('Clear Done moved from toolbar to the Completed section, and works', async ({ page }) => {
  // no "Clear Done" button remains in the top toolbar
  const toolbarHasClear = await page.evaluate(() =>
    [...document.querySelectorAll('.header-actions button')].some(b => /clear done/i.test(b.textContent)));
  expect(toolbarHasClear).toBe(false);

  await seedTasks(page, [{ name: 'A' }, { name: 'B' }]);
  const r = await page.evaluate(() => {
    toggleDone(tasks[0].id);                 // A becomes done -> Completed section appears
    renderTasks();
    const btn = document.querySelector('.done-header .btn-clear-done');
    const before = tasks.length;
    btn.click();                             // should run clearDone()
    return { btnExists: !!btn, before, after: tasks.length, anyDone: tasks.some(t => t.done) };
  });
  expect(r.btnExists).toBe(true);
  expect(r.before).toBe(2);
  expect(r.after).toBe(1);                   // the done task was cleared
  expect(r.anyDone).toBe(false);
});
