import { test, expect } from '@playwright/test';

test('rounded-rect example screenshot', async ({ page }) => {
  await page.goto('/example/rounded-rect.html');
  
  // 等待渲染完成
  await page.waitForTimeout(500);
  
  // 截图 canvas 区域
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('rounded-rect.png', {
    clip: { x: 0, y: 0, width: 900, height: 700 },
  });
});
