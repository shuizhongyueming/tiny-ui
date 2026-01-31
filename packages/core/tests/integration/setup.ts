// 在 Vitest browser 模式下，此代码直接运行在浏览器中
// 不需要 page.evaluate，可以直接访问 DOM API

export function createCanvas(width = 800, height = 600): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.id = "test-canvas-" + Date.now();
  document.body.appendChild(canvas);
  return canvas.id;
}

export function loadTinyUI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已经加载
    if ((window as any).TinyUI) {
      resolve();
      return;
    }
    
    const script = document.createElement("script");
    // 根据测试文件位置调整路径
    const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
    const prefix = depth > 0 ? '../'.repeat(depth) : '';
    script.src = prefix + "dist/tiny-ui-core.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function loadPixi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).PIXI) {
      resolve();
      return;
    }
    
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
