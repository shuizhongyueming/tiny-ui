import { test, expect } from "@playwright/test";
import { openExample, waitForStableCanvas, tapTestButton as triggerButtonClick } from "./stable";

test("adjustTo example screenshot", async ({ page }) => {
  await openExample(page, "adjustTo");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("adjustTo.png");
});
