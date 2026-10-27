import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
import { nextPowerOfTwo } from "./utils/Power2";
import { BBCodeParser } from "./utils/BBCodeParser";
import { warnOnce } from "./utils/diagnostics";
import type { ParsedSegment } from "./utils/BBCodeParser";
import {
  type TextStyleState,
  type RenderUnit,
  type LineInfo,
  createDefaultStyle,
  applyTagToStyle,
  buildFontString,
} from "./utils/BBCodeTypes";

type FontWeight = "normal" | "bold";
type TextAlign = "left" | "center" | "right";

/**
 * 一次度量的完整产物。
 *
 * 拆成「度量」与「绘制」两阶段的原因：度量只用 canvas 2d 的 measureText，
 * 不需要 GL；而绘制要建纹理、要等 GL task。把度量提前到属性变更时，
 * 布局（layoutRow / layoutColumn）就能在 render 之前拿到真实尺寸。
 *
 * `plain` / `bbcode` 存各路径绘制阶段还要用的中间产物（换行结果等），
 * 免得绘制时重新量一遍。
 */
export interface TextLayoutResult {
  textureWidth: number;
  textureHeight: number;
  /** 节点布局尺寸（含 topPadding 与描边留白） */
  width: number;
  height: number;
  visualTop: number;
  visualHeight: number;
  ascent: number;
  descent: number;
  plain?: {
    lines: string[];
    topPadding: number;
    lineHeight: number;
    halfBorder: number;
  };
  bbcode?: {
    lines: LineInfo[];
    padding: number;
  };
}

/**
 * 规范化 font-family 字符串。
 *
 * 多词字体名在 CSS 里必须带引号，否则 `ctx.font = "bold 32px Fredoka One"`
 * 是非法值，canvas 会静默回退到默认字体——界面不报错、字体却变了。
 * 这里把单个多词 family 自动加引号，单字 family 和 CSS 通用关键字保持原样。
 */
export function normalizeFontFamily(family: string): string {
  if (!family) return family;

  return family
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      // 已带引号：不动
      if (/^["']/.test(part)) return part;
      // 单字（Arial、system-ui）或含通配后缀的写法：不动
      if (/^[A-Za-z_-]+$/.test(part)) return part;
      return `"${part}"`;
    })
    .join(", ");
}

/**
 * 组装 `ctx.font` 字符串并赋值。
 *
 * 顺序必须严格按 CSS font 简写：`font-style font-variant font-weight font-size/line-height font-family`。
 * 字体名必须已经过 `normalizeFontFamily`，否则多词名字会让整串非法、canvas 静默回退默认字体。
 */
export function applyFont(
  ctx: CanvasRenderingContext2D,
  weight: string,
  style: string,
  size: number,
  family: string,
): void {
  ctx.font = `${style} ${weight} ${size}px ${family}`;
}

/**
 * 应用字间距。
 *
 * `ctx.letterSpacing` 是 Chrome 99+ 的 canvas 2d 能力，赋值后 `measureText` 也会算入，
 * 所以纹理宽度自动正确。旧 WebView 不支持时它是 undefined，直接跳过即可——
 * 文字仍可读，只是宽度略窄，不能因此报错。
 */
export function applyLetterSpacing(
  ctx: CanvasRenderingContext2D,
  spacing: number,
): void {
  if (!spacing) {
    /* 必须显式归零：canvas 2d context 在 Text 组件里是复用的，
       上一轮拉开的字距会遗留到下一轮不想要字距的文字上。 */
    if ("letterSpacing" in ctx) {
      (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
    }
    return;
  }
  if ("letterSpacing" in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  }
}

export class Text extends DisplayObject {
  private _text: string = "";
  private _color: string = "#000000";
  private _fontFamily: string = "Arial";
  private _fontSize: number = 16;
  private _lineHeight: number = 0; // 0 表示自动计算
  private _fontWeight: FontWeight = "normal";
  /** 斜体。DOM 侧对应 font-style:italic —— 游戏 HUD 的状态标签全部使用斜体。 */
  private _fontStyle: "normal" | "italic" = "normal";
  /** 字间距（像素，= fontSize 的单位）。0 表示不设。对应 DOM 的 letter-spacing。 */
  private _letterSpacing: number = 0;
  private _maxWidth: number = 0; // 0 表示无限制
  private _align: TextAlign = "left";
  private _borderColor: string = "#000000";
  private _borderWidth: number = 0; // 0 表示无描边

  texture: WebGLTexture | null = null;

  /**
   * 纹理是否需要重建。**设成 true 会同步重新度量**。
   *
   * 为什么要做成访问器：以前这些值（width / height / visualTop / visualHeight /
   * baselineOffset）只在 updateTexture() 里算，而 updateTexture() 只在 render()
   * 时被调用。于是
   *
   *     const t = app.createText('abc');
   *     layoutColumn(col, [t]);        // ← 拿到 width=0、height=0
   *
   * 游标不前进，多行文字全部叠在 y=0，而且**不报任何错**。
   * 把所有「标脏」收敛到这一个入口，就能在属性变更的当下把度量算好，
   * 不用逐个 setter 去加同步调用。
   */
  private _textureNeedsUpdate: boolean = true;

  get textureNeedsUpdate(): boolean {
    return this._textureNeedsUpdate;
  }

  set textureNeedsUpdate(value: boolean) {
    this._textureNeedsUpdate = value;
    if (value) {
      this._layout = null;
      this.measureLayout();
    }
  }

  /**
   * 最近一次度量的结果（含绘制阶段要用的中间产物）。
   *
   * 缓存的意义不只是「让 getter 快」：没有它的话，setter 时算一遍、
   * updateTexture 时再算一遍，同样的 measureText 跑两次。
   */
  private _layout: TextLayoutResult | null = null;
  private textureUploadPending: boolean = false;
  private textureUpdateGen: number = 0;
  private textureWidth: number = 0;
  private textureHeight: number = 0;
  /** 文字 ink 顶部在节点盒内相对顶边的偏移（= topPadding + 2 + halfBorder）。 */
  private _visualTop: number = 0;
  /** 文字 ink 的高度（不含 topPadding 与描边留白）。 */
  private _visualHeight: number = 0;
  /** 字体 ascent（基线到字形顶）。用于多字号混排时的基线对齐。 */
  private _ascent: number = 0;
  /** 字体 descent（基线到字形底）。 */
  private _descent: number = 0;
  private previousText: string = "";
  private canvas: HTMLCanvasElement | null = null;
  private _bbcodeEnabled: boolean = false;
  private _canvasPadding: number = 10;
  private parser: BBCodeParser = new BBCodeParser();
  private inkBoundsVersion: number = -1;
  private cachedInkBounds: Readonly<{ x: number; y: number; width: number; height: number }> | null = null;

  get inkBounds(): Readonly<{ x: number; y: number; width: number; height: number }> | null {
    if (this.destroyed || this.textureNeedsUpdate || !this._text ||
        !this.canvas || this.textureUpdateGen === 0) return null;
    if (this.inkBoundsVersion === this.textureUpdateGen) return this.cachedInkBounds;
    this.inkBoundsVersion = this.textureUpdateGen;
    this.cachedInkBounds = null;
    try {
      const canvas = this.canvas;
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width || !canvas.height) return null;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width;
      let top = canvas.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] <= 8) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right >= left) {
        /* 顶点使用 0..width/height，UV 使用 width/textureWidth。
           节点盒的可见部分与 Canvas 纹素是 1:1，不存在拉伸；
           右侧和底部的 2 的幂补白不会被采样。 */
        this.cachedInkBounds = Object.freeze({
          x: left, y: top,
          width: right - left + 1,
          height: bottom - top + 1,
        });
      }
    } catch {
      return null;
    }
    return this.cachedInkBounds;
  }

  constructor(app: TinyUI, name: string = "Text") {
    super(app, name);
  }

  // Getters
  get text(): string {
    return this._text;
  }

  get color(): string {
    return this._color;
  }

  get fontFamily(): string {
    return this._fontFamily;
  }

  get fontSize(): number {
    return this._fontSize;
  }

  get lineHeight(): number {
    return this._lineHeight === 0 ? this._fontSize * 1.2 : this._lineHeight;
  }

  get fontWeight(): FontWeight {
    return this._fontWeight;
  }

  get fontStyle(): "normal" | "italic" {
    return this._fontStyle;
  }

  get letterSpacing(): number {
    return this._letterSpacing;
  }

  /**
   * 文字 ink 相对节点盒顶边的偏移。
   *
   * 节点盒高 = `textHeight + 4 + topPadding + borderWidth`，其中 **topPadding 只在顶部**，
   * 底部只有 2px 留白。所以文字在盒内不是垂直居中的，`anchorY=0.5` 的中心比文字视觉中心
   * 偏上 `topPadding/2`。做多行堆叠布局时必须用 visualTop / visualHeight 而不是 height，
   * 否则每叠一行就往下漂 topPadding。
   */
  get visualTop(): number {
    return this._visualTop;
  }

  /** 文字 ink 的高度。 */
  get visualHeight(): number {
    return this._visualHeight;
  }


  /**
   * 基线相对节点盒顶边的偏移。
   *
   * 多字号混排（如车侧标签的 13px 名称 + 16px 数值）必须按基线对齐才与原版一致 ——
   * CSS 里 inline 元素共享基线。按中心对齐会让大字上下各溢出一截；
   * 按 `visualBottom`（行盒底）对齐则会因为行高 ≠ 字形高而差 3~5px。
   */
  /**
   * Text 的尺寸由文本内容 + 字号决定，**外部不应设置**。
   *
   * 纹理是 2 的幂 padding，渲染时的 UV 是 `width / textureWidth`；
   * 强行改 width 会裁掉文字。要缩放文字请改 `fontSize`，要缩放整体请用 scale
   * 或把 Text 放进一个用 `setSize` 控制尺寸的容器。
   */
  setSize(_width: number, _height?: number): void {
    // 抛错会打断业务里「统一遍历 setSize」的代码，所以只提示不抛。
    warnOnce(
      this,
      "W_TEXT_SET_SIZE",
      "setSize",
      `尺寸由文本内容与字号决定，传入的 ${_width}×${_height ?? "?"} 已被忽略`,
      "要改字号用 fontSize，要缩放整体用 scale，要控制占位请把 Text 放进容器再 setSize 容器",
    );
  }

  protected defaultBaselineOffset(): number {
    return this._visualTop + this._ascent;
  }

  get maxWidth(): number {
    return this._maxWidth;
  }

  get align(): TextAlign {
    return this._align;
  }

  get borderColor(): string {
    return this._borderColor;
  }

  get borderWidth(): number {
    return this._borderWidth;
  }

  get bbcodeEnabled(): boolean {
    return this._bbcodeEnabled;
  }

  get canvasPadding(): number {
    return this._canvasPadding;
  }

  // Setters
  set text(text: string) {
    if (this._text !== text) {
      this._text = text;
      this.textureNeedsUpdate = true;
    }
  }

  // 添加一个私有方法来处理颜色格式转换
  private _formatColor(color: string | number): string {
    if (typeof color === "number") {
      // 处理 0xRRGGBB 格式，转换为 #RRGGBB
      return `#${color.toString(16).padStart(6, "0")}`;
    }

    // 如果已经是字符串格式，直接返回
    return color;
  }

  // 修改 set color 方法
  set color(color: string | number) {
    const formattedColor = this._formatColor(color);
    if (this._color !== formattedColor) {
      this._color = formattedColor;
      this.textureNeedsUpdate = true;
    }
  }

  set fontFamily(fontFamily: string) {
    const normalized = normalizeFontFamily(fontFamily);
    if (this._fontFamily !== normalized) {
      this._fontFamily = normalized;
      this.textureNeedsUpdate = true;
    }
  }

  set fontSize(fontSize: number) {
    if (this._fontSize !== fontSize) {
      this._fontSize = fontSize;
      this.textureNeedsUpdate = true;
    }
  }

  set lineHeight(lineHeight: number) {
    if (this._lineHeight !== lineHeight) {
      this._lineHeight = lineHeight;
      this.textureNeedsUpdate = true;
    }
  }

  set fontWeight(fontWeight: FontWeight) {
    if (this._fontWeight !== fontWeight) {
      this._fontWeight = fontWeight;
      this.textureNeedsUpdate = true;
    }
  }

  set fontStyle(fontStyle: "normal" | "italic") {
    if (this._fontStyle !== fontStyle) {
      this._fontStyle = fontStyle;
      this.textureNeedsUpdate = true;
    }
  }

  /**
   * 字间距。正数拉开、负数收紧，单位与 fontSize 相同（像素）。
   *
   * 使用 canvas 2d 的 `ctx.letterSpacing`（Chrome 99+）。浏览器不支持时静默忽略——
   * 文字仍可读，只是宽度略窄。`measureText` 会自动把字距算进去，所以纹理宽度是准的。
   */
  set letterSpacing(letterSpacing: number) {
    const v = Number.isFinite(letterSpacing) ? letterSpacing : 0;
    if (this._letterSpacing !== v) {
      this._letterSpacing = v;
      this.textureNeedsUpdate = true;
    }
  }

  set maxWidth(maxWidth: number) {
    if (this._maxWidth !== maxWidth) {
      this._maxWidth = maxWidth;
      this.textureNeedsUpdate = true;
    }
  }

  set align(align: TextAlign) {
    if (this._align !== align) {
      this._align = align;
      this.textureNeedsUpdate = true;
    }
  }

  set borderColor(color: string | number) {
    const formattedColor = this._formatColor(color);
    if (this._borderColor !== formattedColor) {
      this._borderColor = formattedColor;
      this.textureNeedsUpdate = true;
    }
  }

  set borderWidth(borderWidth: number) {
    // NaN/Infinity 视为 0：NaN 会使画布尺寸失效，且 NaN !== NaN 导致每次赋值都标脏
    const value = Number.isFinite(borderWidth) ? Math.max(0, borderWidth) : 0;
    if (this._borderWidth !== value) {
      this._borderWidth = value;
      this.textureNeedsUpdate = true;
    }
  }

  set bbcodeEnabled(value: boolean) {
    if (this._bbcodeEnabled !== value) {
      this._bbcodeEnabled = value;
      this.textureNeedsUpdate = true;
    }
  }

  set canvasPadding(value: number) {
    if (this._canvasPadding !== value) {
      this._canvasPadding = value;
      this.textureNeedsUpdate = true;
    }
  }

  updateTexture(): void {
    // 空文本：清掉纹理与尺寸，直接返回
    if (!this._text || this._text.length === 0) {
      if (this.texture) {
        const textureToDelete = this.texture;
        this.texture = null;
        this.app.enqueueGLTask(() => {
          this.app.gl.deleteTexture(textureToDelete);
        });
      }
      this.setWidth(0);
      this.setHeight(0);
      this.textureNeedsUpdate = false;
      this.previousText = "";
      this.textureUploadPending = false;
      this.textureUpdateGen++;
      return;
    }

    // 内容没变、也不脏：什么都不用做
    if (!this.textureNeedsUpdate && this.previousText === this._text) {
      return;
    }

    /* 度量通常已经在 setter 里做过了（textureNeedsUpdate 的 setter 会调
       measureLayout），这里只是兜底：万一有人绕过 setter 改字段，
       或者构造期间就调了 updateTexture。 */
    if (!this._layout) this.measureLayout();

    if (this._bbcodeEnabled) {
      this.updateTextureBBCode();
    } else {
      this.updateTexturePlain();
    }
  }

  /** 取（必要时创建）离屏 2D canvas。度量与绘制共用同一个。 */
  private ensureCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }
    return this.canvas;
  }

  /**
   * 重新度量并写回 width / height / visualTop / visualHeight / ascent / descent。
   *
   * 由 `textureNeedsUpdate = true` 触发。这样任何影响布局的属性变化
   * （文本、字号、字体、字距、maxWidth、描边…）都会**立刻**反映到尺寸上，
   * 布局代码不必再先 render 一次。
   */
  private measureLayout(): void {
    if (!this._text || this._text.length === 0) {
      this._layout = null;
      this.textureWidth = 0;
      this.textureHeight = 0;
      this.setWidth(0);
      this.setHeight(0);
      this._visualTop = 0;
      this._visualHeight = 0;
      this._ascent = 0;
      this._descent = 0;
      return;
    }

    const result = this._bbcodeEnabled
      ? this.measureBBCode()
      : this.measurePlain();

    this._layout = result;
    this.textureWidth = result.textureWidth;
    this.textureHeight = result.textureHeight;
    this.setWidth(result.width);
    this.setHeight(result.height);
    this._visualTop = result.visualTop;
    this._visualHeight = result.visualHeight;
    this._ascent = result.ascent;
    this._descent = result.descent;
  }

  /** 纯度量：只跑 measureText，不碰 GL、不改画布尺寸。 */
  private measurePlain(): TextLayoutResult {
    const canvas = this.ensureCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create 2D context for canvas");
    }

    applyFont(ctx, this._fontWeight, this._fontStyle, this._fontSize, this._fontFamily);
    applyLetterSpacing(ctx, this._letterSpacing);
    // 测量前固定 baseline：绘制阶段会把 baseline 改成 "top" 并遗留在复用的
    // canvas 上，node-canvas 下会影响下一轮 actualBoundingBox 度量
    ctx.textBaseline = "alphabetic";


    const effectiveLineHeight = this.lineHeight;
    let textWidth: number;
    let textHeight: number;
    let lines: string[] = [];

    const widthCache = new Map<string, number>();
    const getTextWidth = (str: string): number => {
      let width = widthCache.get(str);
      if (width === undefined) {
        width = ctx.measureText(str).width;
        widthCache.set(str, width);
      }
      return width;
    };

    const linesFromBreaks = this._text.split("\n");

    if (this._maxWidth > 0) {
      const spaceWidth = getTextWidth(" ");

      for (const lineText of linesFromBreaks) {
        if (lineText.length === 0) {
          lines.push("");
          continue;
        }

        const words = lineText.split(" ");
        let currentLine = "";
        let currentWidth = 0;

        for (const word of words) {
          const wordWidth = getTextWidth(word);
          const testWidth =
            currentLine.length === 0
              ? wordWidth
              : currentWidth + spaceWidth + wordWidth;

          if (testWidth <= this._maxWidth) {
            currentLine =
              currentLine.length === 0 ? word : currentLine + " " + word;
            currentWidth = testWidth;
          } else {
            if (currentLine.length > 0) {
              lines.push(currentLine);
              currentLine = "";
            }

            if (wordWidth > this._maxWidth) {
              let charLine = "";
              let charWidth = 0;

              for (const char of word) {
                const charW = getTextWidth(char);
                if (charWidth + charW <= this._maxWidth) {
                  charLine += char;
                  charWidth += charW;
                } else {
                  if (charLine.length > 0) {
                    lines.push(charLine);
                  }
                  charLine = char;
                  charWidth = charW;
                }
              }
              if (charLine.length > 0) {
                currentLine = charLine;
                currentWidth = charWidth;
              }
            } else {
              currentLine = word;
              currentWidth = wordWidth;
            }
          }
        }

        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
      }
    } else {
      lines = linesFromBreaks;

      for (const line of lines) {
        getTextWidth(line);
      }
    }

    let maxLineWidth = 0;
    for (const line of lines) {
      maxLineWidth = Math.max(maxLineWidth, getTextWidth(line));
    }
    textWidth = maxLineWidth;

    // 基于实际文本内容测量最大 ascent/descent
    // 优先使用 fontBoundingBoxAscent，它比 actualBoundingBoxAscent 更保守，
    // 能覆盖某些浏览器/字体对 actualBoundingBoxAscent 度量偏小的问题
    let maxAscent = 0;
    let maxDescent = 0;
    for (const line of lines) {
      if (line.length > 0) {
        const m = ctx.measureText(line);
        maxAscent = Math.max(
          maxAscent,
          m.fontBoundingBoxAscent ||
            m.actualBoundingBoxAscent ||
            this._fontSize,
        );
        maxDescent = Math.max(
          maxDescent,
          m.fontBoundingBoxDescent ||
            m.actualBoundingBoxDescent ||
            this._fontSize * 0.2,
        );
      }
    }
    const fontAscent = maxAscent || this._fontSize;
    const fontDescent = maxDescent || this._fontSize * 0.2;
    const fontVisualHeight = fontAscent + fontDescent;

    const lineHeight = Math.max(effectiveLineHeight, fontVisualHeight);
    textHeight = lines.length * lineHeight;

    // 顶部 padding：保守策略，至少 8px + fontSize 的 30%
    // 配合 textBaseline = "top" 使用，fillText 的 y 即为文本顶部
    const topPadding = Math.max(8, Math.ceil(this._fontSize * 0.3));
    // 描边以字形路径为中心向内外各扩一半，画布需额外预留 borderWidth
    const halfBorder = this._borderWidth / 2;
    const originalWidth = textWidth + 4 + this._borderWidth;
    const originalHeight = textHeight + 4 + topPadding + this._borderWidth;

    return {
      textureWidth: nextPowerOfTwo(originalWidth),
      textureHeight: nextPowerOfTwo(originalHeight),
      width: originalWidth,
      height: originalHeight,
      visualTop: topPadding + 2 + halfBorder,
      visualHeight: textHeight,
      ascent: fontAscent,
      descent: fontDescent,
      plain: { lines, topPadding, lineHeight, halfBorder },
    };
  }

  /** 纯度量（BBCode 路径）。 */
  private measureBBCode(): TextLayoutResult {
    const canvas = this.ensureCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create 2D context for canvas");
    }

    applyFont(ctx, this._fontWeight, this._fontStyle, this._fontSize, this._fontFamily);
    applyLetterSpacing(ctx, this._letterSpacing);

    const segments = this.parser.parse(this._text);

    // Build render units
    const units = this.buildRenderUnits(ctx, segments);

    // Layout lines
    const lines = this.layoutLines(units);

    // Calculate dimensions
    let maxWidth = 0;
    let totalHeight = 0;
    for (const line of lines) {
      maxWidth = Math.max(maxWidth, line.width);
      totalHeight += line.height;
    }

    const padding = this._canvasPadding;

    // 计算因 offset / 描边导致的溢出，防止内容被裁剪；
    // 描边宽度按各图层的实际渲染条件取值（与 renderBBCodeLayers 一致）
    let topOverflow = 0;
    let bottomOverflow = 0;
    let leftOverflow = 0;
    let rightOverflow = 0;
    for (const line of lines) {
      for (const unit of line.units) {
        const strokeWidths: number[] = [];
        if (unit.style.visible) {
          if (
            unit.style.stroke ||
            unit.style.outline ||
            unit.style.outlineBack
          ) {
            strokeWidths.push(unit.style.lineThickness * unit.style.fontSize);
          }
          if (
            unit.style.borderWidth &&
            !unit.style.stroke &&
            !unit.style.outline
          ) {
            strokeWidths.push(unit.style.borderWidth);
          }
        }
        const strokeWidth =
          strokeWidths.length > 0 ? Math.max(...strokeWidths) : 0;

        const offsetY = unit.style.offsetY;
        const visualTop = unit.y + offsetY - strokeWidth / 2;
        if (visualTop < 0) {
          topOverflow = Math.max(topOverflow, -visualTop);
        }

        const visualBottom = unit.y + unit.height + offsetY + strokeWidth / 2;
        const availableBottom = totalHeight + 2 + padding;
        if (visualBottom > availableBottom) {
          bottomOverflow = Math.max(
            bottomOverflow,
            visualBottom - availableBottom,
          );
        }

        const offsetX = unit.style.offsetX;
        const visualLeft = unit.x + offsetX - strokeWidth / 2;
        if (visualLeft < 0) {
          leftOverflow = Math.max(leftOverflow, -visualLeft);
        }

        const visualRight = unit.x + unit.width + offsetX + strokeWidth / 2;
        const availableRight = maxWidth + 2 + padding;
        if (visualRight > availableRight) {
          rightOverflow = Math.max(
            rightOverflow,
            visualRight - availableRight,
          );
        }
      }
    }

    // 额外增加一个与 unit.ascent 无关的最小顶部保护
    // 因为某些浏览器/字体的 actualBoundingBoxAscent 会偏小，导致 visualTop 计算不安全
    let maxFontSize = 0;
    for (const line of lines) {
      for (const unit of line.units) {
        maxFontSize = Math.max(maxFontSize, unit.style.fontSize);
      }
    }
    const minTopExtra = Math.max(8, Math.ceil(maxFontSize * 0.3));
    topOverflow = Math.max(topOverflow, minTopExtra);

    // 整体下移，为顶部溢出留出空间
    if (topOverflow > 0) {
      for (const line of lines) {
        for (const unit of line.units) {
          unit.y += topOverflow;
        }
      }
    }

    // 整体右移，为左侧溢出留出空间
    if (leftOverflow > 0) {
      for (const line of lines) {
        for (const unit of line.units) {
          unit.x += leftOverflow;
        }
      }
    }

    const originalWidth =
      maxWidth + 4 + padding * 2 + leftOverflow + rightOverflow;
    const originalHeight =
      totalHeight + 4 + padding * 2 + topOverflow + bottomOverflow;

    return {
      textureWidth: nextPowerOfTwo(originalWidth),
      textureHeight: nextPowerOfTwo(originalHeight),
      width: originalWidth,
      height: originalHeight,
      visualTop: padding + topOverflow,
      visualHeight: totalHeight,
      ascent: maxFontSize * 0.8,
      descent: maxFontSize * 0.2,
      bbcode: { lines, padding },
    };
  }

  private updateTexturePlain(): void {
    const layout = this._layout;
    if (!layout || !layout.plain) return;

    const canvas = this.ensureCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to create 2D context for canvas");
      return;
    }

    const { lines, topPadding, lineHeight, halfBorder } = layout.plain;
    const originalWidth = layout.width;

    canvas.width = layout.textureWidth;
    canvas.height = layout.textureHeight;

    canvas.height = this.textureHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyFont(ctx, this._fontWeight, this._fontStyle, this._fontSize, this._fontFamily);
    applyLetterSpacing(ctx, this._letterSpacing);
    ctx.textBaseline = "top";
    ctx.fillStyle = this._color;
    ctx.textAlign = this._align;

    let x = 2 + halfBorder;
    if (this._align === "center") {
      x = originalWidth / 2;
    } else if (this._align === "right") {
      x = originalWidth - 2 - halfBorder;
    }

    if (this._borderWidth > 0) {
      ctx.lineWidth = this._borderWidth;
      ctx.strokeStyle = this._borderColor;
      // round 连接避免 miter 在字形尖角处炸刺
      ctx.lineJoin = "round";
    }

    for (let i = 0; i < lines.length; i++) {
      const y = topPadding + 2 + halfBorder + i * lineHeight;
      if (this._borderWidth > 0) {
        ctx.strokeText(lines[i], x, y);
      }
      ctx.fillText(lines[i], x, y);
    }


    this.commitTexture(canvas);
  }

  private updateTextureBBCode(): void {
    const layout = this._layout;
    if (!layout || !layout.bbcode) return;

    const canvas = this.ensureCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to create 2D context for canvas");
      return;
    }

    canvas.width = layout.textureWidth;
    canvas.height = layout.textureHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render layers
    this.renderBBCodeLayers(ctx, layout.bbcode.lines);

    this.commitTexture(canvas);
  }

  /** 把已经画好的离屏 canvas 上传成纹理。两条路径共用。 */
  private commitTexture(canvas: HTMLCanvasElement): void {
    const textureManager = this.app.textureManager;

    const gen = ++this.textureUpdateGen;
    const previousTexture = this.texture;
    this.textureUploadPending = true;

    this.textureNeedsUpdate = false;
    this.previousText = this._text;

    this.app.enqueueGLTask(() => {
      if (this.destroyed) return;
      if (gen !== this.textureUpdateGen) return;

      if (previousTexture) {
        this.app.gl.deleteTexture(previousTexture);
      }

      this.texture = textureManager.createCanvasTexture(canvas, false);
      this.textureUploadPending = false;
    });
  }

  private buildRenderUnits(
    ctx: CanvasRenderingContext2D,
    segments: ParsedSegment[],
  ): RenderUnit[] {
    const units: RenderUnit[] = [];
    // Calculate line height ratio based on Text settings
    const lineHeightRatio =
      this._lineHeight === 0 ? 1.2 : this._lineHeight / this._fontSize;

    for (const segment of segments) {
      let style = createDefaultStyle(
        this._fontSize,
        this._fontFamily,
        this._color,
      );

      // Text 级 border 写入独立字段，与 lineThickness 解耦
      // （避免影响下划线/删除线粗细）；显式 [outline] 标签的 unit
      // 在渲染时优先使用标签轮廓（见 renderBBCodeLayers Layer 3）
      if (this._borderWidth > 0) {
        style.borderColor = this._borderColor;
        style.borderWidth = this._borderWidth;
      }

      // Apply tags
      for (const tag of segment.tags) {
        style = applyTagToStyle(style, tag, this._fontSize);
      }

      // Split by newlines
      const lines = segment.text.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0 && i < lines.length - 1) {
          // Empty line marker
          units.push({
            text: "",
            style: { ...style },
            x: 0,
            y: 0,
            width: 0,
            height: style.fontSize * lineHeightRatio,
            ascent: style.fontSize,
            lineIndex: -1, // Will be assigned during layout
          });
        } else if (line.length > 0) {
          ctx.font = buildFontString(style);
          const metrics = ctx.measureText(line);
          units.push({
            text: line,
            style: { ...style },
            x: 0,
            y: 0,
            width: metrics.width,
            height: style.fontSize * lineHeightRatio,
            ascent: Math.max(
              metrics.fontBoundingBoxAscent || 0,
              metrics.actualBoundingBoxAscent || 0,
              style.fontSize,
            ),
            lineIndex: -1,
          });
        }

        // Add line break marker (except for last line)
        if (i < lines.length - 1) {
          units.push({
            text: "",
            style: { ...style },
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            ascent: 0,
            lineIndex: -2, // Line break marker
          });
        }
      }
    }

    return units;
  }

  private layoutLines(units: RenderUnit[]): LineInfo[] {
    const lines: LineInfo[] = [];
    let currentLineUnits: RenderUnit[] = [];
    let currentLineWidth = 0;
    let currentLineHeight = 0;
    let currentBaseline = 0;

    for (const unit of units) {
      if (unit.lineIndex === -2) {
        // Line break
        if (currentLineUnits.length > 0) {
          lines.push({
            units: currentLineUnits,
            width: currentLineWidth,
            height: currentLineHeight,
            baseline: currentBaseline,
          });
        }
        currentLineUnits = [];
        currentLineWidth = 0;
        currentLineHeight = 0;
        currentBaseline = 0;
        continue;
      }

      // Check max width
      if (
        this._maxWidth > 0 &&
        currentLineWidth + unit.width > this._maxWidth &&
        currentLineUnits.length > 0
      ) {
        // Start new line
        lines.push({
          units: currentLineUnits,
          width: currentLineWidth,
          height: currentLineHeight,
          baseline: currentBaseline,
        });
        currentLineUnits = [];
        currentLineWidth = 0;
        currentLineHeight = 0;
        currentBaseline = 0;
      }

      // If unit itself exceeds maxWidth, split it by characters (like plain text)
      if (this._maxWidth > 0 && unit.width > this._maxWidth) {
        // Flush current line first if it has content
        if (currentLineUnits.length > 0) {
          lines.push({
            units: currentLineUnits,
            width: currentLineWidth,
            height: currentLineHeight,
            baseline: currentBaseline,
          });
          currentLineUnits = [];
          currentLineWidth = 0;
          currentLineHeight = 0;
          currentBaseline = 0;
        }

        // Split the long unit by characters - similar to plain text approach
        const chars = unit.text.split("");
        let charLine = "";
        let charWidth = 0;
        const ctx = this.canvas!.getContext("2d")!;
        ctx.font = buildFontString(unit.style);

        for (const char of chars) {
          const charW = ctx.measureText(char).width;

          if (charWidth + charW <= this._maxWidth) {
            charLine += char;
            charWidth += charW;
          } else {
            // Flush current char line as a complete line
            if (charLine.length > 0) {
              const charUnit: RenderUnit = {
                text: charLine,
                style: { ...unit.style },
                x: 0,
                y: 0,
                width: charWidth,
                height: unit.height,
                ascent: unit.ascent,
                lineIndex: lines.length,
              };
              lines.push({
                units: [charUnit],
                width: charWidth,
                height: unit.height,
                baseline: unit.ascent,
              });
            }
            charLine = char;
            charWidth = charW;
          }
        }

        // Remaining chars become the "current line" (like plain text's currentLine)
        // This allows the remaining chars to potentially merge with the next unit
        if (charLine.length > 0) {
          const charUnit: RenderUnit = {
            text: charLine,
            style: { ...unit.style },
            x: 0,
            y: 0,
            width: charWidth,
            height: unit.height,
            ascent: unit.ascent,
            lineIndex: lines.length,
          };
          currentLineUnits.push(charUnit);
          currentLineWidth = charWidth;
          currentLineHeight = unit.height;
          currentBaseline = unit.ascent;
        }
        continue;
      }

      // Add to current line
      unit.lineIndex = lines.length;
      currentLineUnits.push(unit);
      currentLineWidth += unit.width;
      currentLineHeight = Math.max(currentLineHeight, unit.height);
      currentBaseline = Math.max(currentBaseline, unit.ascent);
    }

    // Add last line
    if (currentLineUnits.length > 0) {
      lines.push({
        units: currentLineUnits,
        width: currentLineWidth,
        height: currentLineHeight,
        baseline: currentBaseline,
      });
    }

    // Calculate max content width for alignment
    let maxContentWidth = 0;
    for (const line of lines) {
      maxContentWidth = Math.max(maxContentWidth, line.width);
    }
    // Use maxWidth if set, otherwise use content width
    const containerWidth =
      this._maxWidth > 0 ? this._maxWidth : maxContentWidth;

    // Calculate positions with padding
    const padding = this._canvasPadding;
    let y = 2 + padding;
    for (const line of lines) {
      let x = 2 + padding;

      if (this._align === "center") {
        x = 2 + padding + (containerWidth - line.width) / 2;
      } else if (this._align === "right") {
        x = 2 + padding + containerWidth - line.width;
      }

      for (const unit of line.units) {
        unit.x = x;
        unit.y = y + (line.baseline - unit.ascent);
        // Resolve percentage offsetY
        if (unit.style.offsetYIsPercentage) {
          unit.style.offsetY = unit.style.offsetY * line.height;
        }
        x += unit.width;
      }

      y += line.height;
    }

    return lines;
  }

  private renderBBCodeLayers(
    ctx: CanvasRenderingContext2D,
    lines: LineInfo[],
  ): void {
    // Layer 0: outlineback
    for (const line of lines) {
      for (const unit of line.units) {
        if (unit.style.outlineBack && unit.style.visible) {
          this.renderOutlineBack(ctx, unit);
        }
      }
    }

    // Layer 1: background
    for (const line of lines) {
      for (const unit of line.units) {
        if (unit.style.background && unit.style.visible) {
          ctx.fillStyle = unit.style.background;
          ctx.fillRect(unit.x, unit.y, unit.width, unit.height);
        }
      }
    }

    // Layer 2: stroke (hollow text)
    for (const line of lines) {
      for (const unit of line.units) {
        if (unit.style.stroke && unit.style.visible) {
          this.renderStrokedText(ctx, unit);
        }
      }
    }

    // Layer 3: outline (on top)
    // 显式 [outline] 标签优先（宽度取 lineThickness）；
    // 否则应用 Text 级 border（独立 borderWidth，单位 px）
    for (const line of lines) {
      for (const unit of line.units) {
        if (!unit.style.visible || unit.style.stroke) continue;
        if (unit.style.outline) {
          this.renderOutlinedText(
            ctx,
            unit,
            unit.style.outline,
            unit.style.lineThickness * unit.style.fontSize,
          );
        } else if (unit.style.borderWidth && unit.style.borderColor) {
          this.renderOutlinedText(
            ctx,
            unit,
            unit.style.borderColor,
            unit.style.borderWidth,
          );
        }
      }
    }

    // Layer 4: fill + decorations
    for (const line of lines) {
      for (const unit of line.units) {
        if (!unit.style.stroke && unit.style.visible) {
          this.renderFilledText(ctx, unit);
        }

        if (unit.style.underline && unit.style.visible) {
          this.renderUnderline(ctx, unit);
        }

        if (unit.style.strikethrough && unit.style.visible) {
          this.renderStrikethrough(ctx, unit);
        }
      }
    }
  }

  private renderOutlineBack(
    ctx: CanvasRenderingContext2D,
    unit: RenderUnit,
  ): void {
    if (!unit.style.outlineBack) return;

    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = unit.style.lineThickness * unit.style.fontSize;
    ctx.strokeStyle = unit.style.outlineBack;
    ctx.lineJoin = "round";
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.strokeText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderStrokedText(
    ctx: CanvasRenderingContext2D,
    unit: RenderUnit,
  ): void {
    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = unit.style.lineThickness * unit.style.fontSize;
    ctx.strokeStyle = unit.style.color;
    ctx.lineJoin = "round";
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.strokeText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderOutlinedText(
    ctx: CanvasRenderingContext2D,
    unit: RenderUnit,
    outlineColor: string,
    lineWidth: number,
  ): void {
    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = outlineColor;
    // round 连接避免 miter 在字形尖角（W/A/M/V 等）处炸刺冲出画布
    ctx.lineJoin = "round";
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.strokeText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderFilledText(
    ctx: CanvasRenderingContext2D,
    unit: RenderUnit,
  ): void {
    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = unit.style.color;
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.fillText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderUnderline(
    ctx: CanvasRenderingContext2D,
    unit: RenderUnit,
  ): void {
    const thickness = unit.style.lineThickness * unit.style.fontSize;
    const y = unit.y + unit.ascent + thickness;

    ctx.strokeStyle = unit.style.color;
    ctx.lineWidth = thickness;
    ctx.globalAlpha = unit.style.opacity / 100;

    ctx.beginPath();
    ctx.moveTo(unit.x + unit.style.offsetX, y + unit.style.offsetY);
    ctx.lineTo(
      unit.x + unit.width + unit.style.offsetX,
      y + unit.style.offsetY,
    );
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  private renderStrikethrough(
    ctx: CanvasRenderingContext2D,
    unit: RenderUnit,
  ): void {
    const thickness = unit.style.lineThickness * unit.style.fontSize;
    const y = unit.y + unit.ascent * 0.6;

    ctx.strokeStyle = unit.style.color;
    ctx.lineWidth = thickness;
    ctx.globalAlpha = unit.style.opacity / 100;

    ctx.beginPath();
    ctx.moveTo(unit.x + unit.style.offsetX, y + unit.style.offsetY);
    ctx.lineTo(
      unit.x + unit.width + unit.style.offsetX,
      y + unit.style.offsetY,
    );
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  override destroy(): void {
    super.destroy();

    // 释放纹理
    if (this.texture) {
      const textureToDelete = this.texture;
      this.texture = null;
      this.app.enqueueGLTask(() => {
        this.app.gl.deleteTexture(textureToDelete);
      });
    }
    this.textureUploadPending = false;
    this.textureUpdateGen++;
  }

  render(matrix: Matrix): void {
    // 如果文本为空，不需要渲染
    if (!this._text || this._text.length === 0) return;

    // Text 会重新切回 TinyUI 的 shader program，必须同步把当前节点矩阵
    // 和分辨率 uniform 重写到这个 program 上，否则首个 Text 可能沿用宿主引擎
    // 或上一个 program 的 uniform 状态，表现为首个文本缩放异常。
    this.app.applyShaderUniformState(matrix);

    // 如果文本纹理不存在或文本内容变化，重新生成纹理
    if (this.textureNeedsUpdate) {
      this.updateTexture();
    }

    // 如果纹理未就绪（首次渲染 upload 排队中，或在 safe section 外），跳过渲染
    if (!this.texture || this.textureUploadPending) {
      return;
    }

    const gl = this.app.gl;

    // 顶点位置 (矩形)
    const positions = [
      0,
      0,
      this.width,
      0,
      this.width,
      this.height,
      0,
      this.height,
    ];

    // 计算纹理坐标比例 - 实际内容与Power-of-2尺寸的比例
    const texCoordX = this.width / this.textureWidth;
    const texCoordY = this.height / this.textureHeight;

    // 纹理坐标 (矩形) - 只使用纹理的一部分
    const texCoords = [0, 0, texCoordX, 0, texCoordX, texCoordY, 0, texCoordY];

    // 顶点颜色 (应用透明度)
    const colors = [
      1,
      1,
      1,
      this.alpha,
      1,
      1,
      1,
      this.alpha,
      1,
      1,
      1,
      this.alpha,
      1,
      1,
      1,
      this.alpha,
    ];

    // 索引 (两个三角形)
    const indices = [0, 1, 2, 0, 2, 3];

    // 使用纹理
    gl.uniform1i(this.app._useTextureLocation, 1);

    // 绑定纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.app._imageLocation, 0);

    // 设置缓冲区数据
    this.app._setBufferData(positions, texCoords, colors, indices);

    // 绘制
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
}
