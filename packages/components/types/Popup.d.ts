import type { TinyUI, Container, DisplayObject, Size } from "@shuizhongyueming/tiny-ui-core";
export interface PopupParams {
    app: TinyUI;
    parent?: Container;
    size?: Size;
    bgColor?: string;
    bg?: DisplayObject;
    alpha?: number;
}
export declare function Popup({ app, parent, size, bgColor, bg, alpha, }: PopupParams): Container;
