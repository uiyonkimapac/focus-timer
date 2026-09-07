// Flat task queue with category labels + up to five separate lists (issue #2).
const { test, expect } = require('@playwright/test');
const { open, seedTasks } = require('./helpers');

async function seedCats(page) {
  await page.evaluate(() => {
    categories.push({ id: 'c_a', name: 'Alpha', color: '#6e8062', order: 0 },
                     { id: 'c_b', name: 'Beta',  color: '#c0922f', order: 1 });
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
  expect(res.picker).toMatch(/^My tasks · saved /);
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
    const keys = /tasks, history, categories, routines, lists, activeList/.test(pushToCloud.toString()) ? ['lists', 'activeList'] : []; // the real payload literal
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
    return { ids: out.map(l => l.id), ghostCleared: out[0].tasks[0].categoryId, fallback: newActiveList().name,
             badActive: sanitizeActiveList({ id: 'x y', name: 'n' }), nullActive: sanitizeActiveList(null) };
  });
  expect(res.ids).toEqual(['l1', 'l2', 'l3', 'l4']);
  expect(res.ghostCleared).toBeNull();
  expect(res.fallback).toBe('My tasks');
  expect(res.badActive).toBeNull();   // callers fall back to the list they already hold
  expect(res.nullActive).toBeNull();
});

test('the list picker stays visible in Map and full-map modes', async ({ page }) => {
  await seedTasks(page, [{ name: 'A1' }]);
  await page.evaluate(() => { setViewMode('map'); });
  await expect(page.locator('#listPicker')).toBeVisible();
  await page.evaluate(() => { toggleFullMap(); });
  await expect(page.locator('#listPicker')).toBeVisible();
});


// ── Review-driven regression tests ──

test('upgrade wraps existing data as "My tasks" without moving anything and strips the old collapse flag', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('focustimer_tasks', JSON.stringify([{ id: 1, name: 'Old', mins: 25, secsRemaining: 1500, done: false, categoryId: 'c1', mapX: 0.4 }]));
    localStorage.setItem('focustimer_categories', JSON.stringify([{ id: 'c1', name: 'Legacy', color: '#6e8062', order: 0, collapsed: true }]));
    localStorage.removeItem('focustimer_activelist'); localStorage.removeItem('focustimer_lists');
  });
  await page.reload();
  const res = await page.evaluate(() => ({ n: tasks.map(t => t.name), mapX: tasks[0].mapX, cats: categories.map(c => c.name),
    collapsed: categories[0].collapsed, active: activeList.name, parked: lists.length }));
  expect(res).toEqual({ n: ['Old'], mapX: 0.4, cats: ['Legacy'], collapsed: undefined, active: 'My tasks', parked: 0 });
});

test('parked lists and the active list survive a reload', async ({ page }) => {
  await seedTasks(page, [{ name: 'A1' }]);
  await page.evaluate(() => { window.prompt = () => 'Home'; createList(); });
  await page.reload();
  const res = await page.evaluate(() => ({ active: activeList.name, parked: lists.map(l => l.name), parkedTasks: lists[0].tasks.map(t => t.name) }));
  expect(res).toEqual({ active: 'Home', parked: ['My tasks'], parkedTasks: ['A1'] });
});

test('a payload from a pre-lists build never wipes parked lists; with none parked it applies and re-pushes', async ({ page }) => {
  await seedTasks(page, [{ name: 'A1' }]);
  const res = await page.evaluate(() => {
    const legacy = (name) => ({ tasks: [{ id: 99, name, mins: 25, secsRemaining: 1500, done: false, categoryId: null }], history: [], categories: [], routines: [], stats: {}, dataTimestamp: Date.now() + 10000, lastClearedAt });
    applyRemote(legacy('FromOld'));                       // no parked lists → applied, identity kept
    const applied = { names: tasks.map(t => t.name), active: activeList.name };
    window.prompt = () => 'Home'; createList();           // now one parked list
    applyRemote(legacy('FromOld2'));                      // must be ignored
    return { applied, names: tasks.map(t => t.name), parked: lists.map(l => l.name), active: activeList.name };
  });
  expect(res.applied).toEqual({ names: ['FromOld'], active: 'My tasks' });
  expect(res).toMatchObject({ names: [], parked: ['My tasks'], active: 'Home' });
});

test('a fresh device pushing lists:[] with an unknown active id cannot wipe parked lists', async ({ page }) => {
  await seedTasks(page, [{ name: 'A1' }]);
  const res = await page.evaluate(() => {
    window.prompt = () => 'Home'; createList();
    tasks.push({ id: newId(), name: 'H1', mins: 25, secsRemaining: 1500, done: false, categoryId: null, sessions: 0, secsSpent: 0, source: 'manual', createdAt: Date.now(), notes: '', isMIT: false, notTodayDayKey: null, lastHiddenDayKey: null, notTodayStreak: 0 });
    applyRemote({ tasks: [], history: [], categories: [], routines: [], stats: {}, lists: [],
      activeList: { id: 'l_fresh', name: 'My tasks', savedAt: 5 }, dataTimestamp: Date.now() + 10000, lastClearedAt });
    return { active: activeList.id, parked: lists.map(l => l.name).sort(), homeKept: lists.some(l => l.name === 'Home' && l.tasks.some(t => t.name === 'H1')) };
  });
  expect(res.active).toBe('l_fresh');
  expect(res.parked).toEqual(['Home', 'My tasks']); // ours kept, the overwritten active list parked too
  expect(res.homeKept).toBe(true);
});

test('rename: case-only allowed, clash with a parked list refused, blank is a no-op, saved time kept', async ({ page }) => {
  const res = await page.evaluate(() => {
    window.prompt = () => 'Home'; createList();
    const before = activeList.savedAt;
    window.prompt = () => 'HOME'; renameList(); const caseOnly = activeList.name;
    window.prompt = () => 'my tasks'; renameList(); const clash = activeList.name;
    window.prompt = () => '   '; renameList();
    return { caseOnly, clash, blank: activeList.name, savedKept: activeList.savedAt === before,
             stored: JSON.parse(localStorage.getItem('focustimer_activelist')).name,
             picker: document.querySelector('#listPicker option:checked').textContent };
  });
  expect(res).toMatchObject({ caseOnly: 'HOME', clash: 'HOME', blank: 'HOME', savedKept: true, stored: 'HOME' });
  expect(res.picker).toMatch(/^HOME · saved /);
});

test('the picker itself creates a list and snaps back after a refused switch', async ({ page }) => {
  await page.evaluate(() => { window.prompt = () => 'Home'; });
  await page.selectOption('#listPicker', '__new');
  expect(await page.evaluate(() => activeList.name)).toBe('Home');
  await page.evaluate(() => { running = true; });
  const parkedId = await page.evaluate(() => lists[0].id);
  await page.selectOption('#listPicker', parkedId);
  await expect(page.locator('#listPicker')).toHaveValue(await page.evaluate(() => activeList.id));
  expect(await page.evaluate(() => activeList.name)).toBe('Home');
});

test('create and delete are also refused while busy, including when the Run screen is open', async ({ page }) => {
  const res = await page.evaluate(() => {
    window.prompt = () => 'Home'; createList();
    window.confirm = () => true;
    const orig = Sanctuary.isOpen; Sanctuary.isOpen = () => true;
    createList(); deleteList(); switchList(lists[0].id);
    Sanctuary.isOpen = orig;
    return { active: activeList.name, parked: lists.length };
  });
  expect(res).toEqual({ active: 'Home', parked: 1 });
});

test('Undo after delete respects the five-list cap instead of silently overflowing', async ({ page }) => {
  const res = await page.evaluate(() => {
    let i = 0; window.prompt = () => 'L' + (++i);
    createList(); createList(); createList(); createList();   // 5 lists
    window.confirm = () => true; deleteList();                // 4
    createList();                                             // 5 again
    runUndo();                                                // must refuse
    return { total: lists.length + 1, note: document.getElementById('noteMsg').textContent };
  });
  expect(res.total).toBe(5);
  expect(res.note).toMatch(/Up to 5 lists/);
});

test('Reset Data clears every list, not just the active one', async ({ page }) => {
  await seedTasks(page, [{ name: 'A1' }]);
  const res = await page.evaluate(() => {
    window.prompt = () => 'Home'; createList();
    window.confirm = () => true; resetAllData();
    return { parked: lists.length, active: activeList.name, tasks: tasks.length };
  });
  expect(res).toEqual({ parked: 0, active: 'My tasks', tasks: 0 });
});

test('idle saves do not bump savedAt or dataTimestamp; a list change does change the snapshot hash', async ({ page }) => {
  const res = await page.evaluate(() => {
    saveAll(); const a = [activeList.savedAt, dataTimestamp, snapshotHash()];
    saveAll(); saveAll(); const b = [activeList.savedAt, dataTimestamp, snapshotHash()];
    window.prompt = () => 'Home'; createList();
    return { same: a[0] === b[0] && a[1] === b[1] && a[2] === b[2], hashChanged: snapshotHash() !== a[2] };
  });
  expect(res).toEqual({ same: true, hashChanged: true });
});

test('a real HTML5 drop keeps the dragged task\'s category', async ({ page }) => {
  await seedCats(page);
  await seedTasks(page, [{ name: 'A1', categoryId: 'c_a' }, { name: 'B1', categoryId: 'c_b' }]);
  const res = await page.evaluate(() => {
    const [a, b] = tasks;
    const cardB = document.querySelector(`.task-card[data-task-id="${b.id}"]`);
    const cardA = document.querySelector(`.task-card[data-task-id="${a.id}"]`);
    cardB.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    const r = cardA.getBoundingClientRect();
    cardA.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: new DataTransfer(), clientY: r.top + 2 }));
    return { order: tasks.map(t => t.name), cats: tasks.map(t => t.categoryId) };
  });
  expect(res).toEqual({ order: ['B1', 'A1'], cats: ['c_b', 'c_a'] });
});

test('chip editing: opens with the current category selected, ignores done tasks, closes on Escape', async ({ page }) => {
  await seedCats(page);
  await seedTasks(page, [{ name: 'A1', categoryId: 'c_a' }, { name: 'D' }]);
  const res = await page.evaluate(() => {
    const [a, d] = tasks; d.done = true; renderTasks();
    openCatChip(a.id);
    const card = document.querySelector(`.task-card[data-task-id="${a.id}"]`);
    const opened = { editing: card.classList.contains('cat-editing'), value: document.getElementById('cc_' + a.id).value, isButton: card.querySelector('.tag-cat').tagName };
    closeCatChip(a.id);
    commitCatChip(d.id, 'c_b');
    return { opened, closed: !card.classList.contains('cat-editing'), doneCat: d.categoryId, doneHasSelect: !!document.getElementById('cc_' + d.id) };
  });
  expect(res.opened).toEqual({ editing: true, value: 'c_a', isButton: 'BUTTON' });
  expect(res).toMatchObject({ closed: true, doneCat: null, doneHasSelect: false });
});

test('list sanitizers reject picker-verb ids and absurd timestamps', async ({ page }) => {
  const res = await page.evaluate(() => {
    const mk = (id, savedAt) => ({ id, name: 'X', savedAt, tasks: [], categories: [], routines: [], history: [], stats: {} });
    const out = sanitizeLists([mk('__new', 1), mk('ok1', Infinity), mk('ok2', 1e300)], 'act');
    return { ids: out.map(l => l.id), finite: out.every(l => Number.isFinite(l.savedAt) && l.savedAt <= Date.now() + 1000),
             verbActive: sanitizeActiveList({ id: '__delete', name: 'n' }) };
  });
  expect(res.ids).toEqual(['ok1', 'ok2']);
  expect(res.finite).toBe(true);
  expect(res.verbActive).toBeNull();
});

test('switching to a list parked over midnight runs the daily rollovers', async ({ page }) => {
  await seedTasks(page, [{ name: 'Hid' }]);
  const res = await page.evaluate(() => {
    tasks[0].notTodayDayKey = yesterdayKey(); saveAll();
    window.prompt = () => 'Home'; createList();
    switchList(lists[0].id);
    return { hiddenKey: tasks[0].notTodayDayKey, visible: !isHiddenToday(tasks[0]) };
  });
  expect(res.hiddenKey).toBeNull();
  expect(res.visible).toBe(true);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); // coarse pointer → 44px touch-target rules apply
  test('the list picker hit target is at least 44px tall on a phone', async ({ page }) => {
    await open(page);
    const h = await page.evaluate(() => document.getElementById('listPicker').getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
  });
});
