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

test('clicking empty map space deselects the active task', async ({ page }) => {
  await seedTasks(page, [{ name: 'Alpha' }, { name: 'Beta' }]);
  const result = await page.evaluate(() => {
    setViewMode('map');
    selectTask(tasks[0].id);            // pick a peak → it becomes the active task
    const before = activeId;
    // Synthesize an empty-space click on the map background (target = svg root,
    // so it's classified as a marquee/pan no-move click, never a peak).
    const svg = document.getElementById('mapSvg');
    const r = svg.getBoundingClientRect();
    const opts = { clientX: r.left + 4, clientY: r.top + 4, pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' };
    svg.dispatchEvent(new PointerEvent('pointerdown', opts));
    svg.dispatchEvent(new PointerEvent('pointerup', opts));
    return { before, after: activeId };
  });
  expect(result.before).not.toBeNull();   // a task was selected
  expect(result.after).toBeNull();        // empty click cleared it
});

test('a running timer is NOT deselected by an empty map click', async ({ page }) => {
  await seedTasks(page, [{ name: 'Alpha' }]);
  const result = await page.evaluate(() => {
    setViewMode('map');
    selectTask(tasks[0].id);
    startTimer();                         // now running on the active task
    const svg = document.getElementById('mapSvg');
    const r = svg.getBoundingClientRect();
    const opts = { clientX: r.left + 4, clientY: r.top + 4, pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' };
    svg.dispatchEvent(new PointerEvent('pointerdown', opts));
    svg.dispatchEvent(new PointerEvent('pointerup', opts));
    const out = { active: activeId, running };
    if (running) { clearInterval(ticker); running = false; }  // don't leak a ticker
    return out;
  });
  expect(result.running).toBe(true);
  expect(result.active).not.toBeNull();   // the live task stayed selected
});

test('Ctrl+drag ADDS boxed peaks to the selection instead of replacing it', async ({ page }) => {
  await seedTasks(page, [{ name: 'TopLeft' }, { name: 'BottomRight' }]);
  const res = await page.evaluate(() => {
    setViewMode('map');
    tasks[0].mapX = 0.10; tasks[0].mapY = 0.12;   // A — outside the box we'll draw
    tasks[1].mapX = 0.85; tasks[1].mapY = 0.80;   // B — inside it
    mapSelection = new Set([tasks[0].id]);          // A is already gathered
    renderMap();
    const svg = document.getElementById('mapSvg');
    const r = svg.getBoundingClientRect();
    const base = { pointerId: 1, button: 0, ctrlKey: true, bubbles: true, pointerType: 'mouse' };
    const from = Object.assign({ clientX: r.left + r.width * 0.40, clientY: r.top + r.height * 0.05 }, base);
    const to   = Object.assign({ clientX: r.left + r.width * 0.99, clientY: r.top + r.height * 0.95 }, base);
    svg.dispatchEvent(new PointerEvent('pointerdown', from));
    svg.dispatchEvent(new PointerEvent('pointermove', to));
    svg.dispatchEvent(new PointerEvent('pointerup', to));
    return { ids: [...mapSelection], a: tasks[0].id, b: tasks[1].id };
  });
  expect(res.ids).toContain(res.a);   // pre-gathered peak survived (additive, not replace)
  expect(res.ids).toContain(res.b);   // boxed peak was added
});

test('category headers no longer expose a delete control', async ({ page }) => {
  const html = await page.evaluate(() =>
    renderCategoryHeader('cat-x', 'Kagoshima', '#c66a52', [], false, false));
  expect(html).toContain('renameCategory');   // rename still available
  expect(html).not.toContain('deleteCategory'); // delete control removed
  expect(html).not.toContain('Delete group');
});

test('REMAINING stat keeps the minutes unit past an hour (6h36m, not 6h36)', async ({ page }) => {
  await seedTasks(page, [{ name: 'Big', mins: 396 }]);   // 6h 36m of remaining work
  const overHour = await page.evaluate(() => { updateStats(); return document.getElementById('statRemaining').textContent; });
  expect(overHour).toBe('6h36m');                         // both units present
  await page.evaluate(() => { tasks[0].secsRemaining = 45 * 60; });
  const underHour = await page.evaluate(() => { updateStats(); return document.getElementById('statRemaining').textContent; });
  expect(underHour).toBe('45m');                          // sub-hour unchanged
});

test('Map peak names are visible at rest (not hidden until hover)', async ({ page }) => {
  // Regression: the "labels on demand" redesign set idle peak labels to
  // opacity:0, so on desktop the board showed unlabeled mountains — names only
  // appeared on hover. The map is the at-a-glance planning aid, so idle labels
  // must stay readable. Pick a peak with no active/MIT/selected class so the
  // brighten-to-full rules can't mask the regression.
  await seedTasks(page, [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }]);
  const idleOpacity = await page.evaluate(() => {
    setViewMode('map');
    const peaks = [...document.querySelectorAll('#mapSvg .map-peak')];
    const idle = peaks.find(p =>
      !p.classList.contains('active') &&
      !p.classList.contains('is-mit') &&
      !p.classList.contains('selected'));
    const label = idle && idle.querySelector('.map-peak-label');
    return label ? Number(getComputedStyle(label).opacity) : null;
  });
  expect(idleOpacity).not.toBeNull();
  expect(idleOpacity).toBeGreaterThan(0.1);   // was 0 (invisible) before the fix
});

test('mobile map view hides the add-task row so the map fills the screen', async ({ page }) => {
  // Regression: the map-fullscreen rules (hide add-row/tabs/title) were scoped
  // to landscape-short only, so portrait phones buried the map below the
  // add-task form. They must apply at the portrait phone breakpoint too.
  await page.setViewportSize({ width: 390, height: 844 });
  await seedTasks(page, [{ name: 'A' }]);
  const res = await page.evaluate(() => {
    const addRow = document.querySelector('.add-row');
    setViewMode('list'); openAddRow();                  // composer is collapsed by default on mobile
    const inList = getComputedStyle(addRow).display;
    setViewMode('map');  const inMap  = getComputedStyle(addRow).display;
    setViewMode('list');
    return { inList, inMap };
  });
  expect(res.inList).not.toBe('none');  // composer visible once opened in list view
  expect(res.inMap).toBe('none');       // hidden in map view — map gets the screen
});

test('mobile collapses the add-task form behind a launcher', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedTasks(page, [{ name: 'A' }]);
  const res = await page.evaluate(() => {
    document.body.classList.remove('add-open');
    const addRow = document.querySelector('.add-row');
    const toggle = document.querySelector('.add-toggle');
    const collapsed = { row: getComputedStyle(addRow).display, toggle: getComputedStyle(toggle).display };
    openAddRow();
    const opened = { row: getComputedStyle(addRow).display, toggle: getComputedStyle(toggle).display,
                     focused: document.activeElement === document.getElementById('taskInp') };
    return { collapsed, opened };
  });
  expect(res.collapsed.row).toBe('none');      // form hidden by default
  expect(res.collapsed.toggle).not.toBe('none'); // launcher shown
  expect(res.opened.row).not.toBe('none');     // tapping reveals the form
  expect(res.opened.toggle).toBe('none');      // launcher hides
  expect(res.opened.focused).toBe(true);       // and focuses the input
});

test('Reset Data moves off the top row on mobile, stays top-right on desktop', async ({ page }) => {
  await seedTasks(page, [{ name: 'A' }]);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    top: getComputedStyle(document.querySelector('.btn-reset-data')).display,
    bottom: getComputedStyle(document.querySelector('.mobile-reset')).display,
  }));
  await page.setViewportSize({ width: 1280, height: 800 });
  const desktop = await page.evaluate(() => ({
    top: getComputedStyle(document.querySelector('.btn-reset-data')).display,
    bottom: getComputedStyle(document.querySelector('.mobile-reset')).display,
  }));
  expect(mobile.top).toBe('none');        // top Reset Data hidden on mobile
  expect(mobile.bottom).not.toBe('none'); // recessive bottom reset shown
  expect(desktop.top).not.toBe('none');   // desktop keeps the top-right button
  expect(desktop.bottom).toBe('none');    // and no bottom one
});

test('Run rows are non-selectable (no text-selection box on touch drag)', async ({ page }) => {
  await seedTasks(page, [{ name: 'A' }, { name: 'B' }]);
  const us = await page.evaluate(() => {
    openRunSetup();
    const s = getComputedStyle(document.querySelector('#runTaskList .run-row'));
    const val = s.userSelect || s.webkitUserSelect;
    closeRunSetup();
    return val;
  });
  expect(us).toBe('none');   // dragging the grip reorders instead of selecting text
});

test('a category can be deleted from its edit popup (tasks move to Uncategorized)', async ({ page }) => {
  await page.evaluate(() => { categories.push({ id: 'cz', name: 'Zone', color: '#c66a52' }); });
  await seedTasks(page, [{ name: 'T1', categoryId: 'cz' }]);
  const res = await page.evaluate(() => {
    openCategoryModal();                 // NEW category — no delete control
    const onCreate = getComputedStyle(document.getElementById('catModalDelete')).display;
    closeCategoryModal();
    openCategoryModal('cz');             // EDIT existing — delete offered
    const onEdit = getComputedStyle(document.getElementById('catModalDelete')).display;
    window.confirm = () => true;         // accept the delete confirmation
    deleteCategoryFromModal();
    return {
      onCreate, onEdit,
      catGone: !categories.find(c => c.id === 'cz'),
      taskReparented: tasks[0].categoryId === null,
      modalClosed: !document.getElementById('categoryModal').classList.contains('open'),
    };
  });
  expect(res.onCreate).toBe('none');     // create has no delete
  expect(res.onEdit).not.toBe('none');   // edit offers delete
  expect(res.catGone).toBe(true);        // category removed
  expect(res.taskReparented).toBe(true); // its task moved to Uncategorized
  expect(res.modalClosed).toBe(true);    // modal closed after delete
});

test('Full map mode hides the chrome above the board to maximize the map', async ({ page }) => {
  await seedTasks(page, [{ name: 'A' }]);
  const res = await page.evaluate(() => {
    setViewMode('map');
    fullMap = true; renderTasks();
    const disp = sel => getComputedStyle(document.querySelector(sel)).display;
    const out = { meta: disp('.panel-meta'), tabs: disp('.tab-nav'),
                  addRow: disp('.add-row'), toolbar: disp('.view-seg') };
    fullMap = false; setViewMode('list'); renderTasks();
    return out;
  });
  expect(res.meta).toBe('none');        // date header hidden
  expect(res.tabs).toBe('none');        // Tasks/Completed + Reset/Save hidden
  expect(res.addRow).toBe('none');      // add-row hidden
  expect(res.toolbar).not.toBe('none'); // view toolbar stays (toggle back out)
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

test('tapping a peak opens the time popover; a chip changes mins and persists', async ({ page }) => {
  await seedTasks(page, [{ name: 'Estimate me', mins: 25 }]);
  const res = await page.evaluate(() => {
    setViewMode('map');
    const g = document.querySelector('#mapSvg .map-peak');
    const r = g.getBoundingClientRect();
    // Clean tap: pointerdown + pointerup at the same spot (no movement = not a drag).
    const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' };
    g.dispatchEvent(new PointerEvent('pointerdown', o));
    g.dispatchEvent(new PointerEvent('pointerup', o));
    const pop = document.querySelector('.map-time-pop');
    const selBefore = pop && pop.querySelector('.map-pop-chip.sel') ? pop.querySelector('.map-pop-chip.sel').textContent : null;
    const chipCount = pop ? pop.querySelectorAll('.map-pop-chip').length : 0;
    const chip45 = pop ? [...pop.querySelectorAll('.map-pop-chip')].find(c => c.textContent === '45m') : null;
    if (chip45) chip45.click();
    return { open: !!pop, chipCount, selBefore, mins: tasks[0].mins, secs: tasks[0].secsRemaining, role: pop && pop.getAttribute('role') };
  });
  expect(res.open).toBe(true);
  expect(res.role).toBe('dialog');
  expect(res.chipCount).toBe(11);       // same preset list as the #taskTime dropdown
  expect(res.selBefore).toBe('25m');    // current value highlighted on open
  expect(res.mins).toBe(45);            // chip changed the estimate
  expect(res.secs).toBe(45 * 60);       // remaining clock reset to the new allotment
  await page.reload();
  const persisted = await page.evaluate(() => (tasks.find(t => t.name === 'Estimate me') || {}).mins);
  expect(persisted).toBe(45);           // survived a reload (saveAll persisted it)
});

test('the map time popover clamps to time already spent and never below 5m', async ({ page }) => {
  await seedTasks(page, [{ name: 'Half done', mins: 30 }]);
  const res = await page.evaluate(() => {
    tasks[0].secsSpent = 12 * 60;       // 12m spent → floor rounds UP to the next 5m = 15m
    setViewMode('map');
    const g = document.querySelector('#mapSvg .map-peak');
    const r = g.getBoundingClientRect();
    const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' };
    g.dispatchEvent(new PointerEvent('pointerdown', o));
    g.dispatchEvent(new PointerEvent('pointerup', o));
    for (let i = 0; i < 10; i++) mapPopStep(-5); // step down hard — must stop at the clamp
    const pop = document.querySelector('.map-time-pop');
    const chip10 = [...pop.querySelectorAll('.map-pop-chip')].find(c => c.textContent === '10m');
    return { mins: tasks[0].mins, secs: tasks[0].secsRemaining, chip10Disabled: chip10.disabled };
  });
  expect(res.mins).toBe(15);            // stops at spent-rounded-up, never lower
  expect(res.secs).toBe(15 * 60);
  expect(res.chip10Disabled).toBe(true); // sub-floor presets are disabled, not tappable
});

test('map time popover "Not today" pushes the peak to tomorrow (survives reload)', async ({ page }) => {
  await seedTasks(page, [{ name: 'Deep work' }, { name: 'Stays' }]);
  const before = await page.evaluate(() => {
    setViewMode('map');
    const id = tasks[0].id;
    openMapTimePopover(id);
    const hasAction = !!document.querySelector('.map-pop-action'); // the new action row exists
    mapPopNotToday();                                              // reuse the list-side rule
    return {
      hasAction,
      popClosed: mapTimePop === null,           // popover dismissed on action
      hidden: isHiddenToday(tasks[0]),          // task snoozed for today
      streak: tasks[0].notTodayStreak,          // streak seeded to 1
      peakIds: [...document.querySelectorAll('#mapSvg .map-peak')].map(el => Number(el.getAttribute('data-task-id'))),
      id, keepId: tasks[1].id,
    };
  });
  expect(before.hasAction).toBe(true);
  expect(before.popClosed).toBe(true);
  expect(before.hidden).toBe(true);
  expect(before.streak).toBe(1);
  expect(before.peakIds).not.toContain(before.id);   // peak left the board
  expect(before.peakIds).toContain(before.keepId);   // the other peak stayed

  // It shows up in the List View's "Not today" section.
  const listHasSection = await page.evaluate(() => {
    setViewMode('list'); notTodayCollapsed = false; renderTasks();
    return !!document.querySelector('.not-today-group');
  });
  expect(listHasSection).toBe(true);

  // toggleNotToday persisted via saveAll → the snooze survives a reload.
  await page.reload();
  const after = await page.evaluate(() => ({ hidden: isHiddenToday(tasks[0]), streak: tasks[0].notTodayStreak }));
  expect(after.hidden).toBe(true);
  expect(after.streak).toBe(1);
});

test('dragging a peak into the fog bank pushes it to tomorrow and bumps the streak', async ({ page }) => {
  await seedTasks(page, [{ name: 'Focus' }, { name: 'Keep' }]);
  const res = await page.evaluate(() => {
    setViewMode('map');
    // Simulate a task already snoozed the last two days so this drop earns FACE IT!.
    tasks[0].notTodayStreak = 2;
    tasks[0].lastHiddenDayKey = yesterdayKey();
    const id = tasks[0].id;
    const svg = document.getElementById('mapSvg');
    const g = document.querySelector(`#mapSvg .map-peak[data-task-id="${id}"]`);
    const pr = g.getBoundingClientRect();
    const base = { pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' };
    const start = Object.assign({ clientX: pr.left + pr.width / 2, clientY: pr.top + pr.height / 2 }, base);
    g.dispatchEvent(new PointerEvent('pointerdown', start));
    // First move exceeds the drag threshold → reveals + positions the drop zones.
    svg.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, base, { clientX: start.clientX + 40, clientY: start.clientY + 40 })));
    // Aim the drop at the centre of the now-positioned fog bank.
    const fz = document.getElementById('mapNotToday').getBoundingClientRect();
    const drop = Object.assign({ clientX: fz.left + fz.width / 2, clientY: fz.top + fz.height / 2 }, base);
    svg.dispatchEvent(new PointerEvent('pointermove', drop));
    svg.dispatchEvent(new PointerEvent('pointerup', drop));
    return {
      hidden: isHiddenToday(tasks[0]),
      streak: tasks[0].notTodayStreak,           // 2 → 3 (consecutive day)
      peakIds: [...document.querySelectorAll('#mapSvg .map-peak')].map(el => Number(el.getAttribute('data-task-id'))),
      id, keepId: tasks[1].id,
    };
  });
  expect(res.hidden).toBe(true);
  expect(res.streak).toBe(3);                 // streak incremented across a consecutive day
  expect(res.peakIds).not.toContain(res.id);  // dragged peak left the board
  expect(res.peakIds).toContain(res.keepId);
});
