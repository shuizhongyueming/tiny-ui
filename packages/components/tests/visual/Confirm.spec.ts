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

test("Confirm example screenshot", async ({ page }) => {
  await page.goto("/components/example/Confirm.html");
  await page.waitForTimeout(1000);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm.png");
});

test("Confirm dialog screenshot", async ({ page }) => {
  await page.goto("/components/example/Confirm.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'multiPage');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-dialog.png");
});

test("Confirm with cancel screenshot", async ({ page }) => {
  await page.goto("/components/example/Confirm.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'withCancel');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-with-cancel.png");
});

test("Confirm small config screenshot", async ({ page }) => {
  await page.goto("/components/example/Confirm.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'small');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-small.png");
});

test("Confirm normal config screenshot", async ({ page }) => {
  await page.goto("/components/example/Confirm.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'normal');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-normal.png");
});

test("Confirm large config screenshot", async ({ page }) => {
  await page.goto("/components/example/Confirm.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'large');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-large.png");
});
