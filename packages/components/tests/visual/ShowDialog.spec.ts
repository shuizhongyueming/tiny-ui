import { test, expect } from "@playwright/test";
import { openExample, waitForStableCanvas, tapTestButton as triggerButtonClick } from "./stable";


test("ShowDialog & ShowToast example screenshot", async ({ page }) => {
  await openExample(page, "ShowDialog");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog.png");
});

test("Basic dialog screenshot", async ({ page }) => {
  await openExample(page, "ShowDialog");
  await triggerButtonClick(page, 'basicDialog');
  await page.waitForTimeout(300);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog-basic.png");
});

test("Dialog with cancel screenshot", async ({ page }) => {
  await openExample(page, "ShowDialog");
  await triggerButtonClick(page, 'cancelDialog');
  await page.waitForTimeout(300);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog-cancel.png");
});

test("Long content dialog screenshot", async ({ page }) => {
  await openExample(page, "ShowDialog");
  await triggerButtonClick(page, 'longDialog');
  await page.waitForTimeout(300);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowDialog-long.png");
});

test("Basic toast screenshot", async ({ page }) => {
  await openExample(page, "ShowDialog");
  await triggerButtonClick(page, 'basicToast');
  await page.waitForTimeout(400);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("ShowToast-basic.png");
});
