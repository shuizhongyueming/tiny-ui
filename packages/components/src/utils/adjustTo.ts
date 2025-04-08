import type { DisplayObject } from "@shuizhongyueming/tiny-ui-core";

export type HorizontalPosition = 'left' | 'center' | 'right';
export type VerticalPosition = 'top' | 'center' | 'bottom';

export interface OptionAdjust {
  h: HorizontalPosition; // 水平位置 left 左对齐 center 居中 right 右对齐
  v: VerticalPosition; // 垂直位置 top 上对齐 center 居中 bottom 下对齐
}

type IAdjustTo = (checker: DisplayObject, willContain?: boolean) => (
  target: DisplayObject,
  adjust: Partial<OptionAdjust>,
  move?: {
    x?: number; // 水平移动
    y?: number; // 垂直移动
  }
) => DisplayObject;

// 让target放置到checker的指定位置
// target 与 checker 同级 或者 checker 是 target 的父级
export const adjustTo: IAdjustTo =
  (checker: DisplayObject, willContain: boolean = false) =>
    (target, adjust, move = {}) => {
      const checkWidth = checker.width * checker.scaleX;
      const checkHeight = checker.height * checker.scaleY;
      const targetWidth = target.width * target.scaleX;
      const targetHeight = target.height * target.scaleY;

      // 因为checker和target的hotspot可能不一致
      // 如果 checker和target是包含关系，那么不需要考虑 checker的坐标
      const cX = willContain ? 0 : checker.x - checkWidth * checker.anchorX;
      const cY = willContain ? 0 : checker.y - checkHeight * checker.anchorY;
      const tX = target.x - targetWidth * target.anchorX;
      const tY = target.y - targetHeight * target.anchorY;
      let moveX = 0;
      let moveY = 0

      if (adjust.h) {
        switch (adjust.h) {
          case 'left':
            moveX = cX - tX;
            break;
          case 'center':
            moveX = cX - tX + (checkWidth - targetWidth) / 2;
            break;
          case 'right':
            moveX = cX - tX + checkWidth - targetWidth;
            break;
        }
      }

      if (adjust.v) {
        switch (adjust.v) {
          case 'top':
            moveY = cY - tY;
            break;
          case 'center':
            moveY = cY - tY + (checkHeight - targetHeight) / 2;
            break;
          case 'bottom':
            moveY = cY - tY + checkHeight - targetHeight;
            break;
        }
      }

      target.x += moveX + (move.x ?? 0);
      target.y += moveY + (move.y ?? 0);

      return target;
    }
