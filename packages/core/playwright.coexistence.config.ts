import { defineConfig, devices } from "@playwright/test";

/**
 * 引擎共存测试。
 *
 * 这组测试和 tests/visual 的区别：视觉测试只跑 TinyUI 自己，
 * 这里跑「另一个引擎先初始化，TinyUI 后来接管同一个 canvas」。
 * 单独一份 config 是因为：
 *   - testDir 不同（在 tests/integration/engine-coexistence 下）
 *   - 需要比视觉测试更长的超时（要等 CDN 上的引擎库）
 */
export default defineConfig({
  testDir: "./tests/integration/engine-coexistence",

  // 页面要等外部库加载 + 初始化，给宽一点的预算
  timeout: 60_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  workers: 1,

  use: {
    baseURL: "http://localhost:5566",
    ...devices["Desktop Chrome"],
    viewport: { width: 1024, height: 768 },
  },

  // 复用视觉测试那台服务器（同一个目录、同一个端口）。
  // 单独跑本 config 时它会把服务起起来。
  webServer: {
    command: "python3 -m http.server 5566",
    port: 5566,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
