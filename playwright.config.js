import { defineConfig, devices } from '@playwright/test';

const port = 4173;
// Served under a sub-path, like https://<user>.github.io/video-converter/.
const baseURL = `http://localhost:${port}/video-converter/`;

export default defineConfig({
  testDir: 'tests/e2e',
  // Conversions run in WebAssembly on one CPU core.
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  globalSetup: './tests/e2e/global-setup.js',
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Lets a pre-installed Chromium be used instead of Playwright's own download.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `node scripts/serve.mjs --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
