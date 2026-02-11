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
  await page.waitForTimeout(500);
}

test("ShowDialog & ShowToast example screenshot", async ({ page }) => {
  await page.goto("/components/example/ShowDialog.html");
  await page.waitForTimeout(1000);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog.png");
});

test("Basic dialog screenshot", async ({ page }) => {
  await page.goto("/components/example/ShowDialog.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'basicDialog');
  await page.waitForTimeout(300);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog-basic.png");
});

test("Dialog with cancel screenshot", async ({ page }) => {
  await page.goto("/components/example/ShowDialog.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'cancelDialog');
  await page.waitForTimeout(300);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog-cancel.png");
});

test("Long content dialog screenshot", async ({ page }) => {
  await page.goto("/components/example/ShowDialog.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'longDialog');
  await page.waitForTimeout(300);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog-long.png");
});

test("Basic toast screenshot", async ({ page }) => {
  await page.goto("/components/example/ShowDialog.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'basicToast');
  await page.waitForTimeout(400);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowToast-basic.png");
});
