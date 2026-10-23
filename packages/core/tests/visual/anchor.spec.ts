import { test, expect } from '@playwright/test';
import { openExample } from './stable';

test('anchor example screenshot', async ({ page }) => {
  await openExample(page, "anchor");
  
  // 截图 canvas 区域
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('anchor.png', {
    clip: { x: 0, y: 0, width: 400, height: 300 },
  });
});
