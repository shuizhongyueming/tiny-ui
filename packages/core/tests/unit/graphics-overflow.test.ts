import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Graphics } from "../../src/Graphics";
import { resetDiagnosticsForTest, setDiagnosticsEnabled } from "../../src/utils/diagnostics";
import type TinyUI from "../../src/TinyUI";

const mockApp = { stageWidth: 390, stageHeight: 844 } as TinyUI;

/**
 * 里程碑 C：尺寸冲突诊断（配合里程碑 B4 的方案 Y）。
 *
 * 方案 Y 之后 `setSize()` 之后绘制不再改写布局尺寸，于是「内容画到盒子外面」
 * 变成一个**不报错、不改任何数值**的状态 —— 正是需要诊断的那种静默失败。
 */
describe("explicit 模式下内容溢出布局盒", () => {
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    resetDiagnosticsForTest();
    setDiagnosticsEnabled(true);
    vi.spyOn(console, "warn").mockImplementation((msg: string) => warnings.push(msg));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDiagnosticsEnabled(undefined);
  });

  it("内容超出右边界时提示", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(50, 50);
    g.drawRect(0, 0, 300, 300);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("显式尺寸");
    expect(warnings[0]).toContain("50×50");
    expect(warnings[0]).toContain("右");
  });

  it("内容超出左/上边界（负坐标）时也提示", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(50, 50);
    g.drawRect(-20, -20, 10, 10);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("左");
    expect(warnings[0]).toContain("上");
  });

  it("内容完全落在盒内时不提示", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(50, 50);
    g.drawRect(10, 10, 20, 20);

    expect(warnings).toHaveLength(0);
  });

  it("内容正好等于盒子时不提示", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(50, 50);
    g.drawRect(0, 0, 50, 50);

    expect(warnings).toHaveLength(0);
  });

  it("auto 模式永远不提示 —— 尺寸本来就跟内容一致", () => {
    const g = new Graphics(mockApp, "panel");
    g.drawRect(0, 0, 300, 300);

    expect(g.sizeMode).toBe("auto");
    expect(warnings).toHaveLength(0);
  });

  it("auto 模式下内容落在负坐标区也不误报", () => {
    /* 这条专门盯 sizeMode 那道闸：
       auto 模式下 `width` 是内容的**跨度**（max-min），内容起点可以不是 0。
       于是 contentMinX = -20 < 0 会让「超出左边界」成立 —— 只有 sizeMode 检查
       能拦住这个误报。去掉那道检查，本用例必然失败。 */
    const g = new Graphics(mockApp, "panel");
    g.drawRect(-20, -20, 10, 10);

    expect(g.sizeMode).toBe("auto");
    expect(g.contentBounds).toEqual({ x: -20, y: -20, width: 10, height: 10 });
    expect(warnings).toHaveLength(0);
  });

  it("同一节点只提示一次，即使后续继续溢出", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(50, 50);
    g.drawRect(0, 0, 300, 300);
    g.drawRect(0, 0, 400, 400);
    g.drawRect(-99, -99, 10, 10);

    expect(warnings).toHaveLength(1);
  });

  it("不同节点各自提示", () => {
    const a = new Graphics(mockApp, "panel");
    const b = new Graphics(mockApp, "panel");
    a.setSize(10, 10);
    b.setSize(10, 10);
    a.drawRect(0, 0, 100, 100);
    b.drawRect(0, 0, 100, 100);

    expect(warnings).toHaveLength(2);
  });

  it("提示里同时给出内容范围与布局尺寸，指向 setSize / autoSize", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(50, 20);
    g.drawRect(0, 0, 100, 80);

    expect(warnings[0]).toMatch(/显式尺寸 50×20 装不下绘制内容 \[0,0 → 100,80\]/);
    expect(warnings[0]).toContain("setSize");
    expect(warnings[0]).toContain("autoSize()");
  });

  it("setSize 调大后不再提示", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(10, 10);
    g.drawRect(0, 0, 100, 80);
    expect(warnings).toHaveLength(1);

    // 诊断已被去重记住，即使改大也不再重复报（一次性语义）
    g.setSize(200, 200);
    g.drawRect(0, 0, 100, 80);
    expect(warnings).toHaveLength(1);
  });

  it("autoSize() 之后溢出消失，因为尺寸跟着内容走", () => {
    const g = new Graphics(mockApp, "panel");
    g.setSize(10, 10);
    g.drawRect(0, 0, 100, 100);
    expect(warnings).toHaveLength(1);

    g.autoSize();
    expect(g.width).toBe(100);
    expect(g.height).toBe(100);
  });

  it("关闭诊断时不输出，但尺寸行为不变", () => {
    setDiagnosticsEnabled(false);
    const g = new Graphics(mockApp, "panel");
    g.setSize(10, 10);
    g.drawRect(0, 0, 100, 100);

    expect(warnings).toHaveLength(0);
    expect([g.width, g.height]).toEqual([10, 10]);
    expect(g.contentBounds.width).toBe(100);
  });
});
