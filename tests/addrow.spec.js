const { test, expect } = require('@playwright/test');
const { open } = require('./helpers');
test.beforeEach(async ({ page }) => { await open(page); });

test('time is a dropdown; quick-time button row is gone; selection sets mins', async ({ page }) => {
  const r = await page.evaluate(() => {
    const sel = document.getElementById('taskTime');
    return { isSelect: sel.tagName, optionCount: sel.options.length,
             quickRowGone: !document.getElementById('quickTimes') };
  });
  expect(r.isSelect).toBe('SELECT');
  expect(r.quickRowGone).toBe(true);
  expect(r.optionCount).toBeGreaterThan(5);

  // pick 45 min via the dropdown, add a task, confirm mins
  await page.fill('#taskInp', 'Deep work');
  await page.selectOption('#taskTime', '45');
  await page.evaluate(() => addTask());
  const t = await page.evaluate(() => tasks[tasks.length-1]);
  expect(t.name).toBe('Deep work');
  expect(t.mins).toBe(45);

  // dropdown keeps its value after add (not reset to a text field)
  const after = await page.evaluate(() => document.getElementById('taskTime').value);
  expect(after).toBe('45');
});
