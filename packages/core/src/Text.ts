import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
import { nextPowerOfTwo } from "./utils/Power2";
import { BBCodeParser } from "./utils/BBCodeParser";
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

export class Text extends DisplayObject {
  private _text: string = "";
  private _color: string = "#000000";
  private _fontFamily: string = "Arial";
  private _fontSize: number = 16;
  private _lineHeight: number = 0; // 0 表示自动计算
  private _fontWeight: FontWeight = "normal";
  private _maxWidth: number = 0; // 0 表示无限制
  private _align: TextAlign = "left";

  texture: WebGLTexture | null = null;
  textureNeedsUpdate: boolean = true;
  private textureUploadPending: boolean = false;
  private textureUpdateGen: number = 0;
  private textureWidth: number = 0;
  private textureHeight: number = 0;
  private previousText: string = "";
  private canvas: HTMLCanvasElement | null = null;
  private _bbcodeEnabled: boolean = false;
  private _canvasPadding: number = 10;
  private parser: BBCodeParser = new BBCodeParser();

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

  get maxWidth(): number {
    return this._maxWidth;
  }

  get align(): TextAlign {
    return this._align;
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
    if (this._fontFamily !== fontFamily) {
      this._fontFamily = fontFamily;
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
    // 如果文本为空，清除纹理
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

    // 如果文本内容没有变化，不需要更新
    if (!this.textureNeedsUpdate && this.previousText === this._text) {
      return;
    }

    if (this._bbcodeEnabled) {
      this.updateTextureBBCode();
    } else {
      this.updateTexturePlain();
    }
  }

  private updateTexturePlain(): void {
    const textureManager = this.app.textureManager;

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }

    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("Failed to create 2D context for canvas");
      return;
    }

    ctx.font = `${this._fontWeight} ${this._fontSize}px ${this._fontFamily}`;

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

      let maxLineWidth = 0;
      for (const line of lines) {
        maxLineWidth = Math.max(maxLineWidth, getTextWidth(line));
      }
      textWidth = maxLineWidth;
      textHeight = lines.length * effectiveLineHeight;
    } else {
      lines = linesFromBreaks;

      for (const line of lines) {
        getTextWidth(line);
      }

      let maxLineWidth = 0;
      for (const line of lines) {
        maxLineWidth = Math.max(maxLineWidth, getTextWidth(line));
      }

      textWidth = maxLineWidth;
      textHeight = lines.length * effectiveLineHeight;
    }

    const originalWidth = textWidth + 4;
    const originalHeight = textHeight + 4;

    this.textureWidth = nextPowerOfTwo(originalWidth);
    this.textureHeight = nextPowerOfTwo(originalHeight);

    canvas.width = this.textureWidth;
    canvas.height = this.textureHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${this._fontWeight} ${this._fontSize}px ${this._fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = this._color;
    ctx.textAlign = this._align;

    let x = 2;
    if (this._align === "center") {
      x = originalWidth / 2;
    } else if (this._align === "right") {
      x = originalWidth - 2;
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, i * effectiveLineHeight + 2);
    }

    this.setWidth(originalWidth);
    this.setHeight(originalHeight);

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

    widthCache.clear();
  }

  private updateTextureBBCode(): void {
    const textureManager = this.app.textureManager;

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }

    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("Failed to create 2D context for canvas");
      return;
    }

    // Parse BBCode
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

    const originalWidth = maxWidth + 4 + this._canvasPadding * 2;
    const originalHeight = totalHeight + 4 + this._canvasPadding * 2;

    this.textureWidth = nextPowerOfTwo(originalWidth);
    this.textureHeight = nextPowerOfTwo(originalHeight);

    canvas.width = this.textureWidth;
    canvas.height = this.textureHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render layers
    this.renderBBCodeLayers(ctx, lines);

    this.setWidth(originalWidth);
    this.setHeight(originalHeight);

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
    segments: ParsedSegment[]
  ): RenderUnit[] {
    const units: RenderUnit[] = [];
    // Calculate line height ratio based on Text settings
    const lineHeightRatio = this._lineHeight === 0 ? 1.2 : this._lineHeight / this._fontSize;

    for (const segment of segments) {
      let style = createDefaultStyle(
        this._fontSize,
        this._fontFamily,
        this._color
      );

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
            ascent: metrics.actualBoundingBoxAscent || style.fontSize * 0.8,
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
        const chars = unit.text.split('');
        let charLine = '';
        let charWidth = 0;
        const ctx = this.canvas!.getContext('2d')!;
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
    const containerWidth = this._maxWidth > 0 ? this._maxWidth : maxContentWidth;

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

  private renderBBCodeLayers(ctx: CanvasRenderingContext2D, lines: LineInfo[]): void {
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
    for (const line of lines) {
      for (const unit of line.units) {
        if (unit.style.outline && unit.style.visible && !unit.style.stroke) {
          this.renderOutlinedText(ctx, unit, unit.style.outline);
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

  private renderOutlineBack(ctx: CanvasRenderingContext2D, unit: RenderUnit): void {
    if (!unit.style.outlineBack) return;

    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = unit.style.lineThickness * unit.style.fontSize;
    ctx.strokeStyle = unit.style.outlineBack;
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.strokeText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderStrokedText(ctx: CanvasRenderingContext2D, unit: RenderUnit): void {
    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = unit.style.lineThickness * unit.style.fontSize;
    ctx.strokeStyle = unit.style.color;
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.strokeText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderOutlinedText(
    ctx: CanvasRenderingContext2D,
    unit: RenderUnit,
    outlineColor: string
  ): void {
    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = unit.style.lineThickness * unit.style.fontSize;
    ctx.strokeStyle = outlineColor;
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.strokeText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderFilledText(ctx: CanvasRenderingContext2D, unit: RenderUnit): void {
    ctx.font = buildFontString(unit.style);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = unit.style.color;
    ctx.globalAlpha = unit.style.opacity / 100;

    const x = unit.x + unit.style.offsetX;
    const y = unit.y + unit.ascent + unit.style.offsetY;

    ctx.fillText(unit.text, x, y);

    ctx.globalAlpha = 1;
  }

  private renderUnderline(ctx: CanvasRenderingContext2D, unit: RenderUnit): void {
    const thickness = unit.style.lineThickness * unit.style.fontSize;
    const y = unit.y + unit.ascent + thickness;

    ctx.strokeStyle = unit.style.color;
    ctx.lineWidth = thickness;
    ctx.globalAlpha = unit.style.opacity / 100;

    ctx.beginPath();
    ctx.moveTo(unit.x + unit.style.offsetX, y + unit.style.offsetY);
    ctx.lineTo(unit.x + unit.width + unit.style.offsetX, y + unit.style.offsetY);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  private renderStrikethrough(ctx: CanvasRenderingContext2D, unit: RenderUnit): void {
    const thickness = unit.style.lineThickness * unit.style.fontSize;
    const y = unit.y + unit.ascent * 0.6;

    ctx.strokeStyle = unit.style.color;
    ctx.lineWidth = thickness;
    ctx.globalAlpha = unit.style.opacity / 100;

    ctx.beginPath();
    ctx.moveTo(unit.x + unit.style.offsetX, y + unit.style.offsetY);
    ctx.lineTo(unit.x + unit.width + unit.style.offsetX, y + unit.style.offsetY);
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

  render(_matrix: Matrix): void {
    // 如果文本为空，不需要渲染
    if (!this._text || this._text.length === 0) return;

    // 如果文本纹理不存在或文本内容变化，重新生成纹理
    if (!this.texture || this.textureNeedsUpdate) {
      this.updateTexture();
    }

    if (!this.texture) return;

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
