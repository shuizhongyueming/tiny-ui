import { type OptionAdjust } from "./utils/adjustTo";
import type { TinyUI, Bitmap, Container, DisplayObject, Rect, Callback } from "@shuizhongyueming/tiny-ui-core";
export interface ConfirmProps {
    app: TinyUI;
    stageSize: Omit<Rect, 'x' | 'y'>;
    contentSize: Omit<Rect, 'x' | 'y'>;
    imgs: {
        bg: HTMLImageElement;
        contentBg: HTMLImageElement;
        title: HTMLImageElement;
        contents: HTMLImageElement[];
        btnPrev: HTMLImageElement;
        btnNext: HTMLImageElement;
        btnOK: HTMLImageElement;
        btnCancel?: HTMLImageElement;
    };
    onOK?: Callback<ConfirmResult>;
    onCancel?: Callback<ConfirmResult>;
    opt?: {
        titleScale?: number;
        btnScale?: number;
        bgAlpha?: number;
        padding?: number;
    };
}
export interface ConfirmResult {
    container: Container;
    bg: Bitmap;
    contentContainer: Container;
    contentBg: Bitmap;
    title: Bitmap;
    imgContent: Bitmap;
    btnNext: Bitmap;
    btnPrev: Bitmap;
    btnOK?: Bitmap;
    btnCancel?: Bitmap;
    setContents: (contents: string[]) => void;
    adjustToContent: (target: DisplayObject, adjust: Partial<OptionAdjust>, move?: {
        x?: number;
        y?: number;
    }) => DisplayObject;
    updateContent: () => void;
}
export declare function Confirm({ app, stageSize, contentSize, imgs, onOK, onCancel, opt, }: ConfirmProps): ConfirmResult;
