import { describe, it, expect, beforeEach } from 'vitest';
import { createCanvas, loadTinyUI } from './setup';

describe('TinyUI Integration', () => {
  beforeEach(async () => {
    await loadTinyUI();
  });

  it('should initialize with canvas', async () => {
    const canvasId = await createCanvas(800, 600);
    
    const result = await page.evaluate((id) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const tinyUI = new (window as any).TinyUI(canvas);
      return {
        stageWidth: tinyUI.stageWidth,
        stageHeight: tinyUI.stageHeight,
        hasRoot: !!tinyUI.root,
        rootWidth: tinyUI.root.width,
        rootHeight: tinyUI.root.height,
      };
    }, canvasId);
    
    expect(result.stageWidth).toBe(800);
    expect(result.stageHeight).toBe(600);
    expect(result.hasRoot).toBe(true);
    expect(result.rootWidth).toBe(800);
    expect(result.rootHeight).toBe(600);
  });

  it('should create Text node', async () => {
    const canvasId = await createCanvas(800, 600);
    
    const result = await page.evaluate((id) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const tinyUI = new (window as any).TinyUI(canvas);
      const text = tinyUI.createText('Hello Test');
      text.x = 100;
      text.y = 100;
      text.color = '#FF0000';
      text.fontSize = 32;
      
      tinyUI.root.addChild(text);
      tinyUI.render();
      
      return {
        textContent: text.text,
        textX: text.x,
        textY: text.y,
        textWidth: text.width,
        textHeight: text.height,
      };
    }, canvasId);
    
    expect(result.textContent).toBe('Hello Test');
    expect(result.textX).toBe(100);
    expect(result.textY).toBe(100);
    expect(result.textWidth).toBeGreaterThan(0);
    expect(result.textHeight).toBeGreaterThan(0);
  });

  it('should create Bitmap from URL', async () => {
    const canvasId = await createCanvas(800, 600);
    
    const result = await page.evaluate(async (id) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const tinyUI = new (window as any).TinyUI(canvas);
      
      try {
        const bitmap = await tinyUI.createBitmapFromUrl('tests/fixtures/64x64-red.png');
        bitmap.x = 50;
        bitmap.y = 50;
        tinyUI.root.addChild(bitmap);
        tinyUI.render();
        
        return {
          success: true,
          bitmapWidth: bitmap.width,
          bitmapHeight: bitmap.height,
          bitmapX: bitmap.x,
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }, canvasId);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.bitmapWidth).toBe(64);
      expect(result.bitmapHeight).toBe(64);
      expect(result.bitmapX).toBe(50);
    }
  });

  it('should create Graphics with shapes', async () => {
    const canvasId = await createCanvas(800, 600);
    
    const result = await page.evaluate((id) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const tinyUI = new (window as any).TinyUI(canvas);
      
      const graphics = tinyUI.createGraphics();
      graphics.drawRect(0, 0, 100, 100, '#FF0000');
      graphics.drawCircle(150, 150, 50, '#00FF00');
      
      tinyUI.root.addChild(graphics);
      tinyUI.render();
      
      return {
        commandCount: graphics.commands.length,
        graphicsWidth: graphics.width,
        graphicsHeight: graphics.height,
      };
    }, canvasId);
    
    expect(result.commandCount).toBe(2);
    expect(result.graphicsWidth).toBeGreaterThan(0);
    expect(result.graphicsHeight).toBeGreaterThan(0);
  });

  it('should handle Container nesting', async () => {
    const canvasId = await createCanvas(800, 600);
    
    const result = await page.evaluate((id) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const tinyUI = new (window as any).TinyUI(canvas);
      
      const container = tinyUI.createContainer();
      container.width = 200;
      container.height = 200;
      container.x = 100;
      container.y = 100;
      
      const child = tinyUI.createGraphics();
      child.drawRect(0, 0, 50, 50, '#0000FF');
      child.x = 50;
      child.y = 50;
      
      container.addChild(child);
      tinyUI.root.addChild(container);
      tinyUI.render();
      
      const childGlobalX = child.getGlobalTransformMatrix().tx;
      
      return {
        containerWidth: container.width,
        containerHeight: container.height,
        childCount: container.children.length,
        childGlobalX: childGlobalX,
      };
    }, canvasId);
    
    expect(result.containerWidth).toBe(200);
    expect(result.containerHeight).toBe(200);
    expect(result.childCount).toBe(1);
    expect(result.childGlobalX).toBe(150); // container.x(100) + child.x(50)
  });
});
