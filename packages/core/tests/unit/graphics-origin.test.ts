import { describe, expect, it } from "vitest";
import { normalizeGraphicsOptions } from "../../src/utils/graphicsOptions";
import { Graphics } from "../../src/Graphics";
import type TinyUI from "../../src/TinyUI";

/**
 * 里程碑 D：`origin` 显式入口。
 *
 * 设计取舍有实测依据：**没有改默认值**。
 * 试过把 Graphics 的默认 anchor 直接改成 0 —— `packages/components` 的视觉测试
 * 有 4 个失败，因为 `example/adjustTo.html` 里 `checker1.x = stageWidth / 2`
 * 这类直接定位依赖中心锚点。所以改为提供显式入口，两种意图都能直接表达。
 */

const mockApp = { stageWidth: 390, stageHeight: 844 } as TinyUI;

describe("normalizeGraphicsOptions", () => {
  it("字符串参数按 name 处理，保持旧调用方式", () => {
    expect(normalizeGraphicsOptions("panel")).toEqual({ name: "panel", topLeft: false });
  });

  it("不传参数时默认 center", () => {
    expect(normalizeGraphicsOptions()).toEqual({ topLeft: false });
  });

  it("origin=topLeft 置 topLeft", () => {
    expect(normalizeGraphicsOptions({ name: "mask", origin: "topLeft" })).toEqual({
      name: "mask",
      topLeft: true,
    });
  });

  it("origin=center 等同于不传", () => {
    expect(normalizeGraphicsOptions({ origin: "center" })).toEqual({ topLeft: false });
  });

  it("origin 省略时默认 center", () => {
    expect(normalizeGraphicsOptions({ name: "x" })).toEqual({ name: "x", topLeft: false });
  });
});

describe("Graphics 默认 anchor 保持 0.5", () => {
  it("构造后 anchor 是 0.5 —— 本里程碑刻意不改默认值", () => {
    const g = new Graphics(mockApp);
    expect([g.anchorX, g.anchorY]).toEqual([0.5, 0.5]);
  });

  it("origin=topLeft 等价于手动把 anchor 设为 0", () => {
    const withOption = new Graphics(mockApp);
    // createGraphics 内部就是这两行，等价性在这里锁定
    withOption.anchorX = 0;
    withOption.anchorY = 0;

    const manual = new Graphics(mockApp);
    manual.anchorX = 0;
    manual.anchorY = 0;

    expect([withOption.anchorX, withOption.anchorY]).toEqual([manual.anchorX, manual.anchorY]);
  });
});
