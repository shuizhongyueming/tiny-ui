import { test, expect } from '@playwright/test';

test('phaser-text-test example screenshot', async ({ page }) => {
  await page.goto('/example/phaser-text-test.html');
  
  // 等待 Phaser 和 TinyUI 初始化
  await page.waitForTimeout(2000);
  
  // 截图 canvas 区域
  // phaser-text-test.html 使用固定画布尺寸并居中缩放
  // 不使用 clip，直接截取整个 canvas 元素
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('phaser-text-test.png');
});
