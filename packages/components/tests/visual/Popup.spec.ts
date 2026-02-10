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

test("Popup example screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup.png");
});

test("Popup fullscreen screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'fullscreen');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-fullscreen.png");
});

test("Popup custom size screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'customSize');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-custom-size.png");
});

test("Popup light alpha screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'lightAlpha');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-light-alpha.png");
});

test("Popup medium alpha screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'mediumAlpha');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-medium-alpha.png");
});

test("Popup dark alpha screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'darkAlpha');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-dark-alpha.png");
});

test("Popup blue background screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'blueBg');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-blue-bg.png");
});

test("Popup red background screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'redBg');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-red-bg.png");
});

test("Popup green background screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'greenBg');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-green-bg.png");
});

test("Popup purple background screenshot", async ({ page }) => {
  await page.goto("/components/example/Popup.html");
  await page.waitForTimeout(1000);
  await triggerButtonClick(page, 'purpleBg');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Popup-purple-bg.png");
});
