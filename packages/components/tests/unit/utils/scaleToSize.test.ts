import { describe, it, expect, vi } from "vitest";
import { scaleToSize } from "../../../src/utils/scaleToSize";

describe("scaleToSize", () => {
  it("should call scaleToFit on the object", () => {
    const mockScaleToFit = vi.fn();
    const obj = {
      scaleToFit: mockScaleToFit,
    } as any;
    const targetSize = { width: 100, height: 50 };

    scaleToSize(obj, targetSize);

    expect(mockScaleToFit).toHaveBeenCalledWith(100, 50);
  });

  it("should return the object for chaining", () => {
    const obj = {
      scaleToFit: vi.fn(),
    } as any;
    const targetSize = { width: 100, height: 50 };

    const result = scaleToSize(obj, targetSize);

    expect(result).toBe(obj);
  });

  it("should handle zero dimensions", () => {
    const mockScaleToFit = vi.fn();
    const obj = {
      scaleToFit: mockScaleToFit,
    } as any;
    const targetSize = { width: 0, height: 0 };

    scaleToSize(obj, targetSize);

    expect(mockScaleToFit).toHaveBeenCalledWith(0, 0);
  });

  it("should handle large dimensions", () => {
    const mockScaleToFit = vi.fn();
    const obj = {
      scaleToFit: mockScaleToFit,
    } as any;
    const targetSize = { width: 9999, height: 9999 };

    scaleToSize(obj, targetSize);

    expect(mockScaleToFit).toHaveBeenCalledWith(9999, 9999);
  });
});
