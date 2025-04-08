import { createEmptyCanvas } from "./utils/createEmptyCanvas";
import type { TinyUI, Bitmap } from "@shuizhongyueming/tiny-ui-core";

export function TransparentRect(app: TinyUI, width: number, height?: number): Bitmap {
  height = height || width;
  const cvs = createEmptyCanvas(width, height);
  const bitmap = app.createBitmapFromCanvas(cvs)
  return bitmap;
}
