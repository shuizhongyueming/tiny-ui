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

// ============================================================================
// 字体属性与视觉度量
//
// 这一组是排版依赖的契约：既要能"斜体 + 字距"表达原版 UI 的样式，
// 又要能报出**文字真实基线** —— 多字号混排（13px 标签 + 16px 数值）时，
// 按盒顶/盒底/中心对齐都会差几像素，只有基线对齐才对得上 CSS inline。
// ============================================================================
describe('Text 字体属性与视觉度量', () => {
  const createMockApp = () =>
    ({
      enqueueGLTask: () => {},
      textureManager: {},
      gl: {},
    }) as unknown as TinyUI;

  const makeText = (content: string, fontSize = 32): Text => {
    const t = new Text(createMockApp());
    t.text = content;
    t.fontSize = fontSize;
    t.updateTexture();
    return t;
  };

  it('fontStyle 默认 normal，可切成 italic', () => {
    const t = makeText('AB');
    expect(t.fontStyle).toBe('normal');
    t.fontStyle = 'italic';
    expect(t.fontStyle).toBe('italic');
  });

  it('fontStyle 变更会标脏纹理', () => {
    const t = makeText('AB');
    t.updateTexture();
    expect(t.textureNeedsUpdate).toBe(false);
    t.fontStyle = 'italic';
    expect(t.textureNeedsUpdate).toBe(true);
  });

  it('letterSpacing 默认 0，可设置', () => {
    const t = makeText('AB');
    expect(t.letterSpacing).toBe(0);
    t.letterSpacing = 4;
    expect(t.letterSpacing).toBe(4);
  });

  it('letterSpacing 非有限值时归零（避免 NaN 扩散到纹理尺寸）', () => {
    const t = makeText('AB');
    t.letterSpacing = NaN;
    expect(t.letterSpacing).toBe(0);
    t.letterSpacing = Infinity;
    expect(t.letterSpacing).toBe(0);
  });

  it('letterSpacing 变更会标脏纹理', () => {
    const t = makeText('AB');
    t.updateTexture();
    expect(t.textureNeedsUpdate).toBe(false);
    t.letterSpacing = 2;
    expect(t.textureNeedsUpdate).toBe(true);
  });

  it('visualTop > 0：文字 ink 在盒内偏下（盒顶有 topPadding）', () => {
    const t = makeText('AB', 32);
    expect(t.visualTop).toBeGreaterThan(0);
    // ink 底 = visualTop + visualHeight，应落在盒内
    expect(t.visualBottom).toBeLessThanOrEqual(t.height);
  });

  it('visualHeight 小于盒高（盒含 topPadding 与描边留白）', () => {
    const t = makeText('AB', 32);
    expect(t.visualHeight).toBeLessThan(t.height);
    expect(t.visualHeight).toBeGreaterThan(0);
  });

  it('baselineOffset 落在 ink 区间内（visualTop..visualBottom）', () => {
    const t = makeText('AB', 32);
    expect(t.baselineOffset).toBeGreaterThanOrEqual(t.visualTop);
    expect(t.baselineOffset).toBeLessThanOrEqual(t.visualBottom);
  });

  it('字号越大，baselineOffset 越大（可用来做跨字号基线对齐）', () => {
    const small = makeText('AB', 13);
    const big = makeText('AB', 32);
    expect(big.baselineOffset).toBeGreaterThan(small.baselineOffset);
  });

  it('两个不同字号的文字按基线对齐后，基线落在同一条线', () => {
    const small = makeText('LABEL', 13);
    const big = makeText('+24', 16);
    small.anchorX = 0;
    small.anchorY = 0;
    big.anchorX = 0;
    big.anchorY = 0;

    // 让两者基线都落在 y = 100
    small.y = 100 - small.baselineOffset;
    big.y = 100 - big.baselineOffset;

    expect(small.y + small.baselineOffset).toBeCloseTo(100);
    expect(big.y + big.baselineOffset).toBeCloseTo(100);
  });

  it('setSize 是 no-op：Text 尺寸由内容与字号决定', () => {
    const t = makeText('AB', 32);
    const before = { w: t.width, h: t.height };
    t.setSize(10, 10);
    expect(t.width).toBe(before.w);
    expect(t.height).toBe(before.h);
  });
});

describe('Text 度量在渲染前就可用', () => {
  /* 背景：以前 width / height / visualTop / visualHeight / baselineOffset 全都
     在 updateTexture() 里才算，而 updateTexture() 只在 render() 时被调用。
     于是 `const t = app.createText('abc'); layoutColumn(col, [t])` 拿到的是
     全 0 尺寸 —— 游标不前进，多行文字全部叠在 y=0，而且**不报任何错**。

     这个坑在游戏里不明显（它每帧重算布局），一次性布局的页面上必踩。
     修法：把度量从「生成纹理」里拆出来，内容/样式变更时同步算。 */

  const createMockApp = () =>
    ({
      enqueueGLTask: () => {},
      textureManager: {},
      gl: {},
    }) as unknown as TinyUI;

  it('构造后立即设置文本，width / height 就不为 0', () => {
    const text = new Text(createMockApp());
    text.fontSize = 32;
    text.text = 'Hello';

    // 注意：这里**没有**调用 render() / updateTexture()
    expect(text.width).toBeGreaterThan(0);
    expect(text.height).toBeGreaterThan(0);
  });

  it('修改 fontSize 后尺寸立刻跟着变', () => {
    const text = new Text(createMockApp());
    text.text = 'Hello';

    text.fontSize = 12;
    const smallWidth = text.width;
    const smallHeight = text.height;

    text.fontSize = 48;
    expect(text.width).toBeGreaterThan(smallWidth);
    expect(text.height).toBeGreaterThan(smallHeight);
  });

  it('修改文本内容后尺寸立刻跟着变', () => {
    const text = new Text(createMockApp());
    text.fontSize = 24;

    text.text = 'i';
    const narrow = text.width;

    text.text = 'a much longer string';
    expect(text.width).toBeGreaterThan(narrow);
  });

  it('visualTop / visualHeight / baselineOffset 也是立即可用', () => {
    const text = new Text(createMockApp());
    text.fontSize = 24;
    text.text = 'Ag';

    // 视觉度量是布局的基础（layoutColumn 的 useInk 直接读它们）
    expect(text.visualHeight).toBeGreaterThan(0);
    expect(text.visualHeight).toBeLessThanOrEqual(text.height);
    expect(text.baselineOffset).toBeGreaterThan(0);
  });

  it('空文本的尺寸是 0，且不残留上一次的度量', () => {
    const text = new Text(createMockApp());
    text.fontSize = 24;
    text.text = 'Hello';
    expect(text.width).toBeGreaterThan(0);

    text.text = '';
    expect(text.width).toBe(0);
    expect(text.height).toBe(0);
    expect(text.visualHeight).toBe(0);
  });

  it('重复读取不会重复度量（有缓存）', () => {
    const text = new Text(createMockApp());
    text.fontSize = 24;
    text.text = 'Hello';

    const w1 = text.width;
    const w2 = text.width;
    const w3 = text.width;
    expect(w2).toBe(w1);
    expect(w3).toBe(w1);
  });
});
