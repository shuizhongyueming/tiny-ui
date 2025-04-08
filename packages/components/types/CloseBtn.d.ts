import { type CornerPosition } from "./utils/placeCorner";
import type { TinyUI, Bitmap, Callback, Container } from "@shuizhongyueming/tiny-ui-core";
export interface CloseBtnProps {
    app: TinyUI;
    size: number;
    closeImg: HTMLImageElement;
    handleClose: Callback;
    handleClick?: () => boolean;
    closeDelay?: number;
    parentNode: Container;
    position: CornerPosition;
}
export declare function CloseBtn({ app, size, closeImg, handleClose, handleClick, closeDelay, parentNode, position }: CloseBtnProps): Bitmap;
