import { describe, it, expect } from "vitest";
import { fitSize } from "../../../src/utils/fitSize";

describe("fitSize", () => {
  it("should fit wide image to tall container", () => {
    const source = { width: 200, height: 100 };
    const target = { width: 100, height: 100 };

    const result = fitSize(source, target);

    // 宽度比例 2:1，高度比例 1:1，按宽度缩放
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });

  it("should fit tall image to wide container", () => {
    const source = { width: 100, height: 200 };
    const target = { width: 100, height: 100 };

    const result = fitSize(source, target);

    // 按高度缩放
    expect(result.width).toBe(50);
    expect(result.height).toBe(100);
  });

  it("should fit when source and target have same aspect ratio", () => {
    const source = { width: 200, height: 100 };
    const target = { width: 100, height: 50 };

    const result = fitSize(source, target);

    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });

  it("should fit small image to large container", () => {
    const source = { width: 50, height: 50 };
    const target = { width: 200, height: 200 };

    const result = fitSize(source, target);

    // 应该放大填满容器
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it("should handle square source and rectangular target", () => {
    const source = { width: 100, height: 100 };
    const target = { width: 200, height: 100 };

    const result = fitSize(source, target);

    // 高度限制更严格
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });

  it("should not mutate source object", () => {
    const source = { width: 200, height: 100, extra: "property" };
    const target = { width: 100, height: 100 };

    const result = fitSize(source as any, target);

    // source 应该保持不变
    expect(source.width).toBe(200);
    expect(source.height).toBe(100);
    // result 是新的对象，但保留 source 的属性
    expect(result.extra).toBe("property");
  });
});
