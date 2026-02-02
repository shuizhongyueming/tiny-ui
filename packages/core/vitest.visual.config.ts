import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    // 视觉测试：在浏览器环境运行（需要 WebGL 和截图）
    include: ["tests/visual/**/*.test.ts"],

    // 浏览器测试配置 - 启用
    browser: {
      enabled: true,
      instances: [
        {
          browser: "chromium",
          name: "chromium",
          headless: true,
        },
      ],
      provider: playwright(),
    },
  },
});
