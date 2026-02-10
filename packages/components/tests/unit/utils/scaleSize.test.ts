import { describe, it, expect } from "vitest";
import { scaleSize } from "../../../src/utils/scaleSize";

describe("scaleSize", () => {
  it("should scale uniformly with single parameter", () => {
    const rect = { width: 100, height: 50 };

    const result = scaleSize(rect, 2);

    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
  });

  it("should scale with different x and y", () => {
    const rect = { width: 100, height: 50 };

    const result = scaleSize(rect, 2, 3);

    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
  });

  it("should handle scale of 1 (no change)", () => {
    const rect = { width: 100, height: 50 };

    const result = scaleSize(rect, 1);

    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
  });

  it("should handle scale less than 1", () => {
    const rect = { width: 100, height: 50 };

    const result = scaleSize(rect, 0.5);

    expect(result.width).toBe(50);
    expect(result.height).toBe(25);
  });

  it("should handle zero scale", () => {
    const rect = { width: 100, height: 50 };

    const result = scaleSize(rect, 0);

    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it("should preserve extra properties", () => {
    const rect = { width: 100, height: 50, x: 10, y: 20 };

    const result = scaleSize(rect, 2);

    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
  });
});
