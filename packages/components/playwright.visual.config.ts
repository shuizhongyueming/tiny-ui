import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  /* 视觉基线必须串行。
     并行 worker 各自持有 WebGL 上下文，同一页面偶尔会渲染不全，导致基线随机失败。
     实测：4 个 worker 时 Popup 用例约 1/4 概率失败；workers=1 连跑 4 次全过。
     页面本身是稳定的（单页连采 24 帧字节完全一致），问题只出在并发。 */
  workers: 1,
  use: {
    baseURL: 'http://localhost:5567',
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
    command: 'python3 -m http.server 5567 --directory ..',
    port: 5567,
    reuseExistingServer: true,
  },
  snapshotDir: './tests/visual/__snapshots__',
});
