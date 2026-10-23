import { test, expect } from '@playwright/test';
import { openExample } from './stable';

test('phaser-text-test example screenshot', async ({ page }) => {
  await openExample(page, "phaser-text-test");
  
  // 截图 canvas 区域
  // phaser-text-test.html 使用固定画布尺寸并居中缩放
  // 不使用 clip，直接截取整个 canvas 元素
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveScreenshot('phaser-text-test.png');
});
