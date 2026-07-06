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

test('expiry HOLDS in overtime by default — nothing completes until the user acts', async ({ page }) => {
  await seedTasks(page, [{ name: 'A', mins: 5 }, { name: 'B', mins: 5 }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), { gaps: ['none', 'none'], autoFlow: false });
    running = true; remaining = -90; // 1:30 past the estimate
    Sanctuary.onFinish('focus');    // what tick() fires at the zero-crossing
    const held = {
      done: tasks.filter(t => t.done).length,
      stillRunning: running,                 // onFinish must NOT pause the clock
      sub: document.getElementById('sxSub').textContent,
      time: document.getElementById('sxTime').textContent,
      cat: document.getElementById('sxCat').textContent,
    };
    Sanctuary.doneRun();                     // the user finishes on their terms
    return Object.assign(held, { doneAfter: tasks.filter(t => t.done).length,
                                 active: tasks.find(t => t.name === 'B').id === activeId });
  });
  expect(r.done).toBe(0);                    // expiry completed nothing
  expect(r.stillRunning).toBe(true);         // clock kept counting into the minus
  expect(r.sub).toBe('OVERTIME');
  expect(r.time).toBe('-01:30');             // minus time, as tracked
  expect(r.cat).toContain('OVERTIME');
  expect(r.doneAfter).toBe(1);               // ✓ completed A and moved to B
  expect(r.active).toBe(true);
});

test('autoFlow: ON restores expire-to-advance and logs each step to history', async ({ page }) => {
  await seedTasks(page, [{ name: 'A', mins: 5 }, { name: 'B', mins: 5 }, { name: 'C', mins: 5 }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), { gaps: ['none', 'none', 'none'], autoFlow: true });
    Sanctuary.onFinish('focus'); Sanctuary.onFinish('focus'); Sanctuary.onFinish('focus');
    return { done: tasks.filter(t => t.done).length, hist: history.length,
             title: document.getElementById('sxEndTitle').textContent };
  });
  expect(r.done).toBe(3);
  expect(r.hist).toBe(3);
  expect(r.title).toBe('3 mountains climbed.');
});

test('per-gap breaks: each gap honors its own setting', async ({ page }) => {
  await seedTasks(page, [{ name: 'A', mins: 5 }, { name: 'B', mins: 5 }, { name: 'C', mins: 5 }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), { gaps: ['none', 'long', 'none'] });
    Sanctuary.doneRun();                     // gap after A = none → straight into B
    const afterA = { onBreak: document.body.classList.contains('break'),
                     active: tasks.find(t => t.name === 'B').id === activeId };
    Sanctuary.doneRun();                     // gap after B = long → 15m break
    const afterB = { onBreak: document.body.classList.contains('break'), mode };
    return { afterA, afterB };
  });
  expect(r.afterA.onBreak).toBe(false);
  expect(r.afterA.active).toBe(true);
  expect(r.afterB.onBreak).toBe(true);
  expect(r.afterB.mode).toBe('long');
});

test('break end waits on a Ready screen; Begin starts the next task', async ({ page }) => {
  await seedTasks(page, [{ name: 'A', mins: 5 }, { name: 'B', mins: 5 }]);
  const r = await page.evaluate(() => {
    Sanctuary.startRun(tasks.map(t => t.id), { gaps: ['short', 'none'] });
    Sanctuary.doneRun();                     // A done → short break, B queued
    Sanctuary.onFinish('short');             // break hits zero
    const ready = {
      running: running,                      // nothing being timed while waiting
      cat: document.getElementById('sxCat').textContent,
      title: document.getElementById('sxEndTitle').textContent,
      primary: document.getElementById('sxPrimary').textContent,
    };
    Sanctuary.endPrimary();                  // Begin →
    return Object.assign(ready, {
      activeB: tasks.find(t => t.name === 'B').id === activeId,
      focusRunning: running, m: mode,
    });
  });
  expect(r.cat).toContain('READY');
  expect(r.title).toBe('Next: B');
  expect(r.primary).toBe('Begin →');
  expect(r.activeB).toBe(true);
  expect(r.focusRunning).toBe(true);         // the climb starts on Begin
  expect(r.m).toBe('focus');
});

test('routines: start materializes steps as tasks; early exit removes leftovers with Undo', async ({ page }) => {
  const r = await page.evaluate(() => {
    routines.push({ id: 'r_test_1', name: 'Morning startup', autoFlow: false, order: 0,
      steps: [{ name: 'Coffee + plan', mins: 10, gapAfter: 'none' },
              { name: 'Inbox zero', mins: 15, gapAfter: 'short' },
              { name: 'Deep block', mins: 45, gapAfter: 'none' }] });
    startRoutine('r_test_1');
    const started = {
      taskCount: tasks.length,
      cat: categories.find(c => c.name === 'Morning startup'),
      catMatch: tasks.every(t => t.categoryId === (categories[0] || {}).id),
      source: tasks[0].source,
      sanctuaryOpen: Sanctuary.isOpen(),
    };
    Sanctuary.doneRun();                     // finish step 1 only
    Sanctuary.endRun();                      // bail out early
    const afterEnd = {
      remaining: tasks.filter(t => !t.done).length,   // leftovers removed
      doneKept: tasks.filter(t => t.done).length,     // finished step stays (history intact)
      undoShown: document.getElementById('undoMsg').textContent,
    };
    runUndo();                               // bring the instances back
    return { started, afterEnd, restored: tasks.filter(t => !t.done).length };
  });
  expect(r.started.taskCount).toBe(3);
  expect(r.started.cat).toBeTruthy();
  expect(r.started.source).toBe('routine');
  expect(r.started.sanctuaryOpen).toBe(true);
  expect(r.afterEnd.remaining).toBe(0);
  expect(r.afterEnd.doneKept).toBe(1);
  expect(r.afterEnd.undoShown).toContain('2 unfinished steps removed');
  expect(r.restored).toBe(2);
});

test('save-as-routine snapshots the queue; sanitizeRoutines rejects forged payloads', async ({ page }) => {
  await seedTasks(page, [{ name: 'Stretch', mins: 5 }, { name: 'Journal', mins: 10 }]);
  const r = await page.evaluate(() => {
    openRunSetup();
    runGaps[runSetupOrder[0]] = 'long';      // per-gap override survives into the template
    window.prompt = () => 'Wind-down';       // stub the name prompt
    saveRunAsRoutine();
    closeRunSetup();
    const saved = routines[0];
    const hostile = sanitizeRoutines([
      { id: '"><img onerror=x>', name: 'evil', steps: [{ name: 'x', mins: 5 }] }, // unsafe id
      { id: 'r_ok', name: 'ok', steps: [{ name: 's', mins: 1e9, gapAfter: 'weird' }], autoFlow: 'yes' },
      { id: 'r_empty', name: 'no steps', steps: [] },
    ]);
    return { saved, hostile };
  });
  expect(r.saved.name).toBe('Wind-down');
  expect(r.saved.steps).toEqual([
    { name: 'Stretch', mins: 5, gapAfter: 'long' },
    { name: 'Journal', mins: 10, gapAfter: 'short' },
  ]);
  expect(r.hostile.length).toBe(1);          // forged id + empty routine dropped
  expect(r.hostile[0].id).toBe('r_ok');
  expect(r.hostile[0].steps[0].mins).toBe(480);      // clamped
  expect(r.hostile[0].steps[0].gapAfter).toBe('none'); // coerced
  expect(r.hostile[0].autoFlow).toBe(false);           // strict boolean
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
