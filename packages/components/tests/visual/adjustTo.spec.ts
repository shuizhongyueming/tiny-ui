import { test, expect } from "@playwright/test";

test("adjustTo example screenshot", async ({ page }) => {
  await page.goto("/components/example/adjustTo.html");
  await page.waitForTimeout(1000);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("adjustTo.png");
});
