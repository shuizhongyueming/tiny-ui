import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";

// 基础图形命令接口
interface GraphicsCommandBase {
  type: string;
}

// 矩形命令接口
export interface GraphicsCommandRect extends GraphicsCommandBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
}

// 圆形命令接口
export interface GraphicsCommandCircle extends GraphicsCommandBase {
  type: 'circle';
  x: number;
  y: number;
  radius: number;
  fillColor: string;
}

// 图形命令联合类型
export type GraphicsCommand = GraphicsCommandRect | GraphicsCommandCircle;

export class Graphics extends DisplayObject {
  commands: GraphicsCommand[] = [];

  constructor(app: TinyUI, name: string = 'Graphics') {
    super(app, name);
  }

  clear(): Graphics {
    this.commands = [];
    return this;
  }

  drawCircle(x: number, y: number, radius: number, fillColor: string): Graphics {
    this.commands.push({
      type: 'circle',
      x,
      y,
      radius,
      fillColor
    });

    // 更新显示对象尺寸
    const left = x - radius;
    const top = y - radius;
    const right = x + radius;
    const bottom = y + radius;

    if (this.commands.length === 1) {
      this.setWidth(right - left);
      this.setHeight(bottom - top);
      this.x = left + this.width / 2;
      this.y = top + this.height / 2;
    } else {
      // 扩展显示对象边界以包含新图形
      if (left < this.x - this.width * this.anchorX) {
        const newWidth = (this.x - this.width * this.anchorX + this.width) - left;
        this.x = left + newWidth / 2;
        this.setWidth(newWidth);
      }
      if (top < this.y - this.height * this.anchorY) {
        const newHeight = (this.y - this.height * this.anchorY + this.height) - top;
        this.y = top + newHeight / 2;
        this.setHeight(newHeight);
      }
      if (right > this.x - this.width * this.anchorX + this.width) {
        this.setWidth(right - (this.x - this.width * this.anchorX));
      }
      if (bottom > this.y - this.height * this.anchorY + this.height) {
        this.setHeight(bottom - (this.y - this.height * this.anchorY));
      }
    }

    return this;
  }

  drawRect(x: number, y: number, width: number, height: number, fillColor: string): Graphics {
    this.commands.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      fillColor
    });

    // 更新显示对象尺寸
    const left = x;
    const top = y;
    const right = x + width;
    const bottom = y + height;

    if (this.commands.length === 1) {
      this.setWidth(width);
      this.setHeight(height);
      this.x = left + width / 2;
      this.y = top + height / 2;
    } else {
      // 扩展显示对象边界以包含新图形
      if (left < this.x - this.width * this.anchorX) {
        const newWidth = (this.x - this.width * this.anchorX + this.width) - left;
        this.x = left + newWidth / 2;
        this.setWidth(newWidth);
      }
      if (top < this.y - this.height * this.anchorY) {
        const newHeight = (this.y - this.height * this.anchorY + this.height) - top;
        this.y = top + newHeight / 2;
        this.setHeight(newHeight);
      }
      if (right > this.x - this.width * this.anchorX + this.width) {
        this.setWidth(right - (this.x - this.width * this.anchorX));
      }
      if (bottom > this.y - this.height * this.anchorY + this.height) {
        this.setHeight(bottom - (this.y - this.height * this.anchorY));
      }
    }

    return this;
  }

  override destroy(): void {
    super.destroy();
    this.commands = [];
  }

  render(_matrix: Matrix): void {
    if (this.commands.length === 0) return;

    const gl = this.app.gl;

    // 不使用纹理
    gl.uniform1i(this.app._useTextureLocation, 0);

    for (const cmd of this.commands) {
      if (cmd.type === 'rect') {
        // 顶点位置 (矩形)
        const positions = [
          cmd.x, cmd.y,
          cmd.x + cmd.width, cmd.y,
          cmd.x + cmd.width, cmd.y + cmd.height,
          cmd.x, cmd.y + cmd.height,
        ];

        // 纹理坐标 (不使用，但仍需设置)
        const texCoords = [
          0, 0,
          1, 0,
          1, 1,
          0, 1,
        ];

        // 解析颜色值
        const color = this.app.parseColor(cmd.fillColor);

        // 顶点颜色
        const colors = [
          color.r, color.g, color.b, color.a * this.alpha,
          color.r, color.g, color.b, color.a * this.alpha,
          color.r, color.g, color.b, color.a * this.alpha,
          color.r, color.g, color.b, color.a * this.alpha,
        ];

        // 索引 (两个三角形)
        const indices = [0, 1, 2, 0, 2, 3];

        // 设置缓冲区数据
        this.app._setBufferData(positions, texCoords, colors, indices);

        // 绘制
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
      else if (cmd.type === 'circle') {
        // 生成圆形顶点
        const segments = 40; // 分段数
        const positions: number[] = [];
        const texCoords: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        // 解析颜色值
        const color = this.app.parseColor(cmd.fillColor);

        // 圆心
        positions.push(cmd.x, cmd.y);
        texCoords.push(0.5, 0.5);
        colors.push(color.r, color.g, color.b, color.a * this.alpha);

        // 外围顶点
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = cmd.x + Math.cos(angle) * cmd.radius;
          const y = cmd.y + Math.sin(angle) * cmd.radius;

          positions.push(x, y);
          texCoords.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
          colors.push(color.r, color.g, color.b, color.a * this.alpha);

          if (i > 0) {
            indices.push(0, i, i + 1);
          }
        }

        // 设置缓冲区数据
        this.app._setBufferData(positions, texCoords, colors, indices);

        // 绘制
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      }
    }
  }
}
