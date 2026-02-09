import { test, expect } from '@playwright/test';

test('events example screenshot', async ({ page }) => {
  await page.goto('/example/events.html');
  
  // 等待渲染完成
  await page.waitForTimeout(500);
  
  // 截图 canvas 区域（不含 UI overlay）
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('events.png', {
    clip: { x: 0, y: 0, width: 900, height: 700 },
  });
});
