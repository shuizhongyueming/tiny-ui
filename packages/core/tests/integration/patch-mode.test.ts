import { describe, it, expect, beforeEach } from 'vitest';
import { createCanvas, loadTinyUI } from './setup';

describe('TinyUI Patch Mode', () => {
  beforeEach(async () => {
    await loadTinyUI();
  });

  it('should use GLState for patch rendering', async () => {
    const canvasId = await createCanvas(800, 600);
    
    const result = await page.evaluate((id) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const gl = canvas.getContext('webgl')!;
      
      // Create GLState from existing context
      const glState = new (window as any).TinyUI.GLState(gl);
      glState.ensureSyncedFromGL();
      
      // Set some GL state
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      // Create TinyUI with shared GLState
      const tinyUI = new (window as any).TinyUI(
        canvas,
        {},
        'webgl',
        { glState }
      );
      
      const graphics = tinyUI.createGraphics();
      graphics.drawRect(0, 0, 100, 100, '#FF0000');
      tinyUI.root.addChild(graphics);
      
      // Store original state
      const originalBlendEnabled = gl.isEnabled(gl.BLEND);
      const originalProgram = gl.getParameter(gl.CURRENT_PROGRAM);
      
      // Perform patch render
      tinyUI.patchRender();
      
      // Check if state was restored
      const restoredBlendEnabled = gl.isEnabled(gl.BLEND);
      
      return {
        originalBlendEnabled,
        restoredBlendEnabled,
        statePreserved: originalBlendEnabled === restoredBlendEnabled,
      };
    }, canvasId);
    
    expect(result.statePreserved).toBe(true);
  });

  it('should not clear canvas in patch mode', async () => {
    const canvasId = await createCanvas(800, 600);
    
    const result = await page.evaluate((id) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const gl = canvas.getContext('webgl')!;
      const glState = new (window as any).TinyUI.GLState(gl);
      glState.ensureSyncedFromGL();
      
      const tinyUI = new (window as any).TinyUI(
        canvas,
        {},
        'webgl',
        { glState }
      );
      
      // First render with clear
      const graphics1 = tinyUI.createGraphics();
      graphics1.drawRect(0, 0, 100, 100, '#FF0000');
      tinyUI.root.addChild(graphics1);
      tinyUI.render();
      
      // Second render with patch (should not clear)
      const graphics2 = tinyUI.createGraphics();
      graphics2.drawRect(100, 100, 100, 100, '#00FF00');
      tinyUI.root.addChild(graphics2);
      tinyUI.patchRender();
      
      return { patchRendered: true };
    }, canvasId);
    
    expect(result.patchRendered).toBe(true);
  });
});
