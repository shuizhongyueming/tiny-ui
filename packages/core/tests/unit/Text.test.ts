// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Text } from '../../src/Text';
import { BBCodeParser } from '../../src/utils/BBCodeParser';
import type TinyUI from '../../src/TinyUI';

// jsdom 命中 node-canvas，可提供真实的 2d context、measureText 与 getImageData
describe('Text border', () => {
  const createMockApp = () =>
    ({
      enqueueGLTask: () => {},
      textureManager: {},
      gl: {},
    }) as unknown as TinyUI;

  const createText = (content: string, fontSize = 32): Text => {
    const text = new Text(createMockApp());
    text.text = content;
    text.fontSize = fontSize;
    return text;
  };

  // 离屏 canvas 上非透明像素的计数与包围盒
  const inkStats = (text: Text) => {
    const canvas = (text as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 0) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { count, minX, minY, maxX, maxY };
  };

  it('should expand texture size by borderWidth in plain path', () => {
    const text = createText('Hello Border');
    text.updateTexture();

    const baseWidth = text.width;
    const baseHeight = text.height;
    expect(baseWidth).toBeGreaterThan(0);
    expect(baseHeight).toBeGreaterThan(0);

    text.borderColor = '#000000';
    text.borderWidth = 6;
    text.updateTexture();

    expect(text.width).toBe(baseWidth + 6);
    expect(text.height).toBe(baseHeight + 6);
  });

  it('should actually paint the stroke in plain path', () => {
    const plain = createText('W');
    plain.updateTexture();
    const withoutBorder = inkStats(plain);

    const stroked = createText('W');
    stroked.color = '#ffffff';
    stroked.borderColor = '#000000';
    stroked.borderWidth = 8;
    stroked.updateTexture();
    const withBorder = inkStats(stroked);

    // 描边真实增加了墨迹像素
    expect(withBorder.count).toBeGreaterThan(withoutBorder.count);
    // 墨迹不超出声明的内容盒（否则会被纹理采样裁掉）
    expect(withBorder.maxX).toBeLessThan(stroked.width);
    expect(withBorder.maxY).toBeLessThan(stroked.height);
    expect(withBorder.minX).toBeGreaterThanOrEqual(0);
    expect(withBorder.minY).toBeGreaterThanOrEqual(0);
  });

  it('should not clip the stroke with a huge borderWidth in plain path', () => {
    const text = createText('W');
    text.color = '#ffffff';
    text.borderColor = '#000000';
    text.borderWidth = 60;
    text.updateTexture();

    const ink = inkStats(text);
    expect(ink.maxX).toBeLessThan(text.width);
    expect(ink.maxY).toBeLessThan(text.height);
    expect(ink.minX).toBeGreaterThanOrEqual(0);
    expect(ink.minY).toBeGreaterThanOrEqual(0);
  });

  it('should keep lineThickness independent from Text-level border in BBCode', () => {
    const text = createText('[u]under[/u]');
    text.borderColor = '#000000';
    text.borderWidth = 8;

    const ctx = document.createElement('canvas').getContext('2d')!;
    const segments = new BBCodeParser().parse(text.text);
    const units = (text as any).buildRenderUnits(ctx, segments);

    // Text 级 border 写入独立字段，不污染 lineThickness/outline
    expect(units[0].style.borderWidth).toBe(8);
    expect(units[0].style.borderColor).toBe('#000000');
    expect(units[0].style.lineThickness).toBe(0.05);
    expect(units[0].style.outline).toBeUndefined();
  });

  it('should keep explicit [outline] tag fields alongside Text-level border', () => {
    const text = createText('[outline=#10b981]x[/outline]');
    text.borderColor = '#000000';
    text.borderWidth = 8;

    const ctx = document.createElement('canvas').getContext('2d')!;
    const segments = new BBCodeParser().parse(text.text);
    const units = (text as any).buildRenderUnits(ctx, segments);

    expect(units[0].style.outline).toBe('#10b981');
    expect(units[0].style.lineThickness).toBe(0.05);
    expect(units[0].style.borderWidth).toBe(8);
  });

  it('should let explicit [outline] tag take precedence over Text-level border', () => {
    const text = createText('[outline=#ff0000]W[/outline]');
    text.bbcodeEnabled = true;
    text.color = '#ffffff';
    text.borderColor = '#000000';
    text.borderWidth = 8;
    text.updateTexture();

    const canvas = (text as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let redPixels = 0;
    let blackPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 200 && r > 150 && g < 80 && b < 80) redPixels++;
      if (a > 200 && r < 20 && g < 20 && b < 20) blackPixels++;
    }

    // 标签轮廓生效（有红色描边），Text 级黑边被压制（无纯黑像素）
    expect(redPixels).toBeGreaterThan(0);
    expect(blackPixels).toBe(0);
  });

  it('should not clip the stroke in BBCode path (round join + horizontal reservation)', () => {
    const text = createText('W');
    text.bbcodeEnabled = true;
    text.color = '#ffffff';
    text.borderColor = '#000000';
    text.borderWidth = 30;
    text.updateTexture();

    const ink = inkStats(text);
    // miter 尖刺会顶到 y=0，round join 则留有顶部余量
    expect(ink.minY).toBeGreaterThan(0);
    expect(ink.minX).toBeGreaterThanOrEqual(0);
    // 墨迹不超出声明的内容盒
    expect(ink.maxX).toBeLessThan(text.width);
    expect(ink.maxY).toBeLessThan(text.height);
  });

  it('should actually paint Text-level border in BBCode path', () => {
    const plain = createText('Hoo');
    plain.bbcodeEnabled = true;
    plain.color = '#ffffff';
    plain.updateTexture();

    const stroked = createText('Hoo');
    stroked.bbcodeEnabled = true;
    stroked.color = '#ffffff';
    stroked.borderColor = '#000000';
    stroked.borderWidth = 16;
    stroked.updateTexture();

    // 描边真实增加了墨迹像素
    expect(inkStats(stroked).count).toBeGreaterThan(inkStats(plain).count);

    // 且存在真实的黑色描边像素（不走 [outline] 分支，锁 Text 级 border 绘制）
    const canvas = (stroked as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let blackPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (
        a > 200 &&
        data[i] < 20 &&
        data[i + 1] < 20 &&
        data[i + 2] < 20
      ) {
        blackPixels++;
      }
    }
    expect(blackPixels).toBeGreaterThan(0);
  });

  it('should produce stable dimensions across repeated updateTexture calls', () => {
    const text = createText('Stable Baseline', 24);
    text.updateTexture();
    const firstWidth = text.width;
    const firstHeight = text.height;

    // 绘制阶段会把 textBaseline 遗留为 "top"，二次更新不能因此改变度量
    text.textureNeedsUpdate = true;
    text.updateTexture();

    expect(text.width).toBe(firstWidth);
    expect(text.height).toBe(firstHeight);
  });

  it('should convert number borderColor to hex string', () => {
    const text = createText('color');
    text.borderColor = 0xff0000;
    expect(text.borderColor).toBe('#ff0000');
  });

  it('should clamp invalid borderWidth to 0', () => {
    const text = createText('clamp');
    text.borderWidth = -5;
    expect(text.borderWidth).toBe(0);
    text.borderWidth = NaN;
    expect(text.borderWidth).toBe(0);
    text.borderWidth = Infinity;
    expect(text.borderWidth).toBe(0);
  });

  it('should mark texture dirty when border changes', () => {
    const text = createText('dirty check');
    text.updateTexture();
    expect(text.textureNeedsUpdate).toBe(false);

    text.borderWidth = 4;
    expect(text.textureNeedsUpdate).toBe(true);

    text.updateTexture();
    text.borderColor = '#123456';
    expect(text.textureNeedsUpdate).toBe(true);
  });

  it('should keep size unchanged when borderWidth is 0', () => {
    const text = createText('No Border');
    text.updateTexture();

    const baseWidth = text.width;
    const baseHeight = text.height;

    text.borderWidth = 0;
    text.updateTexture();

    expect(text.width).toBe(baseWidth);
    expect(text.height).toBe(baseHeight);
  });
});
