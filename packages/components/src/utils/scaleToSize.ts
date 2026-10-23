import type { DisplayObject, Size } from "@shuizhongyueming/tiny-ui-core";

/**
 * 把节点设成目标尺寸（**布局尺寸**，不是视觉缩放）。
 *
 * 历史实现是 `obj.scaleToFit(w, h)` —— 只改 scale、不改 width/height，
 * 于是节点在 `layoutRow` / `adjustTo` 的 `move` 偏移里仍按原始尺寸占位。
 * 这里改用 `setSize`，让"尺寸"这件事只有一个真值。
 *
 * ⚠️ 会按目标尺寸拉伸。需要等比缩放请先算好像素尺寸（如 `fitSize`）。
 */
export function scaleToSize(obj: DisplayObject, sizeTarget: Size) {
  obj.setSize(sizeTarget.width, sizeTarget.height);
  return obj;
}
