import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Graphics } from "../../src/Graphics";
import { resetDiagnosticsForTest, setDiagnosticsEnabled } from "../../src/utils/diagnostics";
import type TinyUI from "../../src/TinyUI";

const mockApp = { stageWidth: 390, stageHeight: 844 } as TinyUI;

describe("Graphics 内容边界：union 必须幂等", () => {
  beforeEach(() => {
    resetDiagnosticsForTest();
    setDiagnosticsEnabled(false);
  });
  afterEach(() => setDiagnosticsEnabled(undefined));

  it("重复同一条命令不放大尺寸 —— 修复前的核心缺陷", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 100);
    expect([g.width, g.height]).toEqual([100, 100]);

    // 修复前：100 → 150 → 175 → 187.5
    g.drawRect(0, 0, 100, 100);
    g.drawRect(0, 0, 100, 100);
    g.drawRect(0, 0, 100, 100);

    expect([g.width, g.height]).toEqual([100, 100]);
    expect(g.contentBounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("绘制顺序不影响 union 结果", () => {
    const a = new Graphics(mockApp);
    a.drawRect(0, 0, 50, 20);
    a.drawRect(100, 80, 40, 40);

    const b = new Graphics(mockApp);
    b.drawRect(100, 80, 40, 40);
    b.drawRect(0, 0, 50, 20);

    expect(a.contentBounds).toEqual(b.contentBounds);
    expect([a.width, a.height]).toEqual([b.width, b.height]);
  });

  it("多命令取真实并集，不是首条命令 + 增量", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 100, 1);
    expect([g.width, g.height]).toEqual([100, 1]);

    g.drawRect(0, 99, 100, 1);
    // 修复前是 150×100.5
    expect([g.width, g.height]).toEqual([100, 100]);
    expect(g.contentBounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("记录第一条命令的偏移 —— 修复前位置信息完全丢失", () => {
    const g = new Graphics(mockApp);
    g.drawRect(50, 60, 10, 20);

    expect(g.contentBounds).toEqual({ x: 50, y: 60, width: 10, height: 20 });
    // 布局尺寸只反映内容大小，位置在 contentBounds.x/y 里
    expect([g.width, g.height]).toEqual([10, 20]);
  });

  it("负坐标参与 union", () => {
    const g = new Graphics(mockApp);
    g.drawRect(-20, -30, 10, 10);
    g.drawRect(5, 5, 10, 10);

    expect(g.contentBounds).toEqual({ x: -20, y: -30, width: 35, height: 45 });
  });

  it("负宽高归一化后再 union，不产生负尺寸", () => {
    const g = new Graphics(mockApp);
    g.drawRect(10, 10, -10, -10);

    expect(g.contentBounds).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(g.width).toBeGreaterThanOrEqual(0);
    expect(g.height).toBeGreaterThanOrEqual(0);
  });
});

describe("内容盒覆盖三类绘制命令", () => {
  beforeEach(() => {
    resetDiagnosticsForTest();
    setDiagnosticsEnabled(false);
  });
  afterEach(() => setDiagnosticsEnabled(undefined));

  it("drawCircle 用外接矩形", () => {
    const g = new Graphics(mockApp);
    g.drawCircle(50, 50, 20);

    expect(g.contentBounds).toEqual({ x: 30, y: 30, width: 40, height: 40 });
  });

  it("drawRoundedRect 用外接矩形", () => {
    const g = new Graphics(mockApp);
    g.drawRoundedRect(10, 20, 100, 40, 8, "#000");

    expect(g.contentBounds).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  it("矩形与圆混合时取并集", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 10, 10);
    g.drawCircle(100, 100, 10);

    expect(g.contentBounds).toEqual({ x: 0, y: 0, width: 110, height: 110 });
  });

  it("空节点的内容盒全为零", () => {
    const g = new Graphics(mockApp);
    expect(g.contentBounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("尺寸模式（方案 Y：显式尺寸不被绘制覆盖）", () => {
  beforeEach(() => {
    resetDiagnosticsForTest();
    setDiagnosticsEnabled(false);
  });
  afterEach(() => setDiagnosticsEnabled(undefined));

  it("默认是 auto", () => {
    const g = new Graphics(mockApp);
    expect(g.sizeMode).toBe("auto");
  });

  it("auto 模式下尺寸跟随内容", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 30, 40);
    expect(g.sizeMode).toBe("auto");
    expect([g.width, g.height]).toEqual([30, 40]);
  });

  it("setSize 进入 explicit 模式", () => {
    const g = new Graphics(mockApp);
    g.setSize(200, 100);
    expect(g.sizeMode).toBe("explicit");
    expect([g.width, g.height]).toEqual([200, 100]);
  });

  it("explicit 模式下后续绘制不改写布局尺寸 —— 方案 Y 的核心", () => {
    const g = new Graphics(mockApp);
    g.setSize(200, 100);
    g.drawRect(0, 0, 30, 40);

    expect([g.width, g.height]).toEqual([200, 100]);
    // 内容盒照常记录
    expect(g.contentBounds).toEqual({ x: 0, y: 0, width: 30, height: 40 });
  });

  it("explicit 模式下内容可以超出布局盒，尺寸不变", () => {
    const g = new Graphics(mockApp);
    g.setSize(50, 50);
    g.drawRect(0, 0, 300, 300);

    expect([g.width, g.height]).toEqual([50, 50]);
    expect(g.contentBounds.width).toBe(300);
  });

  it("autoSize() 回到 auto 并按内容重算", () => {
    const g = new Graphics(mockApp);
    g.setSize(200, 100);
    g.drawRect(0, 0, 30, 40);
    expect(g.sizeMode).toBe("explicit");

    g.autoSize();

    expect(g.sizeMode).toBe("auto");
    expect([g.width, g.height]).toEqual([30, 40]);
  });

  it("autoSize() 在空节点上把尺寸归零", () => {
    const g = new Graphics(mockApp);
    g.setSize(200, 100);
    g.autoSize();

    expect([g.width, g.height]).toEqual([0, 0]);
  });

  it("clear() 保持尺寸模式 —— setSize 表达的是布局意图", () => {
    const g = new Graphics(mockApp);
    g.setSize(200, 100);
    g.drawRect(0, 0, 30, 40);
    g.clear();

    expect(g.sizeMode).toBe("explicit");
    expect([g.width, g.height]).toEqual([200, 100]);
    expect(g.contentBounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("clear() 后重画，auto 模式重新推导", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 30, 40);
    g.clear();
    expect([g.width, g.height]).toEqual([0, 0]);

    g.drawRect(0, 0, 70, 20);
    expect([g.width, g.height]).toEqual([70, 20]);
  });

  it("explicit 模式下 clear 后重画，尺寸仍然锁定", () => {
    const g = new Graphics(mockApp);
    g.setSize(120, 60);
    g.clear();
    g.drawRect(0, 0, 500, 500);

    expect([g.width, g.height]).toEqual([120, 60]);
    expect(g.contentBounds.width).toBe(500);
  });
});

describe("回归：组件里 clear + draw 的既有用法不受影响", () => {
  beforeEach(() => {
    resetDiagnosticsForTest();
    setDiagnosticsEnabled(false);
  });
  afterEach(() => setDiagnosticsEnabled(undefined));

  it("每帧 clear 再重画，尺寸稳定（滚动条 / 按钮底色的模式）", () => {
    const g = new Graphics(mockApp);
    for (let i = 0; i < 10; i++) {
      g.clear();
      g.drawRoundedRect(0, 0, 100, 8, 4, "#000");
      expect([g.width, g.height]).toEqual([100, 8]);
    }
  });

  it("没有 setSize 时 draw 仍然接管尺寸（TextBtn / ShapeRect 的模式）", () => {
    const g = new Graphics(mockApp);
    g.drawRect(0, 0, 88, 44, "#000");
    g.drawRect(0, 0, 88, 44, "#fff"); // 重画同尺寸
    expect([g.width, g.height]).toEqual([88, 44]);
  });
});
