import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";

type FontWeight = 'normal' | 'bold';
type TextAlign = 'left' | 'center' | 'right';

export class Text extends DisplayObject {
  private _text: string = '';
  private _color: string = '#000000';
  private _fontFamily: string = 'Arial';
  private _fontSize: number = 16;
  private _lineHeight: number = 0; // 0 表示自动计算
  private _fontWeight: FontWeight = 'normal';
  private _maxWidth: number = 0; // 0 表示无限制
  private _align: TextAlign = 'left';

  texture: WebGLTexture | null = null;
  textureNeedsUpdate: boolean = true;
  private previousText: string = '';

  constructor(app: TinyUI, name: string = 'Text') {
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

  set color(color: string) {
    if (this._color !== color) {
      this._color = color;
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
      this.width = 0;
      this.height = 0;
      this.textureNeedsUpdate = false;
      this.previousText = '';
      return;
    }

    // 如果文本内容没有变化，不需要更新
    if (!this.textureNeedsUpdate && this.previousText === this._text) {
      return;
    }

    // 创建离屏canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Failed to create 2D context for canvas');
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
    const linesFromBreaks = this._text.split('\n');

    if (this._maxWidth > 0) {
      // 多行文本处理 - 需要考虑手动换行和自动换行
      for (const lineText of linesFromBreaks) {
        if (lineText.length === 0) {
          // 空行直接添加
          lines.push('');
          continue;
        }

        const words = lineText.split(' ');
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const width = ctx.measureText(currentLine + ' ' + word).width;

          if (width < this._maxWidth) {
            currentLine += ' ' + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }

        lines.push(currentLine);
      }

      textWidth = this._maxWidth;
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
    canvas.width = textWidth + 4;
    canvas.height = textHeight + 4;

    // 清除canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 重新设置字体 (因为canvas尺寸改变后会重置字体)
    ctx.font = `${this._fontWeight} ${this._fontSize}px ${this._fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = this._color;
    ctx.textAlign = this._align;

    // 计算对齐位置
    let x = 2;
    if (this._align === 'center') {
      x = canvas.width / 2;
    } else if (this._align === 'right') {
      x = canvas.width - 2;
    }

    // 绘制文本
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, i * effectiveLineHeight + 2);
    }

    // 更新对象尺寸
    this.width = canvas.width;
    this.height = canvas.height;

    // 删除旧纹理
    if (this.texture) {
      gl.deleteTexture(this.texture);
    }

    // 创建新纹理
    this.texture = textureManager.createCanvasTexture(canvas);

    // 更新状态
    this.textureNeedsUpdate = false;
    this.previousText = this._text;
  }

  override destroy(): void {
    super.destroy();

    // 释放纹理
    if (this.texture) {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') as WebGLRenderingContext;
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
      0, 0,
      this.width, 0,
      this.width, this.height,
      0, this.height,
    ];

    // 纹理坐标 (矩形)
    const texCoords = [
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ];

    // 顶点颜色 (应用透明度)
    const colors = [
      1, 1, 1, this.alpha,
      1, 1, 1, this.alpha,
      1, 1, 1, this.alpha,
      1, 1, 1, this.alpha,
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
