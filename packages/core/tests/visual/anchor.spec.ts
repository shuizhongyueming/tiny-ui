import { test, expect } from '@playwright/test';

test('anchor example screenshot', async ({ page }) => {
  await page.goto('/example/anchor.html');
  
  // 等待图片加载
  await page.waitForTimeout(800);
  
  // 截图 canvas 区域
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('anchor.png', {
    clip: { x: 0, y: 0, width: 400, height: 300 },
  });
});
