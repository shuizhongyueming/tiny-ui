import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { Size } from "./type";
import { type Matrix } from "./utils/Matrix";

export class Container extends DisplayObject {
  children: DisplayObject[] = [];

  /**
   * 节点的 width 和 height 只能从内部设定，外部无法修改
   * 外部调整节点的尺寸，只能通过 scale 来设定
   * container 的 width 和 height 可以从外部设置
   */
  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }
  set width(value: number) {
    this.setWidth(value);
  }

  set height(value: number) {
    this.setHeight(value);
  }
  setSize(size: Size) {
    this.setWidth(size.width);
    this.setHeight(size.height);
  }

  constructor(app: TinyUI, name: string = 'Container') {
    super(app, name);
  }

  addChild(child: DisplayObject): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    this.children.push(child);
    child.parent = this;
  }

  removeChild(child: DisplayObject): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  override hitTest(x: number, y: number): boolean {
    if (!super.hitTest(x, y)) return false;

    // 从后向前检查子节点（渲染顺序的逆序）
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (child.visible && child.hitTest(x, y)) {
        return true;
      }
    }

    return true;
  }

  override destroy(): void {
    super.destroy();

    // 销毁所有子节点
    for (const child of this.children) {
      child.destroy();
    }
    this.children = [];
  }

  render(matrix: Matrix): void {
    // Container自身不需要渲染内容
    // 渲染子节点的逻辑已经移到TinyUI._renderTree中
    // for (const child of this.children) {
    //   const savedAppMatrix = this.app.currentMatrix.clone();
    //   this.app._renderNode(child);
    // }
  }

}
