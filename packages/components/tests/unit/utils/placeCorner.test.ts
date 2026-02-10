import { describe, it, expect, vi, beforeEach } from "vitest";
import { placeCorner } from "../../../src/utils/placeCorner";

// Mock the entire adjustTo module
vi.mock("../../../src/utils/adjustTo", () => ({
  adjustTo: vi.fn(),
}));

// Import the mocked module
import { adjustTo } from "../../../src/utils/adjustTo";

describe("placeCorner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup the mock to return a function
    (adjustTo as any).mockReturnValue(vi.fn());
  });

  it("should call adjustTo with correct parameters for top-left", () => {
    const boundNode = { width: 200, height: 200 } as any;
    const cornerNode = { width: 50, height: 50 } as any;

    placeCorner({
      boundNode,
      cornerNode,
      position: "top-left",
      willContain: true,
    });

    expect(adjustTo).toHaveBeenCalledWith(boundNode, true);
    const returnedFn = (adjustTo as any).mock.results[0].value;
    expect(returnedFn).toHaveBeenCalledWith(cornerNode, { v: "top", h: "left" });
  });

  it("should call adjustTo with correct parameters for top-right", () => {
    const boundNode = { width: 200, height: 200 } as any;
    const cornerNode = { width: 50, height: 50 } as any;

    placeCorner({
      boundNode,
      cornerNode,
      position: "top-right",
    });

    expect(adjustTo).toHaveBeenCalledWith(boundNode, true);
    const returnedFn = (adjustTo as any).mock.results[0].value;
    expect(returnedFn).toHaveBeenCalledWith(cornerNode, { v: "top", h: "right" });
  });

  it("should call adjustTo with correct parameters for bottom-left", () => {
    const boundNode = { width: 200, height: 200 } as any;
    const cornerNode = { width: 50, height: 50 } as any;

    placeCorner({
      boundNode,
      cornerNode,
      position: "bottom-left",
    });

    const returnedFn = (adjustTo as any).mock.results[0].value;
    expect(returnedFn).toHaveBeenCalledWith(cornerNode, { v: "bottom", h: "left" });
  });

  it("should call adjustTo with correct parameters for bottom-right", () => {
    const boundNode = { width: 200, height: 200 } as any;
    const cornerNode = { width: 50, height: 50 } as any;

    placeCorner({
      boundNode,
      cornerNode,
      position: "bottom-right",
    });

    const returnedFn = (adjustTo as any).mock.results[0].value;
    expect(returnedFn).toHaveBeenCalledWith(cornerNode, { v: "bottom", h: "right" });
  });

  it("should use default willContain=true", () => {
    const boundNode = { width: 200, height: 200 } as any;
    const cornerNode = { width: 50, height: 50 } as any;

    placeCorner({
      boundNode,
      cornerNode,
      position: "top-left",
    });

    expect(adjustTo).toHaveBeenCalledWith(boundNode, true);
  });

  it("should allow willContain=false", () => {
    const boundNode = { width: 200, height: 200 } as any;
    const cornerNode = { width: 50, height: 50 } as any;

    placeCorner({
      boundNode,
      cornerNode,
      position: "top-left",
      willContain: false,
    });

    expect(adjustTo).toHaveBeenCalledWith(boundNode, false);
  });
});
