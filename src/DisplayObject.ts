import { type Container } from "./Container";
import type { EventName, Callback, Rect } from "./type";
import { Matrix } from "./utils/Matrix";
import type TinyUI from "./TinyUI";

export class DisplayObject {
  app: TinyUI;
  parent: Container | null = null;
  isScaleAffectedSize: boolean = false;
  x: number = 0;
  y: number = 0;
  width: number = 0;
  height: number = 0;
  visible: boolean = true;
  scaleX: number = 1;
  scaleY: number = 1;
  anchorX: number = 0.5;
  anchorY: number = 0.5;
  alpha: number = 1;
  name: string = "";
  rotation: number = 0; // 角度 (0-360)

  private eventListeners: Map<EventName, Set<Callback>> = new Map();

  constructor(app: TinyUI, name?: string) {
    this.app = app;
    this.name = name || "DisplayObject";
  }

  addEventListener(eventName: EventName, handler: Callback): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(handler);
  }

  removeEventListener(eventName: EventName, handler: Callback): void {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName)!.delete(handler);
    }
  }

  dispatchEvent(eventName: EventName, event: any): void {
    if (this.eventListeners.has(eventName)) {
      for (const handler of this.eventListeners.get(eventName)!) {
        handler(event);
      }
    }
  }

  hasEventListener(eventName: EventName): boolean {
    return this.eventListeners.has(eventName) &&
      this.eventListeners.get(eventName)!.size > 0;
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
      matrix.rotate(this.rotation * Math.PI / 180)
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
    const finalWidth = this.isScaleAffectedSize ? this.width * this.scaleX : this.width;
    const finalHeight = this.isScaleAffectedSize ? this.height * this.scaleY : this.height;

    // 创建元素四个角的本地坐标
    const localPoints = [
      { x: 0, y: 0 },                    // 左上
      { x: finalWidth, y: 0 },           // 右上
      { x: finalWidth, y: finalHeight }, // 右下
      { x: 0, y: finalHeight }           // 左下
    ];

    // 获取全局变换矩阵
    const matrix = this.getGlobalTransformMatrix();

    // 应用变换矩阵到所有点
    const globalPoints = localPoints.map(point => {
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
      height: maxY - minY
    };
  }

  // 检测点是否在对象内
  hitTest(x: number, y: number): boolean {
    if (!this.visible || this.alpha <= 0) return false;

    // 获取全局变换矩阵
    const matrix = this.getGlobalTransformMatrix();

    // 创建逆矩阵将全局坐标转回本地坐标
    const invertMatrix = matrix.invert();
    if (!invertMatrix) return false; // 如果矩阵不可逆，无法进行碰撞检测

    // 将全局坐标转换为本地坐标
    const localPoint = invertMatrix.transformPoint(x, y);

    // 检查本地坐标是否在对象的边界内
    return localPoint.x >= 0 && localPoint.x <= this.width &&
      localPoint.y >= 0 && localPoint.y <= this.height;
  }

  render(_matrix: Matrix): void {
    // 实现渲染逻辑
  }

  destroy(): void {
    this.eventListeners.clear();
  }
}
