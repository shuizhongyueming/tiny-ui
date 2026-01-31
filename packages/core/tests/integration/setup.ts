import { page } from '@vitest/browser/context';

export async function createCanvas(width = 800, height = 600): Promise<string> {
  const canvasId = await page.evaluate(({ w, h }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.id = 'test-canvas-' + Date.now();
    document.body.appendChild(canvas);
    return canvas.id;
  }, { w: width, h: height });
  return canvasId;
}

export async function loadTinyUI(): Promise<void> {
  await page.addScriptTag({ path: '../../dist/tiny-ui-core.js' });
}

export async function loadPixi(): Promise<void> {
  await page.addScriptTag({ 
    url: 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js' 
  });
}
