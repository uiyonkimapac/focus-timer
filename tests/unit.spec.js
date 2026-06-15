// Pure-logic tests. These call the app's own functions with controlled inputs
// (no DOM dependence) and assert exact outputs — the cheap, fast safety net.
const { test, expect } = require('@playwright/test');
const { open } = require('./helpers');

test.beforeEach(async ({ page }) => { await open(page); });

test('parseTime handles common formats and clamps to 1..480', async ({ page }) => {
  const r = await page.evaluate(() => ({
    m: parseTime('25m'), h: parseTime('1h'), hm: parseTime('1h 30m'),
    bare: parseTime('90'), empty: parseTime(''), zero: parseTime('0'), over: parseTime('999'),
  }));
  // '0' and '' both fall back to the 25-minute default (0 is falsy in `parseInt(str)||25`).
  expect(r).toEqual({ m: 25, h: 60, hm: 90, bare: 90, empty: 25, zero: 25, over: 480 });
});

test('fmtMins formats hours and minutes', async ({ page }) => {
  const r = await page.evaluate(() => [fmtMins(0), fmtMins(25), fmtMins(60), fmtMins(90)]);
  expect(r).toEqual(['0m', '25m', '1h', '1h 30m']);
});

test('dayKey formats as YYYY-MM-DD', async ({ page }) => {
  const r = await page.evaluate(() => dayKey(new Date(2026, 0, 5, 13, 0, 0).getTime()));
  expect(r).toBe('2026-01-05');
});

test('recurNextDue: daily = next calendar day at midnight', async ({ page }) => {
  const r = await page.evaluate(() => {
    const completed = new Date(2026, 0, 10, 14, 0, 0).getTime(); // Sat 10 Jan
    const d = new Date(recurNextDue({ recur: 'daily', completedAt: completed }));
    return { day: d.getDate(), hour: d.getHours() };
  });
  expect(r).toEqual({ day: 11, hour: 0 });
});

test('recurNextDue: weekdays skips the weekend (Fri completion -> Mon)', async ({ page }) => {
  const r = await page.evaluate(() => {
    const fri = new Date(2026, 0, 9, 10, 0, 0).getTime(); // 9 Jan 2026 is a Friday
    const d = new Date(recurNextDue({ recur: 'weekdays', completedAt: fri }));
    return { dow: d.getDay(), day: d.getDate() };
  });
  expect(r).toEqual({ dow: 1, day: 12 }); // Monday 12 Jan
});

test('recurNextDue: weekly = next occurrence of the anchor weekday', async ({ page }) => {
  const r = await page.evaluate(() => {
    const mon = new Date(2026, 0, 5, 9, 0, 0).getTime(); // Mon 5 Jan
    const d = new Date(recurNextDue({ recur: 'weekly', completedAt: mon, recurDay: 1 }));
    return { dow: d.getDay(), day: d.getDate() };
  });
  expect(r).toEqual({ dow: 1, day: 12 }); // next Monday
});

test('newId is unique, monotonic and integer across a same-tick burst', async ({ page }) => {
  const r = await page.evaluate(() => {
    const ids = []; for (let i = 0; i < 2000; i++) ids.push(newId());
    let mono = true; for (let i = 1; i < ids.length; i++) if (ids[i] <= ids[i - 1]) mono = false;
    return { unique: new Set(ids).size === ids.length, mono, allInt: ids.every(Number.isInteger) };
  });
  expect(r).toEqual({ unique: true, mono: true, allInt: true });
});
