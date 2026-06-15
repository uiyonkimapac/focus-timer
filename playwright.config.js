// Playwright test config. The app is a single static file (index.html) with no
// build, so we just serve the folder and drive the real page — the same code
// that ships. Tests live in ./tests.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8099',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Serve the static app for the duration of the run.
  webServer: {
    command: 'python3 -m http.server 8099',
    url: 'http://127.0.0.1:8099/index.html',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore',
    timeout: 30000,
  },
});
