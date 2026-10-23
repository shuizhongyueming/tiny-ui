import { describe, expect, it } from "vitest";
import { Graphics } from "../../src/Graphics";
import { layoutRow } from "../../src/utils/layout";
import { Container } from "../../src/Container";
import type TinyUI from "../../src/TinyUI";

/**
 * 坐标契约：`pivot`（定位）与 `anchor`（旋转缩放中心）分离。
 * 见 `docs/coordinate-contract.md`。
 *
 * 两个字段默认都是 0.5，所以拆分本身零行为变化。
 * 这些用例锁定的是「把它们设成不同值之后各自只影响自己该影响的东西」。
 */

const mockApp = { stageWidth: 390, stageHeight: 844 } as TinyUI;

/** 取节点本地 (0,0) 在父坐标系里的位置 —— 也就是「盒左上角」。 */
function originOf(node: { getLocalTransformMatrix(): { transformPoint(x: number, y: number): { x: number; y: number } } }) {
  return node.getLocalTransformMatrix().transformPoint(0, 0);
}

describe("pivot 只影响定位", () => {
  it("pivot=0 时 x/y 就是盒左上角", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 50, "#000");
    g.pivotX = 0;
    g.pivotY = 0;
    g.x = 30;
    g.y = 40;

    expect(originOf(g)).toEqual({ x: 30, y: 40 });
  });

  it("pivot=0.5（默认）时 x/y 是盒中心，左上角要减半宽高", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 50, "#000");
    g.x = 30;
    g.y = 40;

    expect(originOf(g)).toEqual({ x: -20, y: 15 });
  });

  it("pivot=1 时 x/y 是右下角", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 50, "#000");
    g.pivotX = 1;
    g.pivotY = 1;
    g.x = 100;
    g.y = 100;

    expect(originOf(g)).toEqual({ x: 0, y: 50 });
  });
});

describe("anchor 只影响旋转缩放中心", () => {
  it("pivot=0 且 anchor=0.5 时，旋转仍绕盒中心", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 100, "#000");
    g.pivotX = 0;
    g.pivotY = 0;
    g.anchorX = 0.5;
    g.anchorY = 0.5;
    g.x = 0;
    g.y = 0;
    g.rotation = 90;

    const m = g.getLocalTransformMatrix();
    // 盒中心（本地 50,50）旋转 90° 后应该还在原位
    const center = m.transformPoint(50, 50);
    expect(center.x).toBeCloseTo(50, 4);
    expect(center.y).toBeCloseTo(50, 4);
  });

  it("anchor 变化不影响 x/y 指向盒的位置", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 100, "#000");
    g.pivotX = 0;
    g.pivotY = 0;
    g.x = 20;
    g.y = 20;

    // anchor 只在不旋转不缩放时完全不起作用
    const before = originOf(g);
    g.anchorX = 1;
    g.anchorY = 1;
    expect(originOf(g)).toEqual(before);
  });
});

describe("与流式布局的配合", () => {
  function makeRow() {
    const container = new Container(mockApp);
    container.pivotX = 0;
    container.pivotY = 0;
    container.setSize(300, 100);

    const a = new Graphics(mockApp);
    a.drawRect(0, 0, 100, 20, "#000");
    const b = new Graphics(mockApp);
    b.drawRect(0, 0, 100, 20, "#000");
    container.addChild(a);
    container.addChild(b);
    return { container, a, b };
  }

  it("pivot=0 的节点左缘落在游标处", () => {
    const { container, a, b } = makeRow();
    a.pivotX = a.pivotY = 0;
    b.pivotX = b.pivotY = 0;

    layoutRow(container, [a, b], { gap: 10, align: "top" });

    expect(a.x).toBe(0);
    expect(b.x).toBe(110);
  });

  it("pivot=0.5 的节点要让左缘落在游标处，x 要多半个宽度", () => {
    const { container, a, b } = makeRow();
    a.pivotX = a.pivotY = 0.5;
    b.pivotX = b.pivotY = 0.5;

    layoutRow(container, [a, b], { gap: 10, align: "top" });

    expect(a.x).toBe(50);
    expect(b.x).toBe(160);
  });

  it("布局读的是 pivot 而不是 anchor —— 两者不同时只有 pivot 生效", () => {
    const { container, a, b } = makeRow();
    a.pivotX = 0;
    a.pivotY = 0;
    a.anchorX = 1; // 故意与 pivot 不同
    b.pivotX = 0;
    b.pivotY = 0;
    b.anchorX = 1;

    layoutRow(container, [a, b], { gap: 10, align: "top" });

    // 若布局误用 anchor，这里会变成 100 / 260
    expect(a.x).toBe(0);
    expect(b.x).toBe(110);
  });
});

describe("createGraphics 的 origin 与 pivot 一致", () => {
  it("origin=topLeft 的语义就是 pivot=0", () => {
    const direct = new Graphics(mockApp);
    direct.drawRect(0, 0, 780, 100, "#000");
    direct.pivotX = direct.pivotY = 0;
    direct.x = 0;
    direct.y = 0;

    // 全屏矩形：盒左上角就落在 (0,0)，铺满
    expect(originOf(direct)).toEqual({ x: 0, y: 0 });

    // 对照：默认 pivot=0.5 时左上角跑到 (-390, -50)，只剩左上四分之一可见
    const withDefault = new Graphics(mockApp);
    withDefault.drawRect(0, 0, 780, 100, "#000");
    withDefault.x = 0;
    withDefault.y = 0;
    expect(originOf(withDefault)).toEqual({ x: -390, y: -50 });
  });
});

describe("pivot 未显式设置时跟随 anchor（兼容旧代码）", () => {
  it("只设 anchorX=0，pivotX 读出来也是 0", () => {
    const g = new Graphics(mockApp);
    g.anchorX = 0;
    expect(g.pivotX).toBe(0);
  });

  it("旧写法 anchorX=0 定位行为与显式 pivotX=0 一致", () => {
    const legacy = new Graphics(mockApp);
    legacy.drawRect(0, 0, 100, 50, "#000");
    legacy.anchorX = legacy.anchorY = 0;
    legacy.x = legacy.y = 0;

    const explicit = new Graphics(mockApp);
    explicit.drawRect(0, 0, 100, 50, "#000");
    explicit.pivotX = explicit.pivotY = 0;
    explicit.x = explicit.y = 0;

    expect(originOf(legacy)).toEqual(originOf(explicit));
    expect(originOf(legacy)).toEqual({ x: 0, y: 0 });
  });

  it("显式设了 pivot 后，再改 anchor 不影响定位", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 50, "#000");
    g.pivotX = g.pivotY = 0;
    g.x = g.y = 10;

    g.anchorX = 1; // 只改旋转中心
    expect(originOf(g)).toEqual({ x: 10, y: 10 });
  });

  it("显式 pivot 优先于之后设置的 anchor", () => {
    const g = new Graphics(mockApp);
    g.pivotX = 0;
    g.anchorX = 0.5;
    expect(g.pivotX).toBe(0);
  });
});
