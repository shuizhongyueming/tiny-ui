import { DisplayObject } from "./DisplayObject";
import { type TinyUI } from "./TinyUI";

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
      this.width = right - left;
      this.height = bottom - top;
      this.x = left + this.width / 2;
      this.y = top + this.height / 2;
    } else {
      // 扩展显示对象边界以包含新图形
      if (left < this.x - this.width * this.anchorX) {
        const newWidth = (this.x - this.width * this.anchorX + this.width) - left;
        this.x = left + newWidth / 2;
        this.width = newWidth;
      }
      if (top < this.y - this.height * this.anchorY) {
        const newHeight = (this.y - this.height * this.anchorY + this.height) - top;
        this.y = top + newHeight / 2;
        this.height = newHeight;
      }
      if (right > this.x - this.width * this.anchorX + this.width) {
        this.width = right - (this.x - this.width * this.anchorX);
      }
      if (bottom > this.y - this.height * this.anchorY + this.height) {
        this.height = bottom - (this.y - this.height * this.anchorY);
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
      this.width = width;
      this.height = height;
      this.x = left + width / 2;
      this.y = top + height / 2;
    } else {
      // 扩展显示对象边界以包含新图形
      if (left < this.x - this.width * this.anchorX) {
        const newWidth = (this.x - this.width * this.anchorX + this.width) - left;
        this.x = left + newWidth / 2;
        this.width = newWidth;
      }
      if (top < this.y - this.height * this.anchorY) {
        const newHeight = (this.y - this.height * this.anchorY + this.height) - top;
        this.y = top + newHeight / 2;
        this.height = newHeight;
      }
      if (right > this.x - this.width * this.anchorX + this.width) {
        this.width = right - (this.x - this.width * this.anchorX);
      }
      if (bottom > this.y - this.height * this.anchorY + this.height) {
        this.height = bottom - (this.y - this.height * this.anchorY);
      }
    }

    return this;
  }

  override destroy(): void {
    super.destroy();
    this.commands = [];
  }
}
