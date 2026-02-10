import type { TinyUI, Rect, Graphics } from "@shuizhongyueming/tiny-ui-core";

export interface ShapeRectProps {
  width?: number;
  height?: number;
  radius?: number | { tl: number; tr: number; br: number; bl: number };
}

export function ShapeRect(
  app: TinyUI,
  { width = 0, height = 0, radius }: ShapeRectProps,
  bg: string = "#ffffff",
): Graphics {
  const shape = app.createGraphics("ShapeRect");

  const hasRadius = radius !== undefined &&
    (typeof radius === "number"
      ? radius > 0
      : Object.values(radius).some((r) => r > 0));

  if (hasRadius) {
    shape.drawRoundedRect(0, 0, width, height, radius, bg);
  } else {
    shape.drawRect(0, 0, width, height, bg);
  }

  return shape;
}
