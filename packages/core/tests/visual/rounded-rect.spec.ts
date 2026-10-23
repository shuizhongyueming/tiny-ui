import { test, expect } from '@playwright/test';
import { openExample } from './stable';

test('rounded-rect example screenshot', async ({ page }) => {
  await openExample(page, "rounded-rect");
  
  // 截图 canvas 区域
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('rounded-rect.png', {
    clip: { x: 0, y: 0, width: 900, height: 700 },
  });
});
