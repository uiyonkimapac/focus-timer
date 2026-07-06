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

test('tapping a peak opens the time popover; the +5 stepper changes mins and persists', async ({ page }) => {
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
    const valBefore = pop ? pop.querySelector('.map-pop-val').textContent : null;
    const stepUp = pop ? [...pop.querySelectorAll('.map-pop-step')].find(b => b.textContent.includes('+5')) : null;
    if (stepUp) { stepUp.click(); stepUp.click(); }   // 25 → 35
    return { open: !!pop, valBefore, mins: tasks[0].mins, secs: tasks[0].secsRemaining, role: pop && pop.getAttribute('role') };
  });
  expect(res.open).toBe(true);
  expect(res.role).toBe('dialog');
  expect(res.valBefore).toBe('25m');    // current value shown on open
  expect(res.mins).toBe(35);            // two +5 steps changed the estimate
  expect(res.secs).toBe(35 * 60);       // remaining clock reset to the new allotment
  await page.reload();
  const persisted = await page.evaluate(() => (tasks.find(t => t.name === 'Estimate me') || {}).mins);
  expect(persisted).toBe(35);           // survived a reload (saveAll persisted it)
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
    return { mins: tasks[0].mins, secs: tasks[0].secsRemaining, val: pop.querySelector('.map-pop-val').textContent };
  });
  expect(res.mins).toBe(15);            // stops at spent-rounded-up, never lower
  expect(res.secs).toBe(15 * 60);
  expect(res.val).toBe('15m');          // stepper display reflects the clamp
});

test('map time popover renames the task inline (Enter commits, Esc cancels, persists)', async ({ page }) => {
  await seedTasks(page, [{ name: 'Old name', mins: 25 }]);
  await page.evaluate(() => {
    setViewMode('map');
    openMapTimePopover(tasks[0].id);
    mapPopEditName();
  });
  // The name row swapped to an input, prefilled and focused.
  const input = page.locator('.map-time-pop .map-pop-name-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Old name');
  // Esc cancels: name row returns, task untouched.
  await input.press('Escape');
  let r = await page.evaluate(() => ({
    name: tasks[0].name,
    rowText: document.querySelector('.map-time-pop .map-pop-name').textContent,
  }));
  expect(r.name).toBe('Old name');
  expect(r.rowText).toBe('Old name');
  // Edit again, type a new name, Enter commits everywhere (popover, peak label, storage).
  await page.evaluate(() => mapPopEditName());
  await input.fill('Summit route');
  await input.press('Enter');
  r = await page.evaluate(() => ({
    name: tasks[0].name,
    rowText: document.querySelector('.map-time-pop .map-pop-name').textContent,
    peakLabel: document.querySelector('#mapSvg .map-peak-label').textContent,
    popOpen: mapTimePop !== null,
  }));
  expect(r.name).toBe('Summit route');
  expect(r.rowText).toBe('Summit route');
  expect(r.peakLabel).toBe('Summit route');
  expect(r.popOpen).toBe(true);         // renaming keeps the popover open
  await page.reload();
  const persisted = await page.evaluate(() => (tasks[0] || {}).name);
  expect(persisted).toBe('Summit route'); // saveAll persisted the rename
});

test('map popover rename is never lost on teardown and never writes stale refs (redteam)', async ({ page }) => {
  await seedTasks(page, [{ name: 'Original', mins: 25 }]);
  await page.evaluate(() => {
    setViewMode('map');
    openMapTimePopover(tasks[0].id);
    mapPopEditName();
  });
  const input = page.locator('.map-time-pop .map-pop-name-input');
  // Same 100-char cap as every other task-name input.
  await expect(input).toHaveAttribute('maxlength', '100');
  // Teardown mid-edit (what an outside tap does): the typed text must COMMIT,
  // not vanish — browsers don't reliably blur elements removed from the DOM.
  await input.fill('Typed then tapped away');
  let r = await page.evaluate(() => {
    closeMapTimePopover();
    return { name: tasks[0].name, popGone: !document.querySelector('.map-time-pop') };
  });
  expect(r.name).toBe('Typed then tapped away');
  expect(r.popGone).toBe(true);
  // Sync-swap race: a realtime push replaces the tasks array mid-edit. The
  // commit must land on the CURRENT object (found by id), not the stale ref.
  await page.evaluate(() => {
    openMapTimePopover(tasks[0].id);
    mapPopEditName();
  });
  await input.fill('Post-sync name');
  r = await page.evaluate(() => {
    const id = tasks[0].id;
    tasks = tasks.map(t => ({ ...t }));    // simulate applyRemote swapping objects
    document.querySelector('.map-pop-name-input').blur();
    return { name: tasks.find(t => t.id === id).name };
  });
  expect(r.name).toBe('Post-sync name');
  // And if the task was completed remotely mid-edit, the rename is dropped
  // (no zombie edits to finished work) without throwing.
  await page.evaluate(() => { tasks[0].done = false; renderTasks(); openMapTimePopover(tasks[0].id); mapPopEditName(); });
  await input.fill('Should not apply');
  r = await page.evaluate(() => {
    tasks[0].done = true;
    document.querySelector('.map-pop-name-input').blur();
    return { name: tasks[0].name };
  });
  expect(r.name).toBe('Post-sync name');
});

test('Manage categories can delete stale/empty categories the list view cannot reach', async ({ page }) => {
  await page.evaluate(() => {
    categories.push(
      { id: 'c_used',  name: 'Used',  color: '#5aa9e6', order: 0, collapsed: false },
      { id: 'c_stale', name: 'Stale', color: '#e65a5a', order: 1, collapsed: false },
    );
    renderTasks();
  });
  await seedTasks(page, [{ name: 'Belongs somewhere', categoryId: 'c_used' }]);
  // The picker gained the manage verb; choosing it opens the modal and resets
  // the picker (it must never stay stuck on a non-category value).
  const r1 = await page.evaluate(() => {
    const picker = document.getElementById('taskCategory');
    const hasOpt = [...picker.options].some(o => o.value === '__manage');
    picker.value = '__manage';
    onCategoryPickerChange();
    return {
      hasOpt,
      open: document.getElementById('manageCatsModal').classList.contains('open'),
      pickerValue: picker.value,
      rows: [...document.querySelectorAll('.managecat-row')].map(r => ({
        name: r.querySelector('.managecat-name').textContent,
        count: r.querySelector('.managecat-count').textContent,
      })),
    };
  });
  expect(r1.hasOpt).toBe(true);
  expect(r1.open).toBe(true);
  expect(r1.pickerValue).toBe('');
  expect(r1.rows).toEqual([
    { name: 'Used', count: '1 task' },
    { name: 'Stale', count: 'empty' },   // reachable here even with no visible tasks
  ]);
  // Delete the empty one: confirm is asked, the row disappears, the modal stays
  // open (cleanup is usually several deletes), and the picker updates.
  page.on('dialog', d => d.accept());
  await page.locator('.managecat-row', { hasText: 'Stale' }).locator('.managecat-btn.del').click();
  const r2 = await page.evaluate(() => ({
    catIds: categories.map(c => c.id),
    stillOpen: document.getElementById('manageCatsModal').classList.contains('open'),
    rowCount: document.querySelectorAll('.managecat-row').length,
    pickerHasStale: [...document.getElementById('taskCategory').options].some(o => o.textContent === 'Stale'),
  }));
  expect(r2.catIds).toEqual(['c_used']);
  expect(r2.stillOpen).toBe(true);
  expect(r2.rowCount).toBe(1);
  expect(r2.pickerHasStale).toBe(false);
  // Deleting a category WITH tasks re-parents them to Uncategorized — never lost.
  await page.locator('.managecat-row', { hasText: 'Used' }).locator('.managecat-btn.del').click();
  const r3 = await page.evaluate(() => ({
    cats: categories.length,
    taskCat: tasks[0].categoryId,
    taskAlive: !tasks[0].done && tasks[0].name === 'Belongs somewhere',
  }));
  expect(r3.cats).toBe(0);
  expect(r3.taskCat).toBeNull();
  expect(r3.taskAlive).toBe(true);
});

test('sync: foreground return and network-online trigger catch-up pulls (throttled)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    let pulls = 0;
    pullFromCloud = async () => { pulls++; return true; };   // stub the network
    subscribeRealtime = () => {};                            // don't open a real socket
    syncCode = 'FT-TEST-42';
    lastPullMs = 0;
    // Returning to the foreground pulls (realtime may have died while hidden)…
    document.dispatchEvent(new Event('visibilitychange'));
    const afterResume = pulls;
    // …but a second resume within the 5s throttle window does NOT re-pull…
    document.dispatchEvent(new Event('visibilitychange'));
    const afterQuickResume = pulls;
    // …while coming back online is forced — the socket is certainly dead.
    window.dispatchEvent(new Event('online'));
    const afterOnline = pulls;
    // With sync off, none of these should touch the network.
    syncCode = null; lastPullMs = 0;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    return { afterResume, afterQuickResume, afterOnline, afterOff: pulls - afterOnline };
  });
  expect(r.afterResume).toBe(1);
  expect(r.afterQuickResume).toBe(1); // throttled
  expect(r.afterOnline).toBe(2);      // forced
  expect(r.afterOff).toBe(0);         // sync disconnected → silent
});

test('a hostile name entered via the popover stays inert in every sink (XSS)', async ({ page }) => {
  const payload = '<img src=x onerror="window.__pwned=1">"><svg onload=window.__pwned=1>';
  await seedTasks(page, [{ name: 'Innocent', mins: 25 }]);
  await page.evaluate(() => {
    setViewMode('map');
    openMapTimePopover(tasks[0].id);
    mapPopEditName();
  });
  const input = page.locator('.map-time-pop .map-pop-name-input');
  await input.fill(payload);
  await input.press('Enter');
  const r = await page.evaluate(() => ({
    pwned: window.__pwned || null,
    // The popover legitimately contains icon SVGs (pencil, moon) — only markup
    // born from the NAME would be an injection: any <img>, or a rogue element
    // inside the name row / the SVG peak label.
    injected: !!document.querySelector('img[src="x"], .map-pop-name *, #mapSvg .map-peak-label *'),
    stored: tasks[0].name,
    popName: document.querySelector('.map-pop-name').textContent,
    listSafe: (setViewMode('list'), !document.querySelector('#taskList img[src="x"]') && !window.__pwned),
  }));
  expect(r.pwned).toBeNull();          // no handler ever executed
  expect(r.injected).toBe(false);      // rendered as text, not markup
  expect(r.stored.startsWith('<img')).toBe(true); // stored raw (data, not HTML)
  expect(r.popName.includes('<img')).toBe(true);  // shown escaped in the popover
  expect(r.listSafe).toBe(true);       // list view renders it inert too
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
