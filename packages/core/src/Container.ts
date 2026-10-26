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
  /* setSize 继承自 DisplayObject（签名 setSize(width, height?)）。
     历史上这里是 setSize(size: Size)，统一成数字参数以免两套 API 并存。 */

  constructor(app: TinyUI, name: string = "Container") {
    super(app, name);
  }

  addChild(child: DisplayObject): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    this.children.push(child);
    child.parent = this;

    this.emit("childrenChanged", {
      type: "add",
      child,
      index: this.children.length - 1,
    });
  }

  addChildAt(child: DisplayObject, index: number): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    const insertIndex = Math.max(0, Math.min(index, this.children.length));
    this.children.splice(insertIndex, 0, child);
    child.parent = this;

    this.emit("childrenChanged", {
      type: "add",
      child,
      index: insertIndex,
    });
  }

  removeChild(child: DisplayObject): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
      this.emit("childrenChanged", {
        type: "remove",
        child,
        index,
      });
    }
  }


  override destroy(): void {
    super.destroy();

    /* 先快照再销毁：child.destroy() 会把 child 从 this.children 里 removeChild
       掉（splice），直接 for...of 边遍历边改数组会跳元素 —— 一半子树泄漏
       （监听器/贴图不释放，pressable 挂的输入面监听也摘不掉，实测 resize
       重建一次监听器净增 ~45）。 */
    const kids = this.children.slice();
    for (const child of kids) {
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
