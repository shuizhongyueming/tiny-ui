import type { Size } from "@shuizhongyueming/tiny-ui-core";

export function scaleSize(rect: Size, scaleX: number, scaleY?: number): Size {
  if (typeof scaleY === 'undefined') {
    scaleY = scaleX;
  }
  return { ...rect, width: rect.width * scaleX, height: rect.height * scaleY };
}
