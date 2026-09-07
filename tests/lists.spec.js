// Flat task queue with category labels + up to five separate lists (issue #2).
const { test, expect } = require('@playwright/test');
const { open, seedTasks } = require('./helpers');

async function seedCats(page) {
  return page.evaluate(() => {
    categories.push({ id: 'c_a', name: 'Alpha', color: '#6e8062', order: 0 },
                     { id: 'c_b', name: 'Beta',  color: '#c0922f', order: 1 });
    return ['c_a', 'c_b'];
  });
}

test.beforeEach(async ({ page }) => { await open(page); });

// ── Part 1: flat queue with labels ──

test('List view is one flat queue in tasks[] order with a category chip per card', async ({ page }) => {
  await seedCats(page);
  await seedTasks(page, [{ name: 'A1', categoryId: 'c_a' }, { name: 'B1', categoryId: 'c_b' }, { name: 'A2', categoryId: 'c_a' }, { name: 'U' }]);
  const res = await page.evaluate(() => ({
    names: [...document.querySelectorAll('#taskList .task-card .task-name')].map(e => e.textContent),
    catHeaders: document.querySelectorAll('#taskList .cat-header[data-cat-id="c_a"], #taskList .cat-header[data-cat-id="c_b"], #taskList .cat-header[data-cat-id="__uncat"]').length,
    chips: [...document.querySelectorAll('#taskList .tag-cat')].map(e => e.textContent),
  }));
  expect(res.names).toEqual(['A1', 'B1', 'A2', 'U']);   // interleaved — not regrouped
  expect(res.catHeaders).toBe(0);
  expect(res.chips).toEqual(['Alpha', 'Beta', 'Alpha', '+ category']);
});

test('reordering across a former category boundary keeps categoryId', async ({ page }) => {
  await seedCats(page);
  await seedTasks(page, [{ name: 'A1', categoryId: 'c_a' }, { name: 'B1', categoryId: 'c_b' }]);
  const res = await page.evaluate(() => {
    reorderTasks(tasks[1].id, tasks[0].id, false); // B1 above A1
    return { order: tasks.map(t => t.name), cats: tasks.map(t => t.categoryId) };
  });
  expect(res.order).toEqual(['B1', 'A1']);
  expect(res.cats).toEqual(['c_b', 'c_a']);
});

test('the chip select changes a task category and persists', async ({ page }) => {
  await seedCats(page);
  await seedTasks(page, [{ name: 'U' }]);
  const res = await page.evaluate(() => {
    commitCatChip(tasks[0].id, 'c_b');
    return { cat: tasks[0].categoryId, chip: document.querySelector('#taskList .tag-cat').textContent,
             stored: JSON.parse(localStorage.getItem('focustimer_tasks'))[0].categoryId };
  });
  expect(res).toEqual({ cat: 'c_b', chip: 'Beta', stored: 'c_b' });
  const cleared = await page.evaluate(() => { commitCatChip(tasks[0].id, 'nope'); return tasks[0].categoryId; });
  expect(cleared).toBeNull(); // unknown id → uncategorized, never a dangling reference
});

test('Not today and Completed sections still render as collapsible groups', async ({ page }) => {
  await seedTasks(page, [{ name: 'D' }, { name: 'H' }]);
  const res = await page.evaluate(() => {
    tasks[0].done = true; tasks[1].notTodayDayKey = todayKey(); renderTasks();
    return { done: !!document.querySelector('#taskList .done-group'), hidden: !!document.querySelector('#taskList .not-today-group') };
  });
  expect(res).toEqual({ done: true, hidden: true });
});

// ── Part 2: lists ──

test('fresh install migrates to a single "My tasks" list and shows it in the picker', async ({ page }) => {
  const res = await page.evaluate(() => ({
    name: activeList.name, parked: lists.length,
    picker: document.querySelector('#listPicker option:checked').textContent,
    stored: JSON.parse(localStorage.getItem('focustimer_activelist') || 'null'),
  }));
  expect(res.name).toBe('My tasks');
  expect(res.parked).toBe(0);
  expect(res.picker).toMatch(/^My tasks · saved \d/);
  expect(res.stored && res.stored.name).toBe('My tasks');
});

test('create parks the current list; switching back restores tasks, categories and map layout', async ({ page }) => {
  await seedCats(page);
  await seedTasks(page, [{ name: 'A1', categoryId: 'c_a' }]);
  const afterCreate = await page.evaluate(() => {
    tasks[0].mapX = 0.31; saveAll();
    window.prompt = () => 'Home';
    createList();
    return { tasks: tasks.length, cats: categories.length, parked: lists.length, active: activeList.name,
             picker: document.querySelector('#listPicker option:checked').textContent,
             storedLists: JSON.parse(localStorage.getItem('focustimer_lists')).length };
  });
  expect(afterCreate).toMatchObject({ tasks: 0, cats: 0, parked: 1, active: 'Home', storedLists: 1 });
  expect(afterCreate.picker).toMatch(/^Home · saved/);
  const back = await page.evaluate(() => {
    switchList(lists[0].id);
    return { names: tasks.map(t => t.name), cats: categories.map(c => c.name), mapX: tasks[0].mapX,
             active: activeList.name, parkedNames: lists.map(l => l.name) };
  });
  expect(back).toEqual({ names: ['A1'], cats: ['Alpha', 'Beta'], mapX: 0.31, active: 'My tasks', parkedNames: ['Home'] });
});

test('list names must be unique (case-insensitive) and are capped at 40 chars', async ({ page }) => {
  const res = await page.evaluate(() => {
    window.prompt = () => 'my TASKS';
    createList();
    const dup = lists.length;
    window.prompt = () => 'x'.repeat(60);
    createList();
    return { dup, len: activeList.name.length };
  });
  expect(res).toEqual({ dup: 0, len: 40 });
});

test('the picker offers New only below five lists and Delete only with more than one', async ({ page }) => {
  const one = await page.evaluate(() => [...document.querySelectorAll('#listPicker option')].map(o => o.value));
  expect(one).toContain('__new');
  expect(one).not.toContain('__delete');
  const five = await page.evaluate(() => {
    let i = 0; window.prompt = () => 'L' + (++i);
    createList(); createList(); createList(); createList();
    const values = [...document.querySelectorAll('#listPicker option')].map(o => o.value);
    createList(); // 6th → refused
    return { values, total: lists.length + 1, note: document.getElementById('noteToast').classList.contains('open') };
  });
  expect(five.values).not.toContain('__new');
  expect(five.values).toContain('__delete');
  expect(five.total).toBe(5);
  expect(five.note).toBe(true);
});

test('switching is refused while the timer runs', async ({ page }) => {
  const res = await page.evaluate(() => {
    window.prompt = () => 'Home';
    createList();
    running = true;
    switchList(lists[0].id);
    const refused = activeList.name;
    running = false;
    switchList(lists[0].id);
    return { refused, after: activeList.name, note: document.getElementById('noteMsg').textContent };
  });
  expect(res.refused).toBe('Home');
  expect(res.after).toBe('My tasks');
  expect(res.note).toMatch(/Pause the timer/);
});

test('delete asks, switches to the newest parked list, and Undo brings the list back', async ({ page }) => {
  await seedTasks(page, [{ name: 'A1' }]);
  const res = await page.evaluate(() => {
    window.prompt = () => 'Home'; createList();
    window.confirm = () => false; deleteList();
    const kept = activeList.name;
    window.confirm = () => true; deleteList();
    const afterDelete = { active: activeList.name, parked: lists.length, names: tasks.map(t => t.name) };
    runUndo();
    return { kept, afterDelete, restored: lists.map(l => l.name), stillActive: activeList.name };
  });
  expect(res.kept).toBe('Home');
  expect(res.afterDelete).toEqual({ active: 'My tasks', parked: 0, names: ['A1'] });
  expect(res.restored).toEqual(['Home']);
  expect(res.stillActive).toBe('My tasks');
});

test('sync payload carries lists + activeList and a remote payload restores them', async ({ page }) => {
  const res = await page.evaluate(() => {
    window.prompt = () => 'Home'; createList();
    const keys = Object.keys({ tasks, history, categories, routines, lists, activeList }); // mirrors pushToCloud
    const remote = { tasks: [], history: [], categories: [], routines: [], stats: {},
      lists: [{ id: 'l_remote', name: 'Remote', savedAt: 5, tasks: [], categories: [], routines: [], history: [], stats: {} }],
      activeList: { id: 'l_act', name: 'Active', savedAt: 6 }, dataTimestamp: Date.now() + 10000, lastClearedAt };
    applyRemote(remote);
    return { keys, active: activeList.name, parked: lists.map(l => l.name) };
  });
  expect(res.keys).toEqual(expect.arrayContaining(['lists', 'activeList']));
  expect(res.active).toBe('Active');
  expect(res.parked).toEqual(['Remote']);
});

test('sanitizeLists drops bad ids, duplicates, the active id and anything past the cap', async ({ page }) => {
  const res = await page.evaluate(() => {
    const mk = (id, name) => ({ id, name, savedAt: 1, tasks: [{ id: 1, name: 't', mins: 25, categoryId: 'ghost' }], categories: [], routines: [], history: [], stats: {} });
    const out = sanitizeLists([mk('l1', 'One'), mk('l1', 'Dup'), mk('bad id!', 'Bad'), mk('act', 'Active'),
                               mk('l2', 'Two'), mk('l3', 'Three'), mk('l4', 'Four'), mk('l5', 'Five')], 'act');
    return { ids: out.map(l => l.id), ghostCleared: out[0].tasks[0].categoryId, fallback: sanitizeActiveList(null).name,
             badActive: sanitizeActiveList({ id: 'x y', name: 'n' }).name };
  });
  expect(res.ids).toEqual(['l1', 'l2', 'l3', 'l4']);
  expect(res.ghostCleared).toBeNull();
  expect(res.fallback).toBe('My tasks');
  expect(res.badActive).toBe('My tasks');
});

test('the list picker stays visible in Map and full-map modes', async ({ page }) => {
  await seedTasks(page, [{ name: 'A1' }]);
  await page.evaluate(() => { setViewMode('map'); });
  await expect(page.locator('#listPicker')).toBeVisible();
  await page.evaluate(() => { toggleFullMap(); });
  await expect(page.locator('#listPicker')).toBeVisible();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); // coarse pointer → 44px touch-target rules apply
  test('the list picker hit target is at least 44px tall on a phone', async ({ page }) => {
    await open(page);
    const h = await page.evaluate(() => document.getElementById('listPicker').getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
  });
});
