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

  /**
   * 显式指定的基线偏移（相对节点盒顶边）。为 null 时用类型默认值。
   *
   * 容器（Container）自身没有文字，默认以**底边**当基线；但当它扮演一个
   * "文字组合控件"（如 图标+数值）时，应该把自己内部文字的基线报上去，
   * 否则外层再按 baseline 排版就会对不齐。
   * 对应 CSS 里 `display:inline-block` 的子元素参与父级基线对齐的行为。
   */
  baselineOverride: number | null = null;

  /**
   * 基线相对节点盒顶边的偏移，供排版的 baseline 对齐使用。
   *
   * 优先级：`baselineOverride` > 类型默认值。
   * 默认是 `height`（= 按底边当基线），对图形类节点是合理近似；`Text` 覆盖为真实字体基线。
   */
  get baselineOffset(): number {
    return this.baselineOverride !== null
      ? this.baselineOverride
      : this.defaultBaselineOffset();
  }

  /** 类型默认的基线偏移，`Text` 会覆盖。 */
  protected defaultBaselineOffset(): number {
    return this._height;
  }

  /**
   * 视觉内容相对盒顶边的上边距。默认 0（图形类节点铺满盒）。
   * `Text` 覆盖为 `topPadding + 描边留白` —— 文字 ink 在盒内是偏下的。
   */
  get visualTop(): number {
    return 0;
  }

  /** 视觉内容的高度。默认等于盒高；`Text` 覆盖为行盒高的实际值。 */
  get visualHeight(): number {
    return this._height;
  }

  /** 视觉内容的底边（相对盒顶边）。 */
  get visualBottom(): number {
    return this.visualTop + this.visualHeight;
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

  /**
   * 设置**布局尺寸**（相对 `scaleX/scaleY` 独立）。
   *
   * 布局尺寸与视觉变换是两件事，和 CSS 一致：
   * - `width/height` 参与流式布局（`layoutRow` 用它算位置和间距）；
   * - `scaleX/scaleY` 只影响渲染，**不改变布局**（对应 CSS 的 `transform: scale()`）。
   *
   * 所以「把一个 256px 的图标显示成 20px」应该用 `setSize(20, 20)`，
   * 而不是 `scaleTo(20/256)` —— 后者会让布局按 256px 占位，
   * 且任何用 scale 做的动画都会连带改变布局。
   *
   * @param width 布局宽
   * @param height 布局高；省略时取 width（正方形）
   */
  setSize(width: number, height?: number): void {
    this._setWidth(width);
    this._setHeight(height === undefined ? width : height);
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

  /**
   * 把节点缩放到指定的**视觉尺寸**（只改 scale，不改 width/height）。
   *
   * ⚠️ 这是视觉缩放，**不参与布局**：`scaleToFit(20)` 之后视觉宽度是 20，
   * 但它在 `layoutRow` 里仍然按原始的 `width` 占位，会留出一个大空位。
   *
   * 两个入口各有用途，别混用：
   * - 想要"这个控件在排版里占 20px" → `setSize(20, 20)`
   * - 想要"把背景图铺满容器"（视觉对齐，配合 `adjustTo`）→ `scaleToFit(w, h)`
   */
  scaleToFit(width: number, height?: number): void {
    this.scaleX = width / this.width;
    if (!height) {
      this.scaleY = this.scaleX;
    } else {
      this.scaleY = height / this.height;
    }
  }

  /** `scaleToFit` 的 Size 版本。同样只改视觉，不参与布局。 */
  scaleToFitSize(size: Size): void {
    this.scaleToFit(size.width, size.height);
  }

  /**
   * 按倍数做**视觉缩放**（只改 scaleX/scaleY）。
   *
   * ⚠️ 不参与布局。设置控件尺寸请用 `setSize()`。
   * 动画用这个是安全的 —— scale 不影响 `layoutRow` / `layoutColumn` 的排版结果。
   */
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

  /**
   * 计算全局包围盒（**含** scale，因为下面用的是全局变换矩阵）。
   *
   * 历史上有过 `isScaleAffectedSize` 开关，用来"手动把 scale 乘进尺寸"——
   * 那个开关是矩阵还不含 scale 时的补丁。现在矩阵里已经有 `.scale(scaleX, scaleY)`，
   * 开关打开会变成**双重缩放**（100×100 @ scale 0.5 得到 25×25 而非 50×50），
   * 会让 Scroll 滚不到底、hitTest 点不中。已删除，行为就是原来的默认值 false。
   */
  getBounds(): Rect {
    const finalWidth = this.width;
    const finalHeight = this.height;

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
