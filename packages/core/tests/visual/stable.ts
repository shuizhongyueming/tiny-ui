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
  /* 注意路径：本包的服务根是 packages/core，example 在 /example/。
     components 包的根是 packages/，路径是 /components/example/ —— 两者不同。 */
  await page.goto(`/example/${name}.html`);
  await waitForStableCanvas(page);
}
