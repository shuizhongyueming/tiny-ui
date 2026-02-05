import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
import { nextPowerOfTwo } from "./utils/Power2";

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
  private textureWidth: number = 0;
  private textureHeight: number = 0;
  private previousText: string = "";
  private canvas: HTMLCanvasElement | null = null;

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

  updateTexture(): void {
    const gl = this.app.gl;
    const textureManager = this.app.textureManager;
    // 如果文本为空，清除纹理
    if (!this._text || this._text.length === 0) {
      if (this.texture) {
        gl.deleteTexture(this.texture);
        this.texture = null;
      }
      this.setWidth(0);
      this.setHeight(0);
      this.textureNeedsUpdate = false;
      this.previousText = "";
      return;
    }

    // 如果文本内容没有变化，不需要更新
    if (!this.textureNeedsUpdate && this.previousText === this._text) {
      return;
    }

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }

    // 创建离屏canvas
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("Failed to create 2D context for canvas");
      return;
    }

    // 设置字体
    ctx.font = `${this._fontWeight} ${this._fontSize}px ${this._fontFamily}`;

    // 计算行高 - 如果没有设置，使用默认的1.2倍字体大小
    const effectiveLineHeight = this.lineHeight;

    // 计算文本尺寸
    let textWidth: number;
    let textHeight: number;
    let lines: string[] = [];

    // 首先处理换行符
    const linesFromBreaks = this._text.split("\n");

    if (this._maxWidth > 0) {
      // 多行文本处理 - 需要考虑手动换行和自动换行
      for (const lineText of linesFromBreaks) {
        if (lineText.length === 0) {
          // 空行直接添加
          lines.push("");
          continue;
        }

        const words = lineText.split(" ");
        let currentLine = "";

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine =
            currentLine.length === 0 ? word : currentLine + " " + word;
          const width = ctx.measureText(testLine).width;

          if (width <= this._maxWidth) {
            currentLine = testLine;
          } else {
            // 如果当前行不为空，先推入当前行
            if (currentLine.length > 0) {
              lines.push(currentLine);
              currentLine = "";
            }

            // 处理单个超长单词 - 按字符强制换行
            const wordWidth = ctx.measureText(word).width;
            if (wordWidth > this._maxWidth) {
              let charLine = "";
              for (let j = 0; j < word.length; j++) {
                const char = word[j];
                const testCharLine = charLine + char;
                const charWidth = ctx.measureText(testCharLine).width;

                if (charWidth <= this._maxWidth) {
                  charLine = testCharLine;
                } else {
                  if (charLine.length > 0) {
                    lines.push(charLine);
                  }
                  charLine = char;
                }
              }
              if (charLine.length > 0) {
                currentLine = charLine;
              }
            } else {
              // 单词未超长，作为新行开始
              currentLine = word;
            }
          }
        }

        // 推入最后一行
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
      }

      // 计算实际最长行的宽度，而不是直接使用 maxWidth
      let maxLineWidth = 0;
      for (const line of lines) {
        const metrics = ctx.measureText(line);
        maxLineWidth = Math.max(maxLineWidth, metrics.width);
      }
      textWidth = maxLineWidth;
      textHeight = lines.length * effectiveLineHeight;
    } else {
      // 单行文本处理 - 但仍然需要处理手动换行符
      lines = linesFromBreaks;
      let maxLineWidth = 0;

      for (const line of lines) {
        const metrics = ctx.measureText(line);
        maxLineWidth = Math.max(maxLineWidth, metrics.width);
      }

      textWidth = maxLineWidth;
      textHeight = lines.length * effectiveLineHeight;
    }

    // 设置canvas尺寸 (增加一点边距)
    const originalWidth = textWidth + 4;
    const originalHeight = textHeight + 4;

    // 设置canvas尺寸为2的指数
    // 这样可以确保纹理尺寸为2的指数，提高性能和缩放效果
    this.textureWidth = nextPowerOfTwo(originalWidth);
    this.textureHeight = nextPowerOfTwo(originalHeight);

    canvas.width = this.textureWidth;
    canvas.height = this.textureHeight;

    // 清除canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 重新设置字体 (因为canvas尺寸改变后会重置字体)
    ctx.font = `${this._fontWeight} ${this._fontSize}px ${this._fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = this._color;
    ctx.textAlign = this._align;

    // 计算对齐位置
    let x = 2;
    if (this._align === "center") {
      x = originalWidth / 2;
    } else if (this._align === "right") {
      x = originalWidth - 2;
    }

    // 绘制文本
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, i * effectiveLineHeight + 2);
    }

    // 更新对象尺寸
    // 但是对象的宽高仍然使用原始尺寸
    // 这样用户使用的时候，不会有奇怪的空白
    this.setWidth(originalWidth);
    this.setHeight(originalHeight);

    // 删除旧纹理
    if (this.texture) {
      gl.deleteTexture(this.texture);
    }

    // 创建新纹理
    this.texture = textureManager.createCanvasTexture(canvas, false);

    // 更新状态
    this.textureNeedsUpdate = false;
    this.previousText = this._text;
  }

  override destroy(): void {
    super.destroy();

    // 释放纹理
    if (this.texture) {
      const gl = this.app.gl;
      gl.deleteTexture(this.texture);
      this.texture = null;
    }
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
