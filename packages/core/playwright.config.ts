import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration/engine-coexistence',
  use: {
    baseURL: 'http://localhost:8080',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx esbuild tests/integration/engine-coexistence/*.html --servedir=.',
    port: 8080,
  },
});
