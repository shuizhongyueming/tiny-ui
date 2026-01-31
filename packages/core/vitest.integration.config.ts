import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    // 集成测试：在浏览器环境运行（需要 WebGL）
    // 排除 coexistence 测试（它需要外部 HTTP 服务器）
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["tests/integration/coexistence.test.ts"],

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
