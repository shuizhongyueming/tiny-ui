import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration/engine-coexistence',
  /* 全部用例共用同一个 WebGL context 池。并行开多个页面时，上一页丢弃的 canvas
     与新页建 context 会互相干扰（swiftshader 下表现为 getParameter 返回 null、
     vertexAttrib4fv 传入无效序列）。共存测试本来就要求确定性的 GL 状态，
     串行跑最快也不到 30s。 */
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5566',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-webgl2',
            '--ignore-gpu-blacklist',
            '--use-gl=swiftshader',
            '--enable-features=WebGLDraftExtensions',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 5566',
    port: 5566,
    reuseExistingServer: true,
  },
});
