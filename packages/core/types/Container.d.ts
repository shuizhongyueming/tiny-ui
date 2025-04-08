import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
export declare class Container extends DisplayObject {
    children: DisplayObject[];
    /**
     * 节点的 width 和 height 只能从内部设定，外部无法修改
     * 外部调整节点的尺寸，只能通过 scale 来设定
     * container 的 width 和 height 可以从外部设置
     */
    get width(): number;
    get height(): number;
    set width(value: number);
    set height(value: number);
    constructor(app: TinyUI, name?: string);
    addChild(child: DisplayObject): void;
    removeChild(child: DisplayObject): void;
    hitTest(x: number, y: number): boolean;
    destroy(): void;
    render(matrix: Matrix): void;
}
