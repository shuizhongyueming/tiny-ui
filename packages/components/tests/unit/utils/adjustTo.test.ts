import { describe, it, expect } from "vitest";
import { adjustTo } from "../../../src/utils/adjustTo";

// Mock DisplayObject 类型
interface MockDisplayObject {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  anchorX: number;
  anchorY: number;
}

function createMockDisplayObject(overrides: Partial<MockDisplayObject> = {}): MockDisplayObject {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0.5,
    anchorY: 0.5,
    ...overrides,
  };
}

describe("adjustTo", () => {
  describe("basic positioning (willContain=false)", () => {
    it("should position target at left-top of checker", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "left", v: "top" });

      // target 中心点 x = 200 - 200/2 + 50/2 = 200 - 100 + 25 = 125
      expect(target.x).toBe(125);
      // target 中心点 y = 200 - 200/2 + 50/2 = 125
      expect(target.y).toBe(125);
    });

    it("should position target at center of checker", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "center", v: "center" });

      // checker 中心在 (200, 200)
      // target 中心应该与 checker 中心对齐
      expect(target.x).toBe(200);
      expect(target.y).toBe(200);
    });

    it("should position target at right-bottom of checker", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "right", v: "bottom" });

      // target 右边缘对齐 checker 右边缘
      // checker 右边界: 200 + 100 = 300
      // target 右边缘应该在 300，target 宽度为 50，所以 target 中心 x = 300 - 25 = 275
      expect(target.x).toBe(275);
      expect(target.y).toBe(275);
    });
  });

  describe("willContain=true mode", () => {
    it("should position target at left-top within checker (ignoring checker position)", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 50, y: 50, width: 50, height: 50 });

      adjustTo(checker as any, true)(target as any, { h: "left", v: "top" });

      // willContain=true 时，checker 的位置被忽略
      // 目标位置相对于 checker 的局部坐标
      // checker 宽度 200，target 宽度 50，左对齐
      // 移动量 = 0 - 50 + 25 = -25
      expect(target.x).toBe(25);
      expect(target.y).toBe(25);
    });

    it("should position target at center within checker", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, true)(target as any, { h: "center", v: "center" });

      // 在 checker 内部居中
      // target 中心应该在 (200/2) = 100
      expect(target.x).toBe(100);
      expect(target.y).toBe(100);
    });
  });

  describe("scaled checker (willContain=false)", () => {
    it("should consider checker scale when willContain=false", () => {
      const checker = createMockDisplayObject({
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        scaleX: 2,
        scaleY: 2,
      });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "left", v: "top" });

      // checker 实际宽度 = 100 * 2 = 200
      // checker 左边界: 200 - 200/2 = 100
      // target 左边界对齐 checker 左边界
      expect(target.x).toBe(125);
      expect(target.y).toBe(125);
    });

    it("should position at right of scaled checker", () => {
      const checker = createMockDisplayObject({
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        scaleX: 2,
        scaleY: 2,
      });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "right", v: "top" });

      // checker 实际宽度 = 200, 右边界 = 200 + 100 = 300
      // target 右边缘在 300，中心在 300 - 25 = 275
      expect(target.x).toBe(275);
    });
  });

  describe("scaled checker (willContain=true)", () => {
    it("should ignore checker scale when willContain=true", () => {
      const checker = createMockDisplayObject({
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        scaleX: 2,
        scaleY: 2,
      });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, true)(target as any, { h: "right", v: "bottom" });

      // willContain=true 时忽略 scale，使用原始 width=100
      // checker 右边界在 100，target 右边缘对齐
      // target 中心在 100 - 25 = 75
      expect(target.x).toBe(75);
      expect(target.y).toBe(75);
    });
  });

  describe("offset", () => {
    it("should apply x and y offset", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "left", v: "top" }, { x: 10, y: 20 });

      // 基础位置 125, 加上 offset
      expect(target.x).toBe(135);
      expect(target.y).toBe(145);
    });

    it("should handle negative offset", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "left", v: "top" }, { x: -10, y: -20 });

      expect(target.x).toBe(115);
      expect(target.y).toBe(105);
    });
  });

  describe("different anchor points", () => {
    it("should handle target with anchorX=0, anchorY=0", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        anchorX: 0,
        anchorY: 0,
      });

      adjustTo(checker as any, false)(target as any, { h: "left", v: "top" });

      // anchorX=0 表示 target 的左上角在 x 位置
      // 左对齐时 target 左上角应该在 checker 左边界 100
      expect(target.x).toBe(100);
      expect(target.y).toBe(100);
    });

    it("should handle target with anchorX=1, anchorY=1", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        anchorX: 1,
        anchorY: 1,
      });

      adjustTo(checker as any, false)(target as any, { h: "right", v: "bottom" });

      // anchorX=1 表示 target 的右下角在 x 位置
      // 右对齐时 target 右下角应该在 checker 右边界 300
      expect(target.x).toBe(300);
      expect(target.y).toBe(300);
    });
  });

  describe("partial adjustments", () => {
    it("should only adjust horizontal when v is not provided", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 50, y: 50, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { h: "center" });

      // y 应该不变
      // x 应该调整到 checker 中心 (200)
      expect(target.x).toBe(200);
      expect(target.y).toBe(50);
    });

    it("should only adjust vertical when h is not provided", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 200, height: 200 });
      const target = createMockDisplayObject({ x: 50, y: 50, width: 50, height: 50 });

      adjustTo(checker as any, false)(target as any, { v: "center" });

      // x 应该不变
      // y 应该调整到 checker 中心 (200)
      expect(target.x).toBe(50);
      expect(target.y).toBe(200);
    });
  });

  describe("edge cases", () => {
    it("should handle target larger than checker", () => {
      const checker = createMockDisplayObject({ x: 200, y: 200, width: 100, height: 100 });
      const target = createMockDisplayObject({ x: 0, y: 0, width: 200, height: 200 });

      adjustTo(checker as any, false)(target as any, { h: "center", v: "center" });

      // 即使 target 更大，也应该正确居中
      expect(target.x).toBe(200);
      expect(target.y).toBe(200);
    });

    it("should return target for chaining", () => {
      const checker = createMockDisplayObject();
      const target = createMockDisplayObject();

      const result = adjustTo(checker as any, false)(target as any, { h: "left", v: "top" });

      expect(result).toBe(target);
    });
  });
});
