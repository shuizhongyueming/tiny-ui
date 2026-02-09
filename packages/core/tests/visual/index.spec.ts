import { test, expect } from '@playwright/test';

test('index example screenshot', async ({ page }) => {
  await page.goto('/example/index.html');

  // 等待资源加载和渲染完成
  // index.html 使用 loadImage 和 createBitmapFromUrl 加载图片，需要足够时间
  await page.waitForTimeout(4000);

  // 截图 canvas 区域
  // 注意：index.html 包含异步图片加载，允许较大差异
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('index.png', {
    clip: { x: 0, y: 0, width: 1000, height: 800 },
    maxDiffPixels: 50000,  // 允许更多差异，因为异步图片加载时间不确定
    threshold: 0.2,
  });
});
