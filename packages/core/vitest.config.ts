import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 单元测试：在 Node.js 运行（Matrix, DisplayObject 计算）
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],

    // 浏览器测试配置
    browser: {
      enabled: false,
      instances: [
        {
          browser: "chromium",
          name: "chromium",
          headless: true,
        },
      ],
    },
  },
});
