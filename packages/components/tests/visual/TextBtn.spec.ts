import { test, expect } from "@playwright/test";
import { openExample, waitForStableCanvas, tapTestButton as triggerButtonClick } from "./stable";

test("TextBtn example screenshot", async ({ page }) => {
  await openExample(page, "TextBtn");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("TextBtn.png");
});
