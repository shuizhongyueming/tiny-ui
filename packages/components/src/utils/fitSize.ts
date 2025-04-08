import type { Size } from "@shuizhongyueming/tiny-ui-core";

/**
 * 使得源Size能够等比缩放，融入到目标Size
 * @param s 源Size
 * @param t 目标Size
 */
export function fitSize(s: Size, t: Size): Size {
  var rw: number, rh: number;
  if (s.width / s.height > t.width / t.height) {
    rw = t.width;
    rh = (rw * s.height) / s.width;
  } else {
    rh = t.height;
    rw = (rh * s.width) / s.height;
  }
  return { ...s, width: rw, height: rh };
}
