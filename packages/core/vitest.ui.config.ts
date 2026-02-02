import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    // 包含所有测试（单元测试 + 集成测试）
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/integration/engine-coexistence/coexistence.test.ts"],

    // 浏览器测试配置 - 启用 headed 模式
    browser: {
      enabled: true,
      headless: false, // 使用真实浏览器窗口
      instances: [
        {
          browser: "chromium",
          name: "chromium",
        },
      ],
      provider: playwright(),
    },

    // UI 配置
    ui: true,
    open: true, // 自动打开浏览器
  },

  server: {
    // Vitest UI 服务器配置
    port: 51204,
    strictPort: false,
  },
});
