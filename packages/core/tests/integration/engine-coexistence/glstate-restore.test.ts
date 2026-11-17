import { test, expect, type Page } from "@playwright/test";

/**
 * 宿主 GL 状态恢复测试。
 *
 * 场景：宿主（Phaser / Pixi / three）在使用 TinyUI 之前就把一批状态设成了
 * 非默认值。`GLState.install()` 必须真读这些值 —— 写死 WebGL 规范默认值会导致
 * 第一次 `patchRender()` 结束后 `restore()` 把宿主设置改回默认，画面上是整体
 * 变色 / 描边错位 / 贴图上下颠倒，并且**不报任何 GL 错误**。
 *
 * 为什么不放在 tests/visual：这类缺陷不影响 TinyUI 自己的画面，只有「宿主视角」
 * 才能看出来。断言必须直接查询 GL，不能读 GLState 的缓存 —— 缓存本身就是被测对象。
 */

const SCENE = "/tests/integration/engine-coexistence/glstate-restore-scene.html";

/** 读 GL 真实状态（不经过 GLState 缓存）。 */
async function readState(page: Page) {
  return page.evaluate(() => (window as any).testScenario.readState());
}

async function boot(page: Page) {
  await page.goto(SCENE);
  await page.waitForFunction(() => !!(window as any).testScenario, undefined, {
    timeout: 30_000,
  });
}

/** 期望值与实际值逐字段对比，失败时直接指出是哪个字段。
 *
 * 数值走近似比较：GL 用 32 位浮点存颜色/深度，`0.11` 读回来是
 * `0.10999999940395355`。精确比较会把正确的实现判成失败。
 */
function expectClose(actual: any, expected: any, hint: string) {
  const walk = (a: any, e: any, path: string) => {
    if (typeof e === "number") {
      expect(typeof a, `${hint} → ${path} 不是数值`).toBe("number");
      expect(
        Math.abs(a - e),
        `${hint} → ${path} 期望 ${e}，实际 ${a}`,
      ).toBeLessThan(1e-6);
      return;
    }
    if (Array.isArray(e)) {
      expect(Array.isArray(a), `${hint} → ${path} 不是数组`).toBe(true);
      expect(a.length, `${hint} → ${path} 长度不符`).toBe(e.length);
      e.forEach((v, i) => walk(a[i], v, `${path}[${i}]`));
      return;
    }
    if (e && typeof e === "object") {
      for (const k of Object.keys(e)) walk(a?.[k], e[k], `${path}.${k}`);
      return;
    }
    expect(a, `${hint} → ${path}`).toBe(e);
  };
  walk(actual, expected, "state");
}

function expectState(actual: any, expected: any, hint: string) {
  expectClose(actual, expected, hint);
}

test.describe("GLState 恢复宿主状态", () => {
  test("安装前设置的非默认状态，首次渲染后仍然保持", async ({ page }) => {
    await boot(page);
    const host = await page.evaluate(
      () => (window as any).testScenario.HOST_STATE,
    );

    // 安装前状态确实落地了（否则后面的断言没有意义）
    expectState(await readState(page), host, "安装前");

    // 一次完整的安全区：snapshot → TinyUI 改 GL → restore
    await page.evaluate(() => (window as any).testScenario.render());

    expectState(await readState(page), host, "安装后首次渲染");
  });

  test("安装后宿主改的值，后续渲染沿用新值而非安装时的快照", async ({
    page,
  }) => {
    await boot(page);
    const later = await page.evaluate(
      () => (window as any).testScenario.LATER_STATE,
    );

    // 走被包装过的 GL 方法改状态，等价于宿主在安装后继续操作
    await page.evaluate(() => (window as any).testScenario.applyLaterState());
    await page.evaluate(() => (window as any).testScenario.render());

    // 只修「初始值写死」、把 readFromGL 结果当常量保存的实现会在这里失败
    expectState(await readState(page), later, "安装后改值");
  });

  test("连续多次渲染保持幂等，不会逐帧漂移", async ({ page }) => {
    await boot(page);
    const host = await page.evaluate(
      () => (window as any).testScenario.HOST_STATE,
    );

    await page.evaluate(() => {
      const ts = (window as any).testScenario;
      for (let i = 0; i < 5; i++) ts.render();
    });

    expectState(await readState(page), host, "连续 5 次渲染后");
  });

  test("安装前设置的非默认 pixelStorei 状态也保持", async ({ page }) => {
    await boot(page);
    const host = await page.evaluate(
      () => (window as any).testScenario.HOST_STATE,
    );

    await page.evaluate(() => (window as any).testScenario.render());

    // pixelStorei 四项由 TextureManager 逐次设置，必须靠 restore 还原。
    // 宿主在上传贴图后忘记复位是常见现象，丢了会让宿主的下一张贴图上下颠倒。
    const state = await readState(page);
    expectState(
      {
        unpackFlipY: state.unpackFlipY,
        unpackPremultiplyAlpha: state.unpackPremultiplyAlpha,
        unpackAlignment: state.unpackAlignment,
        unpackColorspaceConversion: state.unpackColorspaceConversion,
      },
      {
        unpackFlipY: host.unpackFlipY,
        unpackPremultiplyAlpha: host.unpackPremultiplyAlpha,
        unpackAlignment: host.unpackAlignment,
        unpackColorspaceConversion: host.unpackColorspaceConversion,
      },
      "pixelStorei",
    );
  });
});
