import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeValue,
  isDiagnosticsEnabled,
  nodeLabel,
  resetDiagnostic,
  resetDiagnosticsForTest,
  setDiagnosticsEnabled,
  warnOnce,
} from "../../src/utils/diagnostics";

describe("diagnostics 开关", () => {
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    resetDiagnosticsForTest();
    vi.spyOn(console, "warn").mockImplementation((msg: string) => {
      warnings.push(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("默认开启（测试环境 NODE_ENV !== production）", () => {
    expect(isDiagnosticsEnabled()).toBe(true);
  });

  it("显式关闭后不再输出", () => {
    setDiagnosticsEnabled(false);
    expect(isDiagnosticsEnabled()).toBe(false);
    warnOnce({}, "E_GEOM_NONFINITE", "drawRect", "detail", "hint");
    expect(warnings).toHaveLength(0);
  });

  it("显式开启可以覆盖生产环境判断", () => {
    setDiagnosticsEnabled(true);
    expect(isDiagnosticsEnabled()).toBe(true);
  });

  it("传 undefined 恢复自动判断", () => {
    setDiagnosticsEnabled(false);
    setDiagnosticsEnabled(undefined);
    expect(isDiagnosticsEnabled()).toBe(true);
  });
});

describe("warnOnce 去重", () => {
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
  });

  it("同节点同诊断码只报一次", () => {
    const node = { name: "Graphics" };
    warnOnce(node, "E_GEOM_NONFINITE", "drawRect", "d", "h");
    warnOnce(node, "E_GEOM_NONFINITE", "drawRect", "d", "h");
    expect(warnings).toHaveLength(1);
  });

  it("同节点不同 API 各自能报", () => {
    const node = { name: "Graphics" };
    warnOnce(node, "E_GEOM_NONFINITE", "drawRect", "d", "h");
    warnOnce(node, "E_GEOM_NONFINITE", "drawCircle", "d", "h");
    expect(warnings).toHaveLength(2);
  });

  it("不同节点的同类问题各自能报 —— 即使默认 name 相同", () => {
    // 这是关键回归：按 name 去重会让第一个节点吞掉第二个的同类诊断
    const a = { name: "Graphics" };
    const b = { name: "Graphics" };
    warnOnce(a, "E_GEOM_NONFINITE", "drawRect", "d", "h");
    warnOnce(b, "E_GEOM_NONFINITE", "drawRect", "d", "h");
    expect(warnings).toHaveLength(2);
  });

  it("消息格式带节点标识、API、描述与建议", () => {
    warnOnce({ name: "Graphics" }, "E_GEOM_NONFINITE", "drawRect", "width 是 NaN", "检查上游");
    expect(warnings[0]).toMatch(/^\[TinyUI\] Graphics#\d+\.drawRect: width 是 NaN → 检查上游$/);
  });

  it("resetDiagnostic 让同一诊断能再次报告", () => {
    const node = { name: "Graphics" };
    warnOnce(node, "W_ZERO_VIEWPORT", "render", "d", "h");
    warnOnce(node, "W_ZERO_VIEWPORT", "render", "d", "h");
    expect(warnings).toHaveLength(1);

    resetDiagnostic(node, "W_ZERO_VIEWPORT");
    warnOnce(node, "W_ZERO_VIEWPORT", "render", "d", "h");
    expect(warnings).toHaveLength(2);
  });

  it("resetDiagnostic 只清指定码，不影响别的诊断", () => {
    const node = { name: "Graphics" };
    warnOnce(node, "W_ZERO_VIEWPORT", "render", "d", "h");
    warnOnce(node, "E_GEOM_NONFINITE", "drawRect", "d", "h");
    resetDiagnostic(node, "W_ZERO_VIEWPORT");
    warnOnce(node, "E_GEOM_NONFINITE", "drawRect", "d", "h");
    expect(warnings).toHaveLength(2);
  });
});

describe("nodeLabel", () => {
  beforeEach(() => resetDiagnosticsForTest());

  it("同名节点获得不同编号", () => {
    const a = { name: "Graphics" };
    const b = { name: "Graphics" };
    expect(nodeLabel(a)).not.toBe(nodeLabel(b));
  });

  it("同一节点编号稳定", () => {
    const a = { name: "Graphics" };
    expect(nodeLabel(a)).toBe(nodeLabel(a));
  });

  it("无 name 时只用编号", () => {
    expect(nodeLabel({})).toMatch(/^#\d+$/);
  });

  it("空字符串 name 按无 name 处理", () => {
    expect(nodeLabel({ name: "" })).toMatch(/^#\d+$/);
  });
});

describe("describeValue", () => {
  it("区分 NaN / Infinity / -Infinity", () => {
    expect(describeValue(NaN)).toBe("NaN");
    expect(describeValue(Infinity)).toBe("Infinity");
    expect(describeValue(-Infinity)).toBe("-Infinity");
  });

  it("null / undefined / 非数字类型", () => {
    expect(describeValue(null)).toBe("null");
    expect(describeValue(undefined)).toBe("undefined");
    expect(describeValue("10")).toBe("string");
  });

  it("正常数字原样输出", () => {
    expect(describeValue(42)).toBe("42");
    expect(describeValue(0)).toBe("0");
    expect(describeValue(-3.5)).toBe("-3.5");
  });
});
