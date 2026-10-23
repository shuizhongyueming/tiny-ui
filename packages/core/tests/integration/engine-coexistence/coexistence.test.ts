import { test, expect } from "@playwright/test";

/**
 * 引擎共存测试。
 *
 * 场景：Pixi 先在 canvas 上初始化 WebGL，TinyUI 之后接管**同一个** canvas，
 * 两者交替绘制（Pixi ticker 里调 tinyUI.patchRender）。
 *
 * 这一层要抓的是单元测试永远抓不到的东西 —— GL 状态互相污染。
 * 历史上真出过：TinyUI._setBufferData 从不解绑 VAO，顶点属性状态写进了
 * Pixi/three 的 VAO，导致对方 draw 时报 GL_INVALID_OPERATION（一局 296 次）。
 * 那种 bug 下所有对象坐标都正常、单测全绿，只有 GL 错误计数和最终像素会露馅。
 */

/**
 * 在页面脚本执行前挂上 GL 错误轮询。
 *
 * ※ 必须按 canvas 区分。页面里不止一个 WebGL context：Pixi 8 会建临时
 * canvas 做能力探测，那些 context 被丢弃时会正常地报 CONTEXT_LOST_WEBGL ——
 * 那不是缺陷。只统计承载游戏画面的主 canvas（#game）。
 */
async function installGlErrorProbe(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    (window as any).__glErrors = [] as Array<{ canvas: string; code: number }>;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: any[]
    ) {
      const ctx = (origGetContext as any).apply(this, args);
      const type = args[0];
      if (
        ctx &&
        (type === "webgl" || type === "webgl2" || type === "experimental-webgl") &&
        !(ctx as any).__errorProbeInstalled
      ) {
        (ctx as any).__errorProbeInstalled = true;

        const label = this.id || this.getAttribute("data-probe-name") || "(anon)";

        // WebGL 的错误标志是 sticky 的：一旦置位就一直保持，直到 getError() 读走。
        // 所以定时轮询不会漏报，只是把错误「收」进数组。
        setInterval(() => {
          const err = (ctx as WebGLRenderingContext).getError();
          if (err !== 0) {
            (window as any).__glErrors.push({ canvas: label, code: err });
          }
        }, 16);
      }
      return ctx;
    } as any;
  });
}

test.describe("Engine Coexistence", () => {
  test.beforeEach(async ({ page }) => {
    await installGlErrorProbe(page);
    await page.goto("/tests/integration/engine-coexistence/pixi-scene.html");

    // 等场景真的就绪，而且渲染循环已经跑起来。
    // 只等 testScenario 存在是不够的 —— 那时可能才画了 4 帧，
    // 后面的「循环在跑」断言会拿到毫无意义的小数字。
    await page.waitForFunction(
      () => {
        const ts = (window as any).testScenario;
        return ts && ts.getFrameCount() > 30;
      },
      undefined,
      { timeout: 30_000 },
    );
  });

  test("场景初始化成功，两个引擎都拿到同一个 canvas", async ({ page }) => {
    const info = await page.evaluate(() => {
      const ts = (window as any).testScenario;
      if (!ts) return { ok: false as const };

      const pixiCanvas = ts.pixiApp.canvas as HTMLCanvasElement;
      const tinyCanvas = ts.tinyUI.canvas as HTMLCanvasElement;

      return {
        ok: true as const,
        // 同一个 DOM canvas 对象，不是两个
        sameCanvas: pixiCanvas === tinyCanvas,
        // Pixi 用的是 WebGL（不是 WebGPU / Canvas2D）
        pixiGlIsWebGL:
          ts.pixiApp.renderer.gl instanceof WebGLRenderingContext ||
          ts.pixiApp.renderer.gl instanceof WebGL2RenderingContext,
        // TinyUI 复用了 Pixi 已建好的 context，而不是自己再要一个
        sameGl: ts.tinyUI.gl === ts.pixiApp.renderer.gl,
        glVersion: ts.tinyUI.gl instanceof WebGL2RenderingContext ? 2 : 1,
      };
    });

    // 这一条如果挂了，说明 window.testScenario 被 catch 分支设成了 null
    expect(info.ok, "testScenario 为 null —— 页面初始化抛异常了").toBe(true);
    if (!info.ok) return;

    expect(info.sameCanvas, "两个引擎必须共用同一个 canvas 元素").toBe(true);
    expect(info.pixiGlIsWebGL, "Pixi 没有使用 WebGL 渲染器").toBe(true);
    expect(info.sameGl, "TinyUI 没有复用 Pixi 的 GL context").toBe(true);
  });

  test("渲染循环在跑", async ({ page }) => {
    const before = await page.evaluate(
      () => (window as any).testScenario.getFrameCount() as number,
    );
    await page.waitForTimeout(1000);
    const after = await page.evaluate(
      () => (window as any).testScenario.getFrameCount() as number,
    );

    // beforeEach 已保证过 30 帧；这里再验证 1 秒内还在往前走
    expect(before).toBeGreaterThan(30);
    expect(after - before).toBeGreaterThan(10);
  });

  test("交替绘制期间没有 GL 错误", async ({ page }) => {
    // 多跑一会儿，让 Pixi 和 TinyUI 各画几百帧
    await page.waitForTimeout(2500);

    const errors = await page.evaluate(
      () => (window as any).__glErrors as Array<{ canvas: string; code: number }>,
    );

    // 只看主 canvas。临时探测用的 context 被丢弃时报 CONTEXT_LOST_WEBGL 是正常的。
    const mainErrors = errors.filter((e) => e.canvas === "game");

    // WebGL 错误码 → 人类可读名，失败时方便定位
    const names: Record<number, string> = {
      0x0500: "INVALID_ENUM",
      0x0501: "INVALID_VALUE",
      0x0502: "INVALID_OPERATION",
      0x0505: "OUT_OF_MEMORY",
      0x0506: "INVALID_FRAMEBUFFER_OPERATION",
      0x9242: "CONTEXT_LOST_WEBGL",
    };
    const readable = mainErrors.map((e) => names[e.code] ?? `0x${e.code.toString(16)}`);

    expect(
      readable,
      `交替绘制期间主 canvas 出现 GL 错误（VAO / 状态未还原的典型症状）`,
    ).toEqual([]);
  });

  test("画面同时包含两个引擎的绘制结果", async ({ page }) => {
    // Pixi 的矩形每帧 rotation += 0.01，直接截图每次都不一样 —— 先把动画冻住，
    // 固定角度后手动重绘一帧，画面才是确定的。
    const frozen = await page.evaluate(() => {
      const ts = (window as any).testScenario;
      if (!ts) return false;

      ts.pixiApp.ticker.stop();
      ts.pixiRect.rotation = 0.5;
      ts.pixiApp.render();
      ts.tinyUI.patchRender();
      return true;
    });
    expect(frozen, "冻结失败：testScenario 为 null").toBe(true);

    await expect(page.locator("canvas#game")).toHaveScreenshot(
      "pixi-tinyui-scene.png",
      { maxDiffPixelRatio: 0.02 },
    );
  });
});
