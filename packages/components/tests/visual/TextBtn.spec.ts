import { test, expect } from "@playwright/test";

test("TextBtn example screenshot", async ({ page }) => {
  await page.goto("/components/example/TextBtn.html");
  await page.waitForTimeout(1000);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveScreenshot("TextBtn.png");
});
