// Remote control — command ingestion, whitelisting, presence payload, and the
// Remote modal's empty states. All offline: handleRemoteCmd / presencePayload
// are plain top-level functions, so we drive them directly with page.evaluate
// (no realtime channel needed — the network is only the transport).
const { test, expect } = require('@playwright/test');
const { open, seedTasks } = require('./helpers');

test.describe('remote control', () => {
  test('start/pause commands addressed to this device drive the timer', async ({ page }) => {
    await open(page);
    await seedTasks(page, [{ name: 'Deep work', mins: 25 }]);
    await page.evaluate(() => setActive(tasks[0].id, false));

    const afterStart = await page.evaluate(() => {
      handleRemoteCmd({ to: deviceId, from: 'other-dev', fromName: 'Phone', cmd: 'start' });
      return running;
    });
    expect(afterStart).toBe(true);

    // Toast names the sender (rendered via textContent — no HTML injection).
    await expect(page.locator('#remoteToastMsg')).toHaveText('🎛 Timer started from Phone');

    const afterPause = await page.evaluate(() => {
      handleRemoteCmd({ to: deviceId, from: 'other-dev', fromName: 'Phone', cmd: 'pause' });
      return running;
    });
    expect(afterPause).toBe(false);
  });

  test('pause on an already-paused timer is a harmless no-op', async ({ page }) => {
    await open(page);
    const state = await page.evaluate(() => {
      handleRemoteCmd({ to: deviceId, from: 'x', fromName: 'Phone', cmd: 'pause' });
      return { running, remaining, totalSec };
    });
    expect(state.running).toBe(false);
    expect(state.remaining).toBe(state.totalSec);
  });

  test('commands for another device, unknown commands, and own echoes are ignored', async ({ page }) => {
    await open(page);
    await seedTasks(page, [{ name: 'Task', mins: 10 }]);
    const state = await page.evaluate(() => {
      setActive(tasks[0].id, false);
      handleRemoteCmd({ to: 'someone-else', from: 'x', fromName: 'P', cmd: 'start' });
      handleRemoteCmd({ to: deviceId, from: 'x', fromName: 'P', cmd: 'explode' });
      handleRemoteCmd({ to: deviceId, from: 'x', fromName: 'P', cmd: '__proto__' }); // prototype-chain probe
      handleRemoteCmd({ to: deviceId, from: deviceId, fromName: 'me', cmd: 'start' }); // own echo
      handleRemoteCmd(null);
      handleRemoteCmd('start');
      return running;
    });
    expect(state).toBe(false);
  });

  test('remote reset restores the loaded task time after ticking', async ({ page }) => {
    await open(page);
    await seedTasks(page, [{ name: 'Task', mins: 10 }]);
    const state = await page.evaluate(() => {
      setActive(tasks[0].id, false);
      remaining = 200; // pretend it ran down
      handleRemoteCmd({ to: '*', from: 'x', fromName: 'P', cmd: 'reset' }); // '*' = all devices
      return { remaining, totalSec, running };
    });
    expect(state.remaining).toBe(state.totalSec);
    expect(state.running).toBe(false);
  });

  test('presence payload carries the state the Remote sheet needs', async ({ page }) => {
    await open(page);
    await seedTasks(page, [{ name: 'Write the report', mins: 15 }]);
    const p = await page.evaluate(() => {
      setActive(tasks[0].id, false);
      return presencePayload();
    });
    expect(p.name.length).toBeGreaterThan(0);
    expect(p.running).toBe(false);
    expect(p.mode).toBe('focus');
    expect(p.remaining).toBe(15 * 60);
    expect(p.totalSec).toBe(15 * 60);
    expect(p.task).toBe('Write the report');
    expect(typeof p.at).toBe('number');
  });

  test('renaming the device trims, caps, and falls back to a platform guess', async ({ page }) => {
    await open(page);
    const names = await page.evaluate(() => {
      renameDevice('  Kitchen iPad  ');
      const set = deviceName;
      renameDevice('');
      const fallback = deviceName;
      renameDevice('x'.repeat(100));
      const capped = deviceName;
      return { set, fallback, capped };
    });
    expect(names.set).toBe('Kitchen iPad');
    expect(names.fallback.length).toBeGreaterThan(0);
    expect(names.capped.length).toBe(40);
  });

  test('remote modal explains itself when sync is off', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { syncCode = null; openRemoteModal(); });
    await expect(page.locator('#remoteModal')).toHaveClass(/open/);
    await expect(page.locator('#remoteHint')).toContainText('Not connected');
    await expect(page.locator('#deviceNameInput')).toHaveValue(/./);
    await page.evaluate(() => closeRemoteModal());
    await expect(page.locator('#remoteModal')).not.toHaveClass(/open/);
  });

  test('remote state line extrapolates a running countdown', async ({ page }) => {
    await open(page);
    const txt = await page.evaluate(() => remoteStateText({
      id: 'd', name: 'Desk', running: true, mode: 'focus',
      remaining: 300, totalSec: 1500, at: Date.now() - 60000, task: 'Deep work',
    }));
    expect(txt).toBe('▶ 04:00 · Focus Time — Deep work');
    const paused = await page.evaluate(() => remoteStateText({
      id: 'd', name: 'Desk', running: false, mode: 'short',
      remaining: 300, totalSec: 300, at: Date.now() - 60000, task: '',
    }));
    expect(paused).toBe('⏸ 05:00 · Short Break');
  });
});
