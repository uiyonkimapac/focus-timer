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

// Security: category colour reaches HTML/SVG attributes unescaped, and category
// data can arrive from the untrusted realtime-sync channel. safeColor() must reject
// anything that isn't a plain hex / var() token so an attribute breakout is impossible.
test('safeColor only passes hex and var() tokens, neutralizing attribute breakouts', async ({ page }) => {
  const r = await page.evaluate(() => ({
    hex3:  safeColor('#abc', '#000'),
    hex6:  safeColor('#6e8062', '#000'),
    hex8:  safeColor('#11223344', '#000'),
    varOk: safeColor('var(--text3)', '#000'),
    breakout:  safeColor('red" onmouseover="alert(1)', '#000'),
    tagOut:    safeColor('x"><img src=x onerror=alert(1)>', '#000'),
    urlExpr:   safeColor('url(javascript:alert(1))', '#000'),
    nonString: safeColor({}, '#000'),
    empty:     safeColor('', '#000'),
  }));
  expect(r).toEqual({
    hex3: '#abc', hex6: '#6e8062', hex8: '#11223344', varOk: 'var(--text3)',
    breakout: '#000', tagOut: '#000', urlExpr: '#000', nonString: '#000', empty: '#000',
  });
});

test('sanitizeCategories strips a malicious sync colour back to a safe palette value', async ({ page }) => {
  const colors = await page.evaluate(() => {
    const evil = [
      { id: 'c1', name: 'Work',  color: 'x"><img src=x onerror=alert(document.cookie)>' },
      { id: 'c2', name: 'Home',  color: '#c0922f' },
    ];
    return sanitizeCategories(evil).map(c => c.color);
  });
  expect(colors[0]).not.toContain('<');
  expect(colors[0]).not.toContain('"');
  expect(colors[0]).toMatch(/^#[0-9a-fA-F]{3,8}$/); // fell back to a palette hex
  expect(colors[1]).toBe('#c0922f');                 // a valid colour is preserved
});

test('esc() escapes quotes so attribute-context values cannot break out', async ({ page }) => {
  const out = await page.evaluate(() => esc(`a"b'c<d>e&f`));
  expect(out).toBe('a&quot;b&#39;c&lt;d&gt;e&amp;f');
});

test('sanitizeTasks neutralizes a malicious sync id / categoryId and keeps clean tasks', async ({ page }) => {
  const out = await page.evaluate(() => {
    const evil = [
      // id is a JS-breakout string (rendered raw into onclick="selectTask(${t.id})")
      { id: '1);alert(document.cookie)//', name: 'pwn', categoryId: 'c1' },
      // categoryId tries to break out of data-cat-id="${t.categoryId}"
      { id: 42, name: 'attr break', categoryId: '"><img src=x onerror=alert(1)>' },
      // a legitimate task must survive untouched
      { id: 7, name: 'real', categoryId: 'c_123_456' },
    ];
    return sanitizeTasks(evil).map(t => ({ id: t.id, type: typeof t.id, categoryId: t.categoryId }));
  });
  // the string-id task is dropped (Number('1);…') is NaN → not finite)
  expect(out.find(t => t.id === 42)).toBeTruthy();
  expect(out.find(t => t.id === 7)).toBeTruthy();
  expect(out.every(t => t.type === 'number')).toBe(true);          // every id is a real Number
  expect(out.find(t => t.id === 42).categoryId).toBeNull();        // unsafe categoryId → null
  expect(out.find(t => t.id === 7).categoryId).toBe('c_123_456');  // safe categoryId preserved
  expect(out.some(t => String(t.categoryId).includes('<'))).toBe(false);
});
