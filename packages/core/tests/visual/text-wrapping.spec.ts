import { test, expect } from '@playwright/test';

test('text-wrapping example screenshot', async ({ page }) => {
  await page.goto('/example/text-wrapping.html');
  
  // 等待渲染完成
  await page.waitForTimeout(500);
  
  // 截图 canvas 区域
  // text-wrapping.html 是三列布局，每列 350px + 标签宽度 + 间距
  // 完整内容需要大约 1600+ 宽度和 1000+ 高度
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('text-wrapping.png', {
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
  });
});
