import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Graphics } from "../../src/Graphics";
import { Text } from "../../src/Text";
import { resetDiagnosticsForTest, setDiagnosticsEnabled } from "../../src/utils/diagnostics";
import type TinyUI from "../../src/TinyUI";

/**
 * 诊断层的验收重点不是「有没有 warn」，而是：
 *
 * 1. **校验与拒绝始终执行** —— 关掉诊断后 `NaN` 依然不能污染边界。
 * 2. **去重按节点实例** —— 同名节点各自能报。
 * 3. **零视口按状态周期** —— 归零 → 恢复 → 再归零能再次提示。
 */
describe("Graphics 参数校验", () => {
  let warnings: string[];
  const mockApp = { stageWidth: 390, stageHeight: 844 } as TinyUI;

  beforeEach(() => {
    warnings = [];
    resetDiagnosticsForTest();
    setDiagnosticsEnabled(true);
    vi.spyOn(console, "warn").mockImplementation((msg: string) => {
      warnings.push(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDiagnosticsEnabled(undefined);
  });

  describe("非有限参数被丢弃", () => {
    it("drawRect 收到 NaN 宽时不进入命令列表", () => {
      const g = new Graphics(mockApp);
      g.drawRect(0, 0, NaN, 10, "#000");

      expect(g.commands).toHaveLength(0);
      expect(g.width).toBe(0);
      expect(warnings[0]).toContain("NaN");
      expect(warnings[0]).toContain("drawRect");
    });

    it("drawRect 的 x/y 为 NaN 同样被拦", () => {
      const g = new Graphics(mockApp);
      g.drawRect(NaN, 0, 10, 10, "#000");
      expect(g.commands).toHaveLength(0);
    });

    it("Infinity 被拦", () => {
      const g = new Graphics(mockApp);
      g.drawRect(0, 0, Infinity, 10, "#000");
      expect(g.commands).toHaveLength(0);
    });

    it("drawCircle 的 radius 为 NaN 被拦", () => {
      const g = new Graphics(mockApp);
      g.drawCircle(0, 0, NaN, "#000");
      expect(g.commands).toHaveLength(0);
    });

    it("drawRoundedRect 的 radius 对象逐字段校验", () => {
      const g = new Graphics(mockApp);
      g.drawRoundedRect(0, 0, 10, 10, { tl: 4, tr: NaN, br: 4, bl: 4 }, "#000");

      expect(g.commands).toHaveLength(0);
      expect(warnings[0]).toContain("radius.tr");
    });

    it("drawRoundedRect 的 radius 对象缺字段也算非法", () => {
      const g = new Graphics(mockApp);
      g.drawRoundedRect(0, 0, 10, 10, { tl: 4 } as never, "#000");

      expect(g.commands).toHaveLength(0);
      expect(warnings[0]).toContain("radius.tr");
    });

    it("radius 传 null 给出专门提示", () => {
      const g = new Graphics(mockApp);
      g.drawRoundedRect(0, 0, 10, 10, null as never, "#000");

      expect(g.commands).toHaveLength(0);
      expect(warnings[0]).toContain("既不是数字也不是");
    });
  });

  describe("零尺寸合法、负尺寸只提示不拒绝", () => {
    it("width=0 不报任何诊断", () => {
      const g = new Graphics(mockApp);
      g.drawRect(0, 0, 0, 10, "#000");

      expect(g.commands).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });

    it("负宽高产生诊断但命令保留", () => {
      const g = new Graphics(mockApp);
      g.drawRect(0, 0, -10, 10, "#000");

      expect(g.commands).toHaveLength(1);
      expect(warnings[0]).toContain("负数");
    });

    it("负的 x/y 是合法坐标，不报诊断", () => {
      const g = new Graphics(mockApp);
      g.drawRect(-20, -30, 10, 10, "#000");

      expect(g.commands).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });
  });

  describe("关闭诊断后仍然拒绝 —— 这是本组最重要的断言", () => {
    it("生产构建下 NaN 依然不进入命令列表", () => {
      setDiagnosticsEnabled(false);

      const g = new Graphics(mockApp);
      g.drawRect(0, 0, NaN, 10, "#000");

      expect(g.commands).toHaveLength(0);
      expect(g.width).toBe(0);
      expect(warnings).toHaveLength(0);
    });

    it("关闭诊断后，无效命令不污染后续有效命令的边界", () => {
      setDiagnosticsEnabled(false);

      const g = new Graphics(mockApp);
      g.drawRect(0, 0, NaN, NaN, "#000"); // 被丢弃
      g.drawRect(0, 0, 100, 50, "#000"); // 有效

      expect(g.commands).toHaveLength(1);
      expect(g.width).toBe(100);
      expect(g.height).toBe(50);
    });

    it("开启诊断时，无效命令同样不污染后续边界", () => {
      const g = new Graphics(mockApp);
      g.drawRect(0, 0, NaN, NaN, "#000");
      g.drawRect(0, 0, 100, 50, "#000");

      expect(g.commands).toHaveLength(1);
      expect(g.width).toBe(100);
      expect(g.height).toBe(50);
    });
  });

  describe("去重按节点实例，不按名字", () => {
    it("两个默认同名的 Graphics 各自报一次", () => {
      const a = new Graphics(mockApp);
      const b = new Graphics(mockApp);

      a.drawRect(0, 0, NaN, 10, "#000");
      b.drawRect(0, 0, NaN, 10, "#000");

      expect(warnings).toHaveLength(2);
    });

    it("同一节点重复传 NaN 只报一次", () => {
      const g = new Graphics(mockApp);
      for (let i = 0; i < 5; i++) g.drawRect(0, 0, NaN, 10, "#000");

      expect(warnings).toHaveLength(1);
    });
  });

  describe("零视口按状态周期去重", () => {
    /** 只触发 checkViewportForDraw，不碰真实 GL。 */
    function poke(g: Graphics): void {
      (g as unknown as { checkViewportForDraw: () => void }).checkViewportForDraw();
    }

    it("零视口提示一次", () => {
      const app = { stageWidth: 0, stageHeight: 0 } as TinyUI;
      const g = new Graphics(app);
      g.drawRect(0, 0, 10, 10, "#000");

      poke(g);
      poke(g);

      expect(warnings.filter((w) => w.includes("视口"))).toHaveLength(1);
    });

    it("恢复有效尺寸后再次归零，允许重新提示", () => {
      const app = { stageWidth: 0, stageHeight: 0 } as TinyUI;
      const g = new Graphics(app);
      g.drawRect(0, 0, 10, 10, "#000");

      poke(g); // 归零 → 报
      app.stageWidth = 390;
      app.stageHeight = 844;
      poke(g); // 恢复 → 清标记
      app.stageWidth = 0;
      app.stageHeight = 0;
      poke(g); // 再归零 → 再报

      expect(warnings.filter((w) => w.includes("视口"))).toHaveLength(2);
    });

    it("视口正常时不提示", () => {
      const g = new Graphics(mockApp);
      g.drawRect(0, 0, 10, 10, "#000");
      poke(g);

      expect(warnings).toHaveLength(0);
    });
  });
});

describe("Text.setSize 提示", () => {
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    resetDiagnosticsForTest();
    setDiagnosticsEnabled(true);
    vi.spyOn(console, "warn").mockImplementation((msg: string) => {
      warnings.push(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDiagnosticsEnabled(undefined);
  });

  it("调用时提示一次并指出替代方案", () => {
    const mockApp = {} as TinyUI;
    const text = new Text(mockApp, "hello");
    text.setSize(100, 50);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("fontSize");
    expect(warnings[0]).toContain("scale");
  });

  it("重复调用只提示一次", () => {
    const mockApp = {} as TinyUI;
    const text = new Text(mockApp, "hello");
    text.setSize(100, 50);
    text.setSize(200, 80);

    expect(warnings).toHaveLength(1);
  });

  it("依然不改变尺寸（行为未变）", () => {
    const mockApp = {} as TinyUI;
    const text = new Text(mockApp, "hello");
    const before = { width: text.width, height: text.height };
    text.setSize(999, 999);

    expect(text.width).toBe(before.width);
    expect(text.height).toBe(before.height);
  });

  it("关闭诊断后完全静默", () => {
    setDiagnosticsEnabled(false);
    const mockApp = {} as TinyUI;
    const text = new Text(mockApp, "hello");
    text.setSize(100, 50);

    expect(warnings).toHaveLength(0);
  });
});
