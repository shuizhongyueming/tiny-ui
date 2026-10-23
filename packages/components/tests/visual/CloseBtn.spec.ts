import { test, expect } from "@playwright/test";
import { openExample, waitForStableCanvas, tapTestButton as triggerButtonClick } from "./stable";


test("CloseBtn example screenshot", async ({ page }) => {
  await openExample(page, "CloseBtn");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn.png");
});

test("CloseBtn popup screenshot", async ({ page }) => {
  await openExample(page, "CloseBtn");
  await triggerButtonClick(page, 'popup');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn-popup.png");
});

test("CloseBtn corner demo screenshot", async ({ page }) => {
  await openExample(page, "CloseBtn");
  await triggerButtonClick(page, 'cornerDemo');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn-corner-demo.png");
});

test("CloseBtn with delay screenshot", async ({ page }) => {
  await openExample(page, "CloseBtn");
  await triggerButtonClick(page, 'withDelay');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("CloseBtn-with-delay.png");
});
