import { type CornerPosition, placeCorner } from "./utils/placeCorner";
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


export function CloseBtn({
  app,
  size,
  closeImg,
  handleClose,
  handleClick,
  closeDelay = 1000,
  parentNode,
  position
}: CloseBtnProps): Bitmap {
  const close = app.createBitmapFromImage(closeImg);
  close.scaleToFit(size, size);
  close.addEventListener(app.EventName.TouchStart, () => {
    if (handleClick) {
      const canClose = handleClick();
      if (canClose) {
        setTimeout(handleClose, closeDelay);
      }
    } else {
      handleClose();
    }
  });
  parentNode.addChild(close);
  placeCorner({
    boundNode: parentNode,
    cornerNode: close,
    position,
    willContain: true,
  });

  return close;
}
