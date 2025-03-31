import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
export declare class Container extends DisplayObject {
    children: DisplayObject[];
    constructor(app: TinyUI, name?: string);
    addChild(child: DisplayObject): void;
    removeChild(child: DisplayObject): void;
    hitTest(x: number, y: number): boolean;
    destroy(): void;
    render(matrix: Matrix): void;
}
