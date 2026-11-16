/** 轴对齐矩形，单位与布局一致。 */
export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 最小触摸尺寸：单个数字表示正方形。 */
export type MinimumSize = number | { width: number; height: number };

export function minimumSizeOf(size: MinimumSize): { width: number; height: number } {
  return typeof size === "number"
    ? { width: size, height: size }
    : { width: size.width, height: size.height };
}

/**
 * 保持中心，把矩形扩到至少 `size` 的宽高。
 *
 * 用于「视觉小、触摸要够大」的控件。只扩不缩：矩形已够大时原样返回。
 * 传入 `bounds` 时把结果夹在边界内，避免扩到屏幕外后点不到。
 */
export function expandHitRect(
  rect: HitRect,
  size: MinimumSize,
  bounds?: HitRect,
): HitRect {
  const min = minimumSizeOf(size);
  const width = Math.max(rect.width, min.width);
  const height = Math.max(rect.height, min.height);
  let x = rect.x + rect.width / 2 - width / 2;
  let y = rect.y + rect.height / 2 - height / 2;
  if (bounds) {
    const maxX = bounds.x + bounds.width - width;
    const maxY = bounds.y + bounds.height - height;
    x = Math.min(Math.max(bounds.x, x), Math.max(bounds.x, maxX));
    y = Math.min(Math.max(bounds.y, y), Math.max(bounds.y, maxY));
  }
  return { x, y, width, height };
}

/**
 * 计算命中矩形相对视觉矩形每边的容差。
 *
 * `Pressable` 用它把 `minimumSize` 换算成节点局部坐标的 `slop`；
 * 手写命中判定也可以直接用返回值。
 */
export function hitSlopFor(
  width: number,
  height: number,
  size: MinimumSize,
  slop: number = 0,
): { x: number; y: number } {
  const min = minimumSizeOf(size);
  return {
    x: Math.max(slop, (min.width - width) / 2),
    y: Math.max(slop, (min.height - height) / 2),
  };
}

/**
 * 节点命中区的外扩量，单位是节点局部坐标。
 *
 * 允许传函数是为了跟随节点尺寸变化：按钮在按下反馈里会重设尺寸，
 * 固定值算出的外扩量到那一刻就错了。
 */
export type HitPadding =
  | number
  | { x: number; y: number }
  | (() => number | { x: number; y: number });

/** 把 `HitPadding` 归一成 `{x,y}`，负数按 0 处理。 */
export function resolveHitPadding(
  padding: HitPadding | undefined | null,
): { x: number; y: number } {
  const value = typeof padding === "function" ? padding() : padding;
  if (value === undefined || value === null) return { x: 0, y: 0 };
  if (typeof value === "number") {
    return { x: Math.max(0, value), y: Math.max(0, value) };
  }
  return { x: Math.max(0, value.x), y: Math.max(0, value.y) };
}
