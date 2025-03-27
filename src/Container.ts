import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";

export class Container extends DisplayObject {
  children: DisplayObject[] = [];

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
    // 遍历并渲染子节点
    for (const child of this.children) {
      this.app._renderNode(child);
    }
  }

}
