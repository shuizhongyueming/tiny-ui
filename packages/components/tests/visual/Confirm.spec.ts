import { test, expect } from "@playwright/test";
import { openExample, waitForStableCanvas, tapTestButton as triggerButtonClick } from "./stable";


test("Confirm example screenshot", async ({ page }) => {
  await openExample(page, "Confirm");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm.png");
});

test("Confirm dialog screenshot", async ({ page }) => {
  await openExample(page, "Confirm");
  await triggerButtonClick(page, 'multiPage');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-dialog.png");
});

test("Confirm with cancel screenshot", async ({ page }) => {
  await openExample(page, "Confirm");
  await triggerButtonClick(page, 'withCancel');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-with-cancel.png");
});

test("Confirm small config screenshot", async ({ page }) => {
  await openExample(page, "Confirm");
  await triggerButtonClick(page, 'small');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-small.png");
});

test("Confirm normal config screenshot", async ({ page }) => {
  await openExample(page, "Confirm");
  await triggerButtonClick(page, 'normal');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-normal.png");
});

test("Confirm large config screenshot", async ({ page }) => {
  await openExample(page, "Confirm");
  await triggerButtonClick(page, 'large');
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("Confirm-large.png");
});
