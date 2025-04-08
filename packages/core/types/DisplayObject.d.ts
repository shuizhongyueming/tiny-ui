import { type Container } from "./Container";
import type { EventName, Callback, Rect, UIEvent, Size } from "./type";
import { Matrix } from "./utils/Matrix";
import type TinyUI from "./TinyUI";
export declare class DisplayObject {
    app: TinyUI;
    parent: Container | null;
    children: DisplayObject[] | null;
    isScaleAffectedSize: boolean;
    x: number;
    y: number;
    protected _width: number;
    protected _height: number;
    visible: boolean;
    scaleX: number;
    scaleY: number;
    anchorX: number;
    anchorY: number;
    alpha: number;
    name: string;
    rotation: number;
    private eventListeners;
    /**
     * 节点的 width 和 height 只能从内部设定，外部无法修改
     * 外部调整节点的尺寸，只能通过 scale 来设定
     */
    get width(): number;
    get height(): number;
    protected setWidth(value: number): void;
    protected setHeight(value: number): void;
    scaleToFit(width: number, height?: number): void;
    constructor(app: TinyUI, name?: string);
    addEventListener(eventName: EventName, handler: Callback<UIEvent>): void;
    removeEventListener(eventName: EventName, handler: Callback<UIEvent>): void;
    dispatchEvent(eventName: EventName, event: UIEvent): void;
    hasEventListener(eventName: EventName): boolean;
    getLocalTransformMatrix(): Matrix;
    getGlobalTransformMatrix(): Matrix;
    getBounds(): Rect;
    getSize(): Size;
    hitTest(x: number, y: number): boolean;
    render(_matrix: Matrix): void;
    destroy(): void;
}
