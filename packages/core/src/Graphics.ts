import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";

// 基础图形命令接口
interface GraphicsCommandBase {
  type: string;
}

// 矩形命令接口
export interface GraphicsCommandRect extends GraphicsCommandBase {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string | number;
}

// 圆形命令接口
export interface GraphicsCommandCircle extends GraphicsCommandBase {
  type: "circle";
  x: number;
  y: number;
  radius: number;
  fillColor: string | number;
}

// 圆角矩形命令接口
export interface GraphicsCommandRoundedRect extends GraphicsCommandBase {
  type: "roundedRect";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number | { tl: number; tr: number; br: number; bl: number };
  fillColor: string | number;
}

// 图形命令联合类型
export type GraphicsCommand =
  | GraphicsCommandRect
  | GraphicsCommandCircle
  | GraphicsCommandRoundedRect;

export class Graphics extends DisplayObject {
  commands: GraphicsCommand[] = [];

  constructor(app: TinyUI, name: string = "Graphics") {
    super(app, name);
  }

  clear(): Graphics {
    this.commands = [];
    return this;
  }

  drawCircle(
    x: number,
    y: number,
    radius: number,
    fillColor: string | number,
  ): Graphics {
    // 相对坐标 - x和y是相对于当前图形的锚点
    this.commands.push({
      type: "circle",
      x,
      y,
      radius,
      fillColor,
    });

    // 计算相对于锚点的边界
    const left = x - radius;
    const top = y - radius;
    const right = x + radius;
    const bottom = y + radius;

    // 更新显示对象尺寸，但不更新位置
    if (this.commands.length === 1) {
      this.setWidth(right - left);
      this.setHeight(bottom - top);
    } else {
      // 计算需要的最小宽高
      const minLeft = Math.min(left, -this.width * this.anchorX);
      const minTop = Math.min(top, -this.height * this.anchorY);
      const maxRight = Math.max(right, this.width * (1 - this.anchorX));
      const maxBottom = Math.max(bottom, this.height * (1 - this.anchorY));

      // 设置新的宽高
      this.setWidth(maxRight - minLeft);
      this.setHeight(maxBottom - minTop);
    }

    return this;
  }

  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: string | number,
  ): Graphics {
    // 相对坐标 - x和y是相对于当前图形的锚点
    this.commands.push({
      type: "rect",
      x,
      y,
      width,
      height,
      fillColor,
    });

    // 计算相对于锚点的边界
    const left = x;
    const top = y;
    const right = x + width;
    const bottom = y + height;

    // 更新显示对象尺寸，但不更新位置
    if (this.commands.length === 1) {
      this.setWidth(width);
      this.setHeight(height);
    } else {
      // 计算需要的最小宽高
      const minLeft = Math.min(left, -this.width * this.anchorX);
      const minTop = Math.min(top, -this.height * this.anchorY);
      const maxRight = Math.max(right, this.width * (1 - this.anchorX));
      const maxBottom = Math.max(bottom, this.height * (1 - this.anchorY));

      // 设置新的宽高
      this.setWidth(maxRight - minLeft);
      this.setHeight(maxBottom - minTop);
    }

    return this;
  }

  drawRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number | { tl: number; tr: number; br: number; bl: number },
    fillColor: string | number,
  ): Graphics {
    // 标准化 radius
    const r =
      typeof radius === "number"
        ? { tl: radius, tr: radius, br: radius, bl: radius }
        : radius;

    // 验证半径
    const maxRadius = Math.min(width, height) / 2;
    const normalizedR = {
      tl: Math.min(r.tl, maxRadius),
      tr: Math.min(r.tr, maxRadius),
      br: Math.min(r.br, maxRadius),
      bl: Math.min(r.bl, maxRadius),
    };

    this.commands.push({
      type: "roundedRect",
      x,
      y,
      width,
      height,
      radius: normalizedR,
      fillColor,
    });

    // 计算边界（同 drawRect）
    const left = x;
    const top = y;
    const right = x + width;
    const bottom = y + height;

    // 更新显示对象尺寸
    if (this.commands.length === 1) {
      this.setWidth(width);
      this.setHeight(height);
    } else {
      const minLeft = Math.min(left, -this.width * this.anchorX);
      const minTop = Math.min(top, -this.height * this.anchorY);
      const maxRight = Math.max(right, this.width * (1 - this.anchorX));
      const maxBottom = Math.max(bottom, this.height * (1 - this.anchorY));

      this.setWidth(maxRight - minLeft);
      this.setHeight(maxBottom - minTop);
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
      if (cmd.type === "rect") {
        // 顶点位置 (矩形)
        const positions = [
          cmd.x,
          cmd.y,
          cmd.x + cmd.width,
          cmd.y,
          cmd.x + cmd.width,
          cmd.y + cmd.height,
          cmd.x,
          cmd.y + cmd.height,
        ];

        // 纹理坐标 (不使用，但仍需设置)
        const texCoords = [0, 0, 1, 0, 1, 1, 0, 1];

        // 解析颜色值
        const color = this.app.parseColor(cmd.fillColor);

        // 顶点颜色
        const colors = [
          color.r,
          color.g,
          color.b,
          color.a * this.alpha,
          color.r,
          color.g,
          color.b,
          color.a * this.alpha,
          color.r,
          color.g,
          color.b,
          color.a * this.alpha,
          color.r,
          color.g,
          color.b,
          color.a * this.alpha,
        ];

        // 索引 (两个三角形)
        const indices = [0, 1, 2, 0, 2, 3];

        // 设置缓冲区数据
        this.app._setBufferData(positions, texCoords, colors, indices);

        // 绘制
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      } else if (cmd.type === "circle") {
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
          texCoords.push(
            0.5 + Math.cos(angle) * 0.5,
            0.5 + Math.sin(angle) * 0.5,
          );
          colors.push(color.r, color.g, color.b, color.a * this.alpha);

          if (i > 0) {
            indices.push(0, i, i + 1);
          }
        }

        // 设置缓冲区数据
        this.app._setBufferData(positions, texCoords, colors, indices);

        // 绘制
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      } else if (cmd.type === "roundedRect") {
        const positions: number[] = [];
        const texCoords: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        // 解析颜色
        const color = this.app.parseColor(cmd.fillColor);
        const r =
          typeof cmd.radius === "number"
            ? { tl: cmd.radius, tr: cmd.radius, br: cmd.radius, bl: cmd.radius }
            : cmd.radius;

        let vertexIndex = 0;

        // 辅助函数：添加顶点
        const addVertex = (x: number, y: number): number => {
          positions.push(x, y);
          texCoords.push(0, 0);
          colors.push(color.r, color.g, color.b, color.a * this.alpha);
          return vertexIndex++;
        };

        // 辅助函数：添加圆角扇形
        const addCorner = (
          cx: number,
          cy: number,
          radius: number,
          startAngle: number,
          endAngle: number,
          segments: number,
        ): void => {
          if (radius <= 0) return;

          const centerIdx = addVertex(cx, cy);
          const firstIdx = addVertex(
            cx + Math.cos(startAngle) * radius,
            cy + Math.sin(startAngle) * radius,
          );

          for (let i = 1; i <= segments; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / segments);
            const idx = addVertex(
              cx + Math.cos(angle) * radius,
              cy + Math.sin(angle) * radius,
            );
            indices.push(centerIdx, idx - 1, idx);
          }
        };

        const segments = 8; // 每个圆角的分段数

        // 中心矩形区域（分为多个三角形）
        const innerLeft = cmd.x + Math.max(r.tl, r.bl);
        const innerRight = cmd.x + cmd.width - Math.max(r.tr, r.br);
        const innerTop = cmd.y + Math.max(r.tl, r.tr);
        const innerBottom = cmd.y + cmd.height - Math.max(r.bl, r.br);

        if (innerRight > innerLeft && innerBottom > innerTop) {
          const v0 = addVertex(innerLeft, innerTop);
          const v1 = addVertex(innerRight, innerTop);
          const v2 = addVertex(innerRight, innerBottom);
          const v3 = addVertex(innerLeft, innerBottom);
          indices.push(v0, v1, v2, v0, v2, v3);
        }

        // 上边矩形
        if (r.tl > 0 || r.tr > 0) {
          const v0 = addVertex(cmd.x + r.tl, cmd.y);
          const v1 = addVertex(cmd.x + cmd.width - r.tr, cmd.y);
          const v2 = addVertex(
            cmd.x + cmd.width - r.tr,
            cmd.y + Math.max(r.tl, r.tr),
          );
          const v3 = addVertex(cmd.x + r.tl, cmd.y + Math.max(r.tl, r.tr));
          indices.push(v0, v1, v2, v0, v2, v3);
        }

        // 下边矩形
        if (r.bl > 0 || r.br > 0) {
          const v0 = addVertex(
            cmd.x + r.bl,
            cmd.y + cmd.height - Math.max(r.bl, r.br),
          );
          const v1 = addVertex(
            cmd.x + cmd.width - r.br,
            cmd.y + cmd.height - Math.max(r.bl, r.br),
          );
          const v2 = addVertex(cmd.x + cmd.width - r.br, cmd.y + cmd.height);
          const v3 = addVertex(cmd.x + r.bl, cmd.y + cmd.height);
          indices.push(v0, v1, v2, v0, v2, v3);
        }

        // 左边矩形
        if (r.tl > 0 || r.bl > 0) {
          const v0 = addVertex(cmd.x, cmd.y + r.tl);
          const v1 = addVertex(cmd.x + Math.max(r.tl, r.bl), cmd.y + r.tl);
          const v2 = addVertex(
            cmd.x + Math.max(r.tl, r.bl),
            cmd.y + cmd.height - r.bl,
          );
          const v3 = addVertex(cmd.x, cmd.y + cmd.height - r.bl);
          indices.push(v0, v1, v2, v0, v2, v3);
        }

        // 右边矩形
        if (r.tr > 0 || r.br > 0) {
          const v0 = addVertex(
            cmd.x + cmd.width - Math.max(r.tr, r.br),
            cmd.y + r.tr,
          );
          const v1 = addVertex(cmd.x + cmd.width, cmd.y + r.tr);
          const v2 = addVertex(cmd.x + cmd.width, cmd.y + cmd.height - r.br);
          const v3 = addVertex(
            cmd.x + cmd.width - Math.max(r.tr, r.br),
            cmd.y + cmd.height - r.br,
          );
          indices.push(v0, v1, v2, v0, v2, v3);
        }

        // 四个圆角
        addCorner(
          cmd.x + r.tl,
          cmd.y + r.tl,
          r.tl,
          Math.PI,
          Math.PI * 1.5,
          segments,
        ); // 左上
        addCorner(
          cmd.x + cmd.width - r.tr,
          cmd.y + r.tr,
          r.tr,
          Math.PI * 1.5,
          Math.PI * 2,
          segments,
        ); // 右上
        addCorner(
          cmd.x + cmd.width - r.br,
          cmd.y + cmd.height - r.br,
          r.br,
          0,
          Math.PI * 0.5,
          segments,
        ); // 右下
        addCorner(
          cmd.x + r.bl,
          cmd.y + cmd.height - r.bl,
          r.bl,
          Math.PI * 0.5,
          Math.PI,
          segments,
        ); // 左下

        // 设置缓冲区并绘制
        this.app._setBufferData(positions, texCoords, colors, indices);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      }
    }
  }
}
