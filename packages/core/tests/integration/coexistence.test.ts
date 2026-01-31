import { describe, it, expect, beforeEach } from 'vitest';
import { page } from 'vitest/browser';

describe('Engine Coexistence', () => {
  beforeEach(async () => {
    // Navigate to test page
    await page.goto('http://localhost:8080/pixi-scene.html');
    await page.waitForTimeout(1000); // Wait for initialization
  });

  it('should initialize Pixi first', async () => {
    const result = await page.evaluate(() => {
      const scenario = (window as any).testScenario;
      return {
        hasPixiApp: !!scenario?.pixiApp,
        hasTinyUI: !!scenario?.tinyUI,
      };
    });
    
    expect(result.hasPixiApp).toBe(true);
    expect(result.hasTinyUI).toBe(true);
  });

  it('should render both Pixi and TinyUI elements', async () => {
    const result = await page.evaluate(() => {
      const scenario = (window as any).testScenario;
      return {
        pixiRectExists: !!scenario?.pixiRect,
        uiTextExists: !!scenario?.uiText,
        uiTextContent: scenario?.uiText?.text,
      };
    });
    
    expect(result.pixiRectExists).toBe(true);
    expect(result.uiTextExists).toBe(true);
    expect(result.uiTextContent).toBe('UI Overlay');
  });

  it('should animate Pixi while TinyUI patches', async () => {
    const initialRotation = await page.evaluate(() => {
      return (window as any).testScenario?.pixiRect?.rotation;
    });
    
    await page.waitForTimeout(100); // Wait for some frames
    
    const finalRotation = await page.evaluate(() => {
      return (window as any).testScenario?.pixiRect?.rotation;
    });
    
    expect(finalRotation).not.toBe(initialRotation);
    
    const frameCount = await page.evaluate(() => {
      return (window as any).testScenario?.getFrameCount?.();
    });
    
    expect(frameCount).toBeGreaterThan(0);
  });

  it('should maintain GL state isolation', async () => {
    const result = await page.evaluate(() => {
      const scenario = (window as any).testScenario;
      const gl = scenario?.pixiApp?.renderer?.gl;
      
      if (!gl) return { error: 'No GL context' };
      
      // Check if blend is still enabled after TinyUI render
      const blendEnabled = gl.isEnabled(gl.BLEND);
      
      return {
        blendEnabled,
        pixiStillRendering: scenario?.pixiApp?.ticker?.started,
      };
    });
    
    expect(result.blendEnabled).toBe(true);
    expect(result.pixiStillRendering).toBe(true);
  });
});
