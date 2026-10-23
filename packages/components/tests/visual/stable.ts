import type { Page } from "@playwright/test";

/**
 * 等 canvas 画面稳定后再截图。
 *
 * 为什么不能只 `waitForTimeout(1000)`：这些 example 有入场动画（缩放 / 淡入 / toast 排队），
 * 1 秒未必结束。固定时长要么浪费，要么不够 —— 前者慢，后者让截图基线随机失败。
 * 实测这 5 个页面静置 3 秒后完全稳定，但具体需要多久随动画配置变化，所以自适应采样。
 *
 * 判定条件：连续两次采样字节完全相同（约 360ms 内没有任何变化）。
 * 单次相同不够 —— 动画可能恰好在两次采样之间回到同一帧。
 */
export async function waitForStableCanvas(
  page: Page,
  { timeoutMs = 15000, minMs = 1200, sampleMs = 150 } = {},
): Promise<void> {
  const canvas = page.locator("canvas");
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let previous = await canvas.screenshot();
  let stableSamples = 0;

  while (Date.now() < deadline) {
    await page.waitForTimeout(sampleMs);
    const current = await canvas.screenshot();
    if (Buffer.compare(previous, current) === 0) {
      stableSamples++;
      /* 关键：`minMs` 之内不返回。
         页面刚加载时 canvas 往往是空白的 —— 连续两次空白采样同样"稳定"，
         会把纯白基线写进快照，之后每次跑都失败。 */
      if (stableSamples >= 2 && Date.now() - startedAt >= minMs) return;
    } else {
      stableSamples = 0;
    }
    previous = current;
  }

  throw new Error(
    `canvas 在 ${timeoutMs}ms 内没有稳定（连续两次采样仍有差异）—— 页面可能有循环动画，这类用例不该用整页截图`,
  );
}

/**
 * 打开 example 页面并等到画面稳定。
 */
export async function openExample(page: Page, name: string): Promise<void> {
  await page.goto(`/components/example/${name}.html`);
  await waitForStableCanvas(page);
}

/**
 * 点击 example 页面暴露的 `window.testButtons[name]`。
 *
 * **必须用 `page.touchscreen.tap()`，不能自己 dispatch `TouchEvent`。**
 * 之前的实现是手动构造 `TouchEvent` 并派发到 `#game` —— 实测画面完全不变，
 * 也就是说那些「功能截图」用例拍的其实一直是首页。基线也是在同一状态下生成的，
 * 所以测试看起来是绿的，实际什么都没验证。
 *
 * `btn.x / btn.y` 是 canvas 的 buffer 坐标；canvas 的显示尺寸可能与之不同，
 * 所以先按 rect 换算成页面坐标。
 */
export async function tapTestButton(page: Page, name: string): Promise<void> {
  const position = await page.evaluate((buttonName: string) => {
    const buttons = (window as unknown as { testButtons?: Record<string, { x: number; y: number }> })
      .testButtons;
    const button = buttons?.[buttonName];
    if (!button) return null;

    const canvas = document.querySelector("canvas");
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.x + button.x * (rect.width / canvas.width),
      y: rect.y + button.y * (rect.height / canvas.height),
    };
  }, name);

  if (position === null) {
    throw new Error(`example 页面没有暴露 window.testButtons["${name}"]，或页面还没有 canvas`);
  }

  await page.touchscreen.tap(position.x, position.y);
  await waitForStableCanvas(page);
}
