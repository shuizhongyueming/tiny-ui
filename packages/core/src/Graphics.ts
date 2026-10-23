import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
import { describeValue, resetDiagnostic, warnOnce } from "./utils/diagnostics";

/** 这些字段为负会产生反向几何，属于「可疑但保留」而不是「非法」。 */
const EXTENT_FIELDS = new Set(["width", "height", "radius", "radius.tl", "radius.tr", "radius.br", "radius.bl"]);

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

  /** 上一帧视口是否为零尺寸，用来让零视口诊断按「状态周期」去重。 */
  private viewportWasZero = false;

  constructor(app: TinyUI, name: string = "Graphics") {
    super(app, name);
  }

  clear(): Graphics {
    this.commands = [];
    return this;
  }

  /**
   * 校验几何参数，返回「这条命令能不能要」。
   *
   * **校验永远执行，诊断只在装置开启时说出来。** 不要把它包进
   * `if (isDiagnosticsEnabled())` —— 那样生产构建仍会让 `NaN` 进入边界。
   */
  private validateGeometry(
    api: string,
    fields: ReadonlyArray<readonly [string, unknown]>,
  ): boolean {
    let ok = true;
    for (const [key, value] of fields) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        warnOnce(
          this,
          "E_GEOM_NONFINITE",
          api,
          `${key} 不是有限数值（收到 ${describeValue(value)}）`,
          "这条命令已丢弃；NaN 通常来自尚未完成的布局计算或未初始化的容器尺寸",
        );
        ok = false;
        continue;
      }
      if (value < 0 && EXTENT_FIELDS.has(key)) {
        warnOnce(
          this,
          "W_GEOM_NEGATIVE",
          api,
          `${key} 为负数（${value}）`,
          "负尺寸会生成反向几何、边界出现负宽高；确认是否把坐标差算反了",
        );
      }
    }
    return ok;
  }

  /**
   * 视口为零时画什么都不会出现，但也**不会报错**。
   *
   * 按状态周期去重：进入零尺寸提示一次，恢复到有效尺寸后清标记，再次归零允许重新提示。
   */
  private checkViewportForDraw(): void {
    const width = this.app.stageWidth;
    const height = this.app.stageHeight;
    if (width > 0 && height > 0) {
      if (this.viewportWasZero) {
        this.viewportWasZero = false;
        resetDiagnostic(this, "W_ZERO_VIEWPORT");
      }
      return;
    }
    this.viewportWasZero = true;
    warnOnce(
      this,
      "W_ZERO_VIEWPORT",
      "render",
      `视口为 ${width}×${height} 时仍在绘制 ${this.commands.length} 条命令`,
      "等 canvas 尺寸就绪后再绘制；零视口常见于首次 layout 早于 canvas 挂载",
    );
  }

  drawCircle(
    x: number,
    y: number,
    radius: number,
    fillColor: string | number,
  ): Graphics {
    if (
      !this.validateGeometry("drawCircle", [
        ["x", x],
        ["y", y],
        ["radius", radius],
      ])
    ) {
      return this;
    }

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
    if (
      !this.validateGeometry("drawRect", [
        ["x", x],
        ["y", y],
        ["width", width],
        ["height", height],
      ])
    ) {
      return this;
    }

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
    const fields: Array<readonly [string, unknown]> = [
      ["x", x],
      ["y", y],
      ["width", width],
      ["height", height],
    ];
    if (typeof radius === "number") {
      fields.push(["radius", radius]);
    } else if (radius !== null && typeof radius === "object") {
      // 逐字段校验，缺字段会以 undefined 被拦下
      for (const corner of ["tl", "tr", "br", "bl"] as const) {
        fields.push([`radius.${corner}`, (radius as Record<string, unknown>)[corner]]);
      }
    } else {
      warnOnce(
        this,
        "E_GEOM_NONFINITE",
        "drawRoundedRect",
        `radius 既不是数字也不是 {tl,tr,br,bl}（收到 ${describeValue(radius)}）`,
        "四角同值传数字，否则传 {tl,tr,br,bl} 对象",
      );
      return this;
    }
    if (!this.validateGeometry("drawRoundedRect", fields)) return this;

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

    this.checkViewportForDraw();

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
