import type { TinyUI, Rect, Graphics } from "@shuizhongyueming/tiny-ui-core";

export function ShapeRect(
  app: TinyUI,
  { width = 0, height = 0 }: Partial<Omit<Rect, 'x' | 'y'>>,
  bg: string = '#ffffff'
): Graphics {
  const shape = app.createGraphics('ShapeRect');
  shape.drawRect(0, 0, width, height, bg);
  return shape;
}
