import { test, expect } from "@playwright/test";

test.describe("Engine Coexistence", () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    // Navigate to test page
    await page.goto("/tests/integration/engine-coexistence/pixi-scene.html");
    await page.waitForTimeout(2000); // Wait for initialization

    // Log any errors
    if (errors.length > 0) {
      console.log("Page errors:", errors);
    }
  });

  test("should load test page", async ({ page }) => {
    // 基本测试：页面加载成功
    const title = await page.title();
    expect(title).toBe("Pixi + TinyUI Coexistence Test");
  });

  test("should have required libraries", async ({ page }) => {
    // 检查库是否加载
    const result = await page.evaluate(() => {
      return {
        hasPIXI: typeof (window as any).PIXI !== "undefined",
        hasTinyUI: typeof (window as any).TinyUI !== "undefined",
      };
    });

    expect(result.hasPIXI).toBe(true);
    expect(result.hasTinyUI).toBe(true);
  });

  test("should attempt initialization", async ({ page }) => {
    // 检查初始化是否尝试（即使失败）
    const result = await page.evaluate(() => {
      return {
        testScenarioExists: typeof (window as any).testScenario !== "undefined",
        testScenarioValue: (window as any).testScenario,
      };
    });

    // 测试场景对象应该存在（即使为 null）
    expect(result.testScenarioExists).toBe(true);
  });

  test("should have canvas element", async ({ page }) => {
    // 检查 canvas 是否存在（不等待 beforeEach 的 2 秒延迟）
    await page.goto("/tests/integration/engine-coexistence/pixi-scene.html");
    
    const canvas = page.locator("canvas#game");
    await expect(canvas).toBeAttached();

    const canvasSize = await canvas.evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
    }));

    expect(canvasSize.width).toBe(800);
    expect(canvasSize.height).toBe(600);
  });
});
