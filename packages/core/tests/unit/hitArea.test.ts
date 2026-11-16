import { describe, expect, it } from "vitest";
import { expandHitRect, hitSlopFor, minimumSizeOf } from "../../src/utils/hitArea";

describe("minimumSizeOf", () => {
  it("数字表示正方形", () => {
    expect(minimumSizeOf(44)).toEqual({ width: 44, height: 44 });
  });

  it("对象分别给宽高", () => {
    expect(minimumSizeOf({ width: 44, height: 32 })).toEqual({ width: 44, height: 32 });
  });
});

describe("expandHitRect", () => {
  it("保持中心扩到最小尺寸", () => {
    expect(expandHitRect({ x: 100, y: 100, width: 20, height: 20 }, 44))
      .toEqual({ x: 88, y: 88, width: 44, height: 44 });
  });

  it("已经足够大时原样返回", () => {
    const rect = { x: 10, y: 20, width: 80, height: 60 };
    expect(expandHitRect(rect, 44)).toEqual(rect);
  });

  it("宽高分别扩，互不影响", () => {
    expect(expandHitRect({ x: 0, y: 0, width: 100, height: 10 }, { width: 44, height: 44 }))
      .toEqual({ x: 0, y: -17, width: 100, height: 44 });
  });

  it("bounds 把结果夹在边界内", () => {
    const rect = { x: 2, y: 2, width: 10, height: 10 };
    expect(expandHitRect(rect, 44, { x: 0, y: 0, width: 200, height: 200 }))
      .toEqual({ x: 0, y: 0, width: 44, height: 44 });
    const edge = { x: 195, y: 195, width: 10, height: 10 };
    expect(expandHitRect(edge, 44, { x: 0, y: 0, width: 200, height: 200 }))
      .toEqual({ x: 156, y: 156, width: 44, height: 44 });
  });

  it("bounds 小于目标尺寸时不产生负坐标", () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    const bounds = { x: 10, y: 10, width: 20, height: 20 };
    expect(expandHitRect(rect, 44, bounds)).toEqual({ x: 10, y: 10, width: 44, height: 44 });
  });
});

describe("hitSlopFor", () => {
  it("按目标尺寸与视觉尺寸的差算每边容差", () => {
    expect(hitSlopFor(20, 20, 44)).toEqual({ x: 12, y: 12 });
  });

  it("保留更大的显式 slop", () => {
    expect(hitSlopFor(40, 40, 44, 10)).toEqual({ x: 10, y: 10 });
  });

  it("视觉尺寸已超目标时容差为 0", () => {
    expect(hitSlopFor(80, 60, 44)).toEqual({ x: 0, y: 0 });
  });
});
