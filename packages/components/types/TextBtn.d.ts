import type { TinyUI, Callback } from "@shuizhongyueming/tiny-ui-core";
export interface TextBtnProps {
    app: TinyUI;
    text: string;
    bgColor?: string;
    textColor?: string;
    fontSize?: number;
    width?: number;
    height?: number;
    responsive?: boolean;
    onClick?: Callback;
}
export declare function TextBtn({ app, text, bgColor, textColor, fontSize, width, height, responsive, onClick, }: TextBtnProps): import("@shuizhongyueming/tiny-ui-core").Container;
