import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
interface GraphicsCommandBase {
    type: string;
}
export interface GraphicsCommandRect extends GraphicsCommandBase {
    type: 'rect';
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor: string;
}
export interface GraphicsCommandCircle extends GraphicsCommandBase {
    type: 'circle';
    x: number;
    y: number;
    radius: number;
    fillColor: string;
}
export type GraphicsCommand = GraphicsCommandRect | GraphicsCommandCircle;
export declare class Graphics extends DisplayObject {
    commands: GraphicsCommand[];
    constructor(app: TinyUI, name?: string);
    clear(): Graphics;
    drawCircle(x: number, y: number, radius: number, fillColor: string): Graphics;
    drawRect(x: number, y: number, width: number, height: number, fillColor: string): Graphics;
    destroy(): void;
    render(_matrix: Matrix): void;
}
export {};
