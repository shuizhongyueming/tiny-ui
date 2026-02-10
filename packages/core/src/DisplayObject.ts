import { type Container } from "./Container";
import type { EventName, Callback, Rect, Size, Point } from "./type";
import { Matrix } from "./utils/Matrix";
import type { UIEvent } from "./utils/UIEvent";
import { Emitter } from "./utils/Emitter";
import type TinyUI from "./TinyUI";

export interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DisplayObject extends Emitter {
  app: TinyUI;
  parent: Container | null = null;
  children: DisplayObject[] | null = null;
  isScaleAffectedSize: boolean = false;
  x: number = 0;
  y: number = 0;
  protected _width: number = 0;
  protected _height: number = 0;
  visible: boolean = true;
  scaleX: number = 1;
  scaleY: number = 1;
  anchorX: number = 0.5;
  anchorY: number = 0.5;
  alpha: number = 1;
  name: string = "";
  rotation: number = 0; // 角度 (0-360)
  clipRect?: ClipRect; // 裁剪区域（相对于节点本地坐标）

  destroyed: boolean = false;

  private eventListeners: Map<EventName, Set<Callback>> = new Map();

  /**
   * 节点的 width 和 height 只能从内部设定，外部无法修改
   * 外部调整节点的尺寸，只能通过 scale 来设定
   */
  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  protected setWidth(value: number): void {
    const oldValue = this._width;
    this._width = value;
    if (oldValue !== value) {
      this.emit("resize", { width: value, height: this._height });
    }
  }
  _setWidth(value: number): void {
    this.setWidth(value);
  }

  protected setHeight(value: number): void {
    const oldValue = this._height;
    this._height = value;
    if (oldValue !== value) {
      this.emit("resize", { width: this._width, height: value });
    }
  }
  _setHeight(value: number): void {
    this.setHeight(value);
  }

  scaleToFit(width: number, height?: number): void {
    this.scaleX = width / this.width;
    if (!height) {
      this.scaleY = this.scaleX;
    } else {
      this.scaleY = height / this.height;
    }
  }

  scaleToFitSize(size: Size): void {
    this.scaleToFit(size.width, size.height);
  }

  scaleTo(scale: number): void {
    this.scaleX = this.scaleY = scale;
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  moveToPoint(p: Point): void {
    this.x = p.x;
    this.y = p.y;
  }

  constructor(app: TinyUI, name?: string) {
    super();
    this.app = app;
    this.name = name || "DisplayObject";
  }

  addEventListener(eventName: EventName, handler: Callback<UIEvent>): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(handler);
  }

  removeEventListener(eventName: EventName, handler: Callback<UIEvent>): void {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName)!.delete(handler);
    }
  }

  dispatchEvent(eventName: EventName, event: UIEvent): void {
    if (this.eventListeners.has(eventName)) {
      for (const handler of this.eventListeners.get(eventName)!) {
        // 如果事件已触发 stopImmediatePropagation，停止执行后续监听器
        if (event.immediatePropagationStopped) {
          break;
        }
        handler(event);
        event.markHandled();
      }
    }
  }

  hasEventListener(eventName: EventName): boolean {
    return (
      this.eventListeners.has(eventName) &&
      this.eventListeners.get(eventName)!.size > 0
    );
  }

  // 返回对象自身的本地变换矩阵
  getLocalTransformMatrix(): Matrix {
    const matrix = new Matrix();

    // 计算基于锚点的变换
    const anchorOffsetX = this.width * this.anchorX;
    const anchorOffsetY = this.height * this.anchorY;

    // 移动到位置（考虑锚点偏移）
    matrix.translate(this.x - anchorOffsetX, this.y - anchorOffsetY);

    // 如果有旋转或缩放，需要围绕锚点进行
    if (this.rotation !== 0 || this.scaleX !== 1 || this.scaleY !== 1) {
      // 移动锚点到原点
      matrix.translate(anchorOffsetX, anchorOffsetY);

      // 应用旋转和缩放
      matrix
        .rotate((this.rotation * Math.PI) / 180)
        .scale(this.scaleX, this.scaleY);

      // 移回原位置
      matrix.translate(-anchorOffsetX, -anchorOffsetY);
    }

    return matrix;
  }

  // 获取全局变换矩阵（包括所有父节点的变换）
  getGlobalTransformMatrix(): Matrix {
    let matrix = this.getLocalTransformMatrix();

    // 递归应用父级变换
    let currentParent = this.parent;
    while (currentParent) {
      const parentMatrix = currentParent.getLocalTransformMatrix();
      matrix = parentMatrix.multiply(matrix);
      currentParent = currentParent.parent;
    }

    return matrix;
  }

  // 计算全局边界框
  getBounds(): Rect {
    // 获取元素自身的宽高（考虑scale是否影响尺寸）
    const finalWidth = this.isScaleAffectedSize
      ? this.width * this.scaleX
      : this.width;
    const finalHeight = this.isScaleAffectedSize
      ? this.height * this.scaleY
      : this.height;

    // 创建元素四个角的本地坐标
    const localPoints = [
      { x: 0, y: 0 }, // 左上
      { x: finalWidth, y: 0 }, // 右上
      { x: finalWidth, y: finalHeight }, // 右下
      { x: 0, y: finalHeight }, // 左下
    ];

    // 获取全局变换矩阵
    const matrix = this.getGlobalTransformMatrix();

    // 应用变换矩阵到所有点
    const globalPoints = localPoints.map((point) => {
      const transformed = matrix.transformPoint(point.x, point.y);
      return { x: transformed.x, y: transformed.y };
    });

    // 计算变换后点的边界
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of globalPoints) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  getSize(): Size {
    return {
      width: this.width,
      height: this.height,
    };
  }

  // 检测点是否在对象内
  hitTest(x: number, y: number): boolean {
    if (!this.visible) return false;

    // 获取全局变换矩阵
    const matrix = this.getGlobalTransformMatrix();

    // 创建逆矩阵将全局坐标转回本地坐标
    const invertMatrix = matrix.invert();
    if (!invertMatrix) return false; // 如果矩阵不可逆，无法进行碰撞检测

    // 将全局坐标转换为本地坐标
    const localPoint = invertMatrix.transformPoint(x, y);

    // 检查本地坐标是否在对象的边界内
    return (
      localPoint.x >= 0 &&
      localPoint.x <= this.width &&
      localPoint.y >= 0 &&
      localPoint.y <= this.height
    );
  }

  render(_matrix: Matrix): void {
    // 实现渲染逻辑
  }

  /**
   * 设置裁剪区域（相对于节点本地坐标）
   * @param x 裁剪区域左上角 x 坐标
   * @param y 裁剪区域左上角 y 坐标
   * @param width 裁剪区域宽度
   * @param height 裁剪区域高度
   */
  setClipRect(x: number, y: number, width: number, height: number): void {
    this.clipRect = { x, y, width, height };
  }

  /**
   * 清除裁剪区域
   */
  clearClipRect(): void {
    this.clipRect = undefined;
  }

  destroy(): void {
    this.emit("destroyed");
    this.destroyed = true;
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.eventListeners.clear();
    this.removeAllListeners();
  }
}
