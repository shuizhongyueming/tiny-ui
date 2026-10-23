import { describe, it, expect, vi } from "vitest";
import { scaleToSize } from "../../../src/utils/scaleToSize";

/**
 * scaleToSize 的语义是「把节点设成目标尺寸」——布局尺寸，不是视觉缩放。
 *
 * 历史实现是 `obj.scaleToFit(w, h)`（只改 scale），节点在 layoutRow / adjustTo 的
 * move 偏移里仍按原始尺寸占位。现在改为 `setSize`，让「尺寸」只有一个真值。
 * 所以这里断言 setSize，而不是 scaleToFit。
 */
describe("scaleToSize", () => {
  const makeObj = () => {
    const setSize = vi.fn();
    return { obj: { setSize } as any, setSize };
  };

  it("调用 setSize（布局尺寸），不是 scaleToFit", () => {
    const { obj, setSize } = makeObj();
    scaleToSize(obj, { width: 100, height: 50 });
    expect(setSize).toHaveBeenCalledWith(100, 50);
  });

  it("返回原对象便于链式调用", () => {
    const { obj } = makeObj();
    expect(scaleToSize(obj, { width: 100, height: 50 })).toBe(obj);
  });

  it("零尺寸也照常设置", () => {
    const { obj, setSize } = makeObj();
    scaleToSize(obj, { width: 0, height: 0 });
    expect(setSize).toHaveBeenCalledWith(0, 0);
  });

  it("大尺寸不截断", () => {
    const { obj, setSize } = makeObj();
    scaleToSize(obj, { width: 9999, height: 9999 });
    expect(setSize).toHaveBeenCalledWith(9999, 9999);
  });

  it("宽度与高度分别传递（不假设正方形）", () => {
    const { obj, setSize } = makeObj();
    scaleToSize(obj, { width: 320, height: 18 });
    expect(setSize).toHaveBeenCalledWith(320, 18);
  });
});
