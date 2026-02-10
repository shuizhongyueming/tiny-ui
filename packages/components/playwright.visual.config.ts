import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  use: {
    baseURL: 'http://localhost:5566',
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
    hasTouch: true,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.1,
    },
  },
  webServer: {
    command: 'python3 -m http.server 5566 --directory ..',
    port: 5566,
    reuseExistingServer: true,
  },
  snapshotDir: './tests/visual/__snapshots__',
});
