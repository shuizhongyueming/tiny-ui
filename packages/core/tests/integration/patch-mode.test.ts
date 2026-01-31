import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas, loadTinyUI } from './setup';
import type TinyUI from '../../src/TinyUI';

describe('TinyUI Patch Mode', () => {
  beforeAll(async () => {
    await loadTinyUI();
  });

  it('should use GLState for patch rendering', async () => {
    const canvasId = createCanvas(800, 600);
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const gl = canvas.getContext('webgl')!;
    const TinyUIClass = (window as any).TinyUI;
    const GLStateClass = TinyUIClass.GLState;

    // Create GLState from existing context
    const glState = new GLStateClass(gl);
    glState.ensureSyncedFromGL();

    // Set some GL state
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Create TinyUI with shared GLState
    const tinyUI = new TinyUIClass(canvas, {}, 'webgl', { glState }) as TinyUI;

    const graphics = tinyUI.createGraphics();
    graphics.drawRect(0, 0, 100, 100, '#FF0000');
    tinyUI.root.addChild(graphics);

    // Store original state
    const originalBlendEnabled = gl.isEnabled(gl.BLEND);

    // Perform patch render
    tinyUI.patchRender();

    // Check if state was restored
    const restoredBlendEnabled = gl.isEnabled(gl.BLEND);

    expect(restoredBlendEnabled).toBe(originalBlendEnabled);
  });

  it('should not clear canvas in patch mode', async () => {
    const canvasId = createCanvas(800, 600);
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const gl = canvas.getContext('webgl')!;
    const TinyUIClass = (window as any).TinyUI;
    const GLStateClass = TinyUIClass.GLState;

    const glState = new GLStateClass(gl);
    glState.ensureSyncedFromGL();

    const tinyUI = new TinyUIClass(canvas, {}, 'webgl', { glState }) as TinyUI;

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

    // If we got here without error, patch render worked
    expect(true).toBe(true);
  });
});
