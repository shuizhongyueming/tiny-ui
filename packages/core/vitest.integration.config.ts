import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  /**
   * 🚨 必须把 playwright 相关的包排除出依赖预构建。
   *
   * playwright-core 把自己的浏览器驱动都内联了，`package.json` 里没有任何 dependencies，
   * 但代码里仍有 `require("chromium-bidi/...")` 这样的静态引用（bidi 路径）和
   * `require("fsevents")`（macOS 文件监听）。Vite 的 optimizeDeps 用 esbuild 预构建时
   * 会去真的解析这些模块，于是报：
   *   - Could not resolve "chromium-bidi/lib/cjs/bidiMapper/BidiMapper"
   *   - No loader is configured for ".node" files: fsevents.node
   * 整体失败信息是 "Error during dependency optimization"。
   *
   * 这些包只在 Node 侧被 vitest 加载（作为 browser provider），不应该被预构建，
   * 排除后浏览器模式才能正常启动。
   */
  optimizeDeps: {
    exclude: ["playwright", "playwright-core", "@vitest/browser-playwright"],
  },

  test: {
    // 集成测试：在浏览器环境运行（需要 WebGL）
    include: ["tests/integration/**/*.test.ts"],
    // coexistence 需要外部 HTTP 服务器（three.js + TinyUI 同 canvas），单独跑
    exclude: ["tests/integration/engine-coexistence/**"],

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
