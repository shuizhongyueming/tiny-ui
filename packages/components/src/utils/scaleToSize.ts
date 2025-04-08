import type { DisplayObject, Size } from "@shuizhongyueming/tiny-ui-core";

export function scaleToSize(obj: DisplayObject, sizeTarget: Size) {
  obj.scaleToFit(sizeTarget.width, sizeTarget.height);
  return obj;
}
