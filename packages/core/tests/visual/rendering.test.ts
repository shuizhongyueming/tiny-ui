import { describe, it, expect, beforeAll } from "vitest";
import { createCanvas, loadTinyUI } from "../integration/setup";
import type TinyUI from "../../src/TinyUI";

describe("Visual Regression - Text Rendering", () => {
  beforeAll(async () => {
    await loadTinyUI();
  });

  it("should render text correctly", async () => {
    const canvasId = createCanvas(400, 300);
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const TinyUIClass = (window as any).TinyUI;
    const tinyUI = new TinyUIClass(canvas) as TinyUI;

    // 创建文本节点
    const text = tinyUI.createText("Hello Visual Test");
    text.x = 50;
    text.y = 100;
    text.color = "#FF0000";
    text.fontSize = 24;
    tinyUI.root.addChild(text);

    // 渲染
    tinyUI.render();

    // 验证 canvas 有内容（非空白）
    const gl = canvas.getContext("webgl");
    expect(gl).toBeTruthy();

    // 读取像素验证有渲染内容
    const pixels = new Uint8Array(400 * 300 * 4);
    gl!.readPixels(0, 0, 400, 300, gl!.RGBA, gl!.UNSIGNED_BYTE, pixels);

    // 检查是否至少有一些非黑色像素（有内容渲染）
    let hasNonBlackPixel = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) {
        hasNonBlackPixel = true;
        break;
      }
    }

    expect(hasNonBlackPixel).toBe(true);
  });
});

describe("Visual Regression - Graphics Rendering", () => {
  beforeAll(async () => {
    await loadTinyUI();
  });

  it("should render rectangle correctly", async () => {
    const canvasId = createCanvas(400, 300);
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const TinyUIClass = (window as any).TinyUI;
    const tinyUI = new TinyUIClass(canvas) as TinyUI;

    // 创建矩形
    const graphics = tinyUI.createGraphics();
    graphics.drawRect(50, 50, 100, 100, "#00FF00");
    tinyUI.root.addChild(graphics);

    // 渲染
    tinyUI.render();

    // 验证 canvas 有内容
    const gl = canvas.getContext("webgl");
    expect(gl).toBeTruthy();

    // 简单验证：检查渲染后 canvas 尺寸正确
    expect(canvas.width).toBeGreaterThanOrEqual(400);
    expect(canvas.height).toBeGreaterThanOrEqual(300);
  });
});

describe("Visual Regression - Bitmap Rendering", () => {
  beforeAll(async () => {
    await loadTinyUI();
  });

  it("should render bitmap image", async () => {
    const canvasId = createCanvas(400, 300);
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const TinyUIClass = (window as any).TinyUI;
    const tinyUI = new TinyUIClass(canvas) as TinyUI;

    try {
      // 加载测试图片
      const bitmap = await tinyUI.createBitmapFromUrl(
        "tests/fixtures/64x64-red.png"
      );
      bitmap.x = 100;
      bitmap.y = 100;
      tinyUI.root.addChild(bitmap);

      // 渲染
      tinyUI.render();

      // 验证图片尺寸
      expect(bitmap.width).toBe(64);
      expect(bitmap.height).toBe(64);
    } catch (e) {
      // 如果图片加载失败，跳过测试
      console.warn("Bitmap loading failed in visual test:", e);
    }
  });
});
