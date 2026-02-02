import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration/engine-coexistence',
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
