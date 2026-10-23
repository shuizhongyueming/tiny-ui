import { test, expect } from "@playwright/test";

/**
 * layoutRow / layoutColumn 的视觉基线 + 数值断言。
 *
 * 两层都要：
 *   - 数值断言（layoutMetrics）证明「算出来的位置对」
 *   - 截图基线证明「画出来也在那个位置」
 * 只有前者，anchor / 视觉边界 / 字体度量出错时看不见；
 * 只有后者，失败时只知道「变了」，不知道变成什么。
 *
 * ⚠️ 必须显式设 viewport 与画布一致。默认 1920×1080 会裁掉页面下半部分，
 * 截图变成「半个页面」，后面几个场景等于没测。
 */
test.use({ viewport: { width: 900, height: 1260 } });

async function openScene(page: import("@playwright/test").Page) {
  await page.goto("/example/layout.html");
  await page.waitForFunction(() => (window as any).layoutSceneReady === true, undefined, {
    timeout: 30_000,
  });
  return page.evaluate(() => (window as any).layoutMetrics as any[]);
}

test("截图基线：六种布局场景", async ({ page }) => {
  await openScene(page);
  await expect(page.locator("canvas#game")).toHaveScreenshot("layout-scenarios.png", {
    maxDiffPixelRatio: 0.01,
  });
});

test("align=start 交叉轴顶部对齐", async ({ page }) => {
  const metrics = await openScene(page);
  const row = metrics[0];
  expect(row.kind).toBe("row");
  expect(row.align).toBe("start");

  const tops = row.children.map((c: any) => c.y);
  // 三个块高度不同（20 / 56 / 36），顶部必须都在同一水平线
  expect(new Set(tops).size, `顶部不一致: ${JSON.stringify(tops)}`).toBe(1);
  // 容器高度 = 最高的那个块
  expect(row.height).toBe(Math.max(...row.children.map((c: any) => c.h)));
});

test("align=center 交叉轴垂直居中", async ({ page }) => {
  const metrics = await openScene(page);
  const row = metrics[1];
  expect(row.align).toBe("center");

  const centers = row.children.map((c: any) => Math.round((c.y + c.h / 2) * 100) / 100);
  expect(new Set(centers).size, `中心不一致: ${JSON.stringify(centers)}`).toBe(1);
});

test("align=end 交叉轴底部对齐", async ({ page }) => {
  const metrics = await openScene(page);
  const row = metrics[2];
  expect(row.align).toBe("end");

  const bottoms = row.children.map((c: any) => Math.round((c.y + c.h) * 100) / 100);
  expect(new Set(bottoms).size, `底边不一致: ${JSON.stringify(bottoms)}`).toBe(1);
});

test("align=baseline 不同字号共享基线", async ({ page }) => {
  const metrics = await openScene(page);
  const row = metrics[3];
  expect(row.align).toBe("baseline");

  // 字号 12 / 36 / 20，盒高与基线偏移都不同，但 y + baseline 必须相同
  const baselines = row.children.map(
    (c: any) => Math.round((c.y + c.baseline) * 100) / 100,
  );
  expect(new Set(baselines).size, `基线不一致: ${JSON.stringify(baselines)}`).toBe(1);

  // 顺带保护：三个字号确实不同，否则这条断言可能是「凑巧相等」
  const heights = new Set(row.children.map((c: any) => c.h));
  expect(heights.size).toBeGreaterThan(1);
});

test("gaps 使用逐项间距而不是统一 gap", async ({ page }) => {
  const metrics = await openScene(page);
  const row = metrics[4];

  const gaps: number[] = [];
  for (let i = 1; i < row.children.length; i++) {
    const prev = row.children[i - 1];
    const cur = row.children[i];
    gaps.push(Math.round((cur.x - (prev.x + prev.w)) * 100) / 100);
  }

  // 配置是 gaps: [4, 40, 4]
  expect(gaps, `实际间距: ${JSON.stringify(gaps)}`).toEqual([4, 40, 4]);
});

test("visible=false 不占位，间距也不为它留着", async ({ page }) => {
  const metrics = await openScene(page);
  const row = metrics[5];

  const [a, hidden, b] = row.children;
  expect(hidden.visible).toBe(false);
  // 隐藏项没被移动（layout 不该改它）
  expect(hidden.x).toBe(0);
  // 可见的两个块之间只有一个 gap(10)
  expect(Math.round((b.x - (a.x + a.w)) * 100) / 100).toBe(10);
});

test("useInk 让文字按视觉边界堆叠，总高明显小于盒边界", async ({ page }) => {
  const metrics = await openScene(page);
  const inkOn = metrics[6];
  const inkOff = metrics[7];

  expect(inkOn.kind).toBe("column");
  expect(inkOff.kind).toBe("column");

  // 同样的内容、同样的 gap，只差 useInk
  expect(inkOn.children.length).toBe(inkOff.children.length);
  expect(
    inkOn.height,
    `useInk 应更紧凑：${inkOn.height} vs ${inkOff.height}`,
  ).toBeLessThan(inkOff.height);

  // useInk 的行距 = visualHeight + gap；不用 useInk 的行距 = 盒高 + gap
  const inkStep = inkOn.children[1].y - inkOn.children[0].y;
  const boxStep = inkOff.children[1].y - inkOff.children[0].y;
  expect(inkStep).toBeLessThan(boxStep);

  // useInk 时子节点的 y 会是负值：盒顶被上推，让 ink 从容器顶开始
  const firstVisualTop = inkOn.children[0].y + inkOn.children[0].visualTop;
  expect(Math.round(firstVisualTop * 100) / 100).toBe(0);
});

test("layoutColumn 的 gaps 与统一 gap 都按配置生效", async ({ page }) => {
  const metrics = await openScene(page);
  const col = metrics[8];

  const gaps: number[] = [];
  for (let i = 1; i < col.children.length; i++) {
    const prev = col.children[i - 1];
    const cur = col.children[i];
    gaps.push(Math.round((cur.y - (prev.y + prev.h)) * 100) / 100);
  }

  // 配置是 gaps: [2, 30]
  expect(gaps, `实际间距: ${JSON.stringify(gaps)}`).toEqual([2, 30]);
});
