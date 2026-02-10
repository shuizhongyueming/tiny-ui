import { test, expect } from "@playwright/test";

// 辅助函数：触发按钮点击
async function triggerButtonClick(page: any, buttonName: string) {
  await page.evaluate((name: string) => {
    // @ts-ignore
    const btn = window.testButtons?.[name];
    if (btn) {
      const touch = new Touch({
        identifier: 0,
        target: document.getElementById('game')!,
        clientX: btn.x,
        clientY: btn.y,
        pageX: btn.x,
        pageY: btn.y,
        screenX: btn.x,
        screenY: btn.y,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: 1
      });
      const event = new TouchEvent('touchstart', {
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
        bubbles: true
      });
      document.getElementById('game')!.dispatchEvent(event);
    }
  }, buttonName);
  await page.waitForTimeout(2000);
}

test("CloseBtn example screenshot", async ({ page }) => {
  await page.goto("/components/example/CloseBtn.html");
  await page.waitForTimeout(1000);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn.png");
});

test("CloseBtn popup screenshot", async ({ page }) => {
  await page.goto("/components/example/CloseBtn.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'popup');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn-popup.png");
});

test("CloseBtn corner demo screenshot", async ({ page }) => {
  await page.goto("/components/example/CloseBtn.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'cornerDemo');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn-corner-demo.png");
});

test("CloseBtn with delay screenshot", async ({ page }) => {
  await page.goto("/components/example/CloseBtn.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'withDelay');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn-with-delay.png");
});
