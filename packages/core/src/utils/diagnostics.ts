/**
 * 开发期诊断。
 *
 * 存在的理由：这一层要拦住的都是**静默失败** —— 画面错了，但尺寸、`getBounds()`、
 * `hitTest()` 全部看起来正常，没有任何异常。调用方只能靠肉眼比对截图才能发现，
 * 而且往往要排查很久。
 *
 * 两条硬规则：
 *
 * 1. **校验与拒绝始终执行，`isDiagnosticsEnabled()` 只控制「说不说」。**
 *    绝不能写成 `if (isDiagnosticsEnabled()) { validate(...) }` —— 那样生产构建
 *    仍然接受 `NaN` 并污染边界，只是没人看见。校验函数负责返回「这条命令能不能要」，
 *    诊断只负责解释原因。
 *
 * 2. **去重键是「节点实例 + 诊断码 + API」，不是节点名字。**
 *    多个 `Graphics` 默认都叫 `"Graphics"`（`new Graphics(app, name = "Graphics")`），
 *    按名字去重会让第一个报错节点吞掉其他节点的同类问题。
 */

declare const process: { env: Record<string, string | undefined> };

export type DiagnosticCode =
  /** 几何参数不是有限数值（`NaN` / `Infinity` / `null` / 非数字）。命令会被丢弃。 */
  | "E_GEOM_NONFINITE"
  /** 宽高或半径为负。命令保留，但会产生反向几何与负尺寸边界。 */
  | "W_GEOM_NEGATIVE"
  /** `Text.setSize` 是 no-op，调用不会生效。 */
  | "W_TEXT_SET_SIZE"
  /** 视口尺寸为 0 时仍在绘制内容，结果什么都画不出来。 */
  | "W_ZERO_VIEWPORT"
  /** 显式尺寸模式下，绘制内容超出了布局盒。 */
  | "W_CONTENT_OVERFLOW";

let override: boolean | undefined;

/**
 * 显式开关。传 `undefined` 恢复按环境自动判断。
 *
 * 生产构建请调用 `setDiagnosticsEnabled(false)`，或设置 `process.env.NODE_ENV=production`。
 */
export function setDiagnosticsEnabled(enabled: boolean | undefined): void {
  override = enabled;
}

/**
 * 当前是否应输出诊断。
 *
 * 默认：`NODE_ENV === "production"` 时关闭，其余情况开启。
 * 探测不到 `process` 时（浏览器里没有做构建期替换）按开发环境处理 —— 宁可多说。
 */
export function isDiagnosticsEnabled(): boolean {
  if (override !== undefined) return override;
  return !isProductionBuild();
}

/**
 * 是否生产构建。
 *
 * 写成 `process.env.NODE_ENV` 的字面形式，是为了让 esbuild / Vite 的 `define`
 * 能把它替换成常量、进而被 tree-shaking 消除。未被替换时（浏览器里没有 `process`）
 * 会抛 `ReferenceError`，被 catch 兜住 —— 此时按开发环境处理，宁可多说。
 */
function isProductionBuild(): boolean {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
    return false;
  }
}

/** 每个节点已经报过的诊断，键为 `${code}:${api}`。 */
const reported = new WeakMap<object, Set<string>>();

/** 节点的稳定编号，用于在消息里区分同名节点。 */
const labels = new WeakMap<object, number>();
let nextLabel = 1;

/**
 * 生成节点显示名：`Graphics#3`。
 *
 * 编号只有诊断用到，与业务无关，但能让「同类问题各自能报出来」这件事可验证。
 */
export function nodeLabel(owner: object): string {
  let id = labels.get(owner);
  if (id === undefined) {
    id = nextLabel++;
    labels.set(owner, id);
  }
  const name = (owner as { name?: unknown }).name;
  return typeof name === "string" && name !== "" ? `${name}#${id}` : `#${id}`;
}

/** 把任意输入渲染成一条能看懂的短描述。 */
export function describeValue(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return String(value);
  }
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return typeof value;
}

/**
 * 报告一次诊断，同一 `(节点, 诊断码, API)` 只报一次。
 *
 * @returns 恒为 `undefined`，纯粹为了让调用处能写成一行。
 */
export function warnOnce(
  owner: object,
  code: DiagnosticCode,
  api: string,
  detail: string,
  hint: string,
): void {
  if (!isDiagnosticsEnabled()) return;

  let seen = reported.get(owner);
  if (seen === undefined) {
    seen = new Set();
    reported.set(owner, seen);
  }
  const key = `${code}:${api}`;
  if (seen.has(key)) return;
  seen.add(key);

  console.warn(`[TinyUI] ${nodeLabel(owner)}.${api}: ${detail} → ${hint}`);
}

/**
 * 清除某个节点的诊断记忆，让它能再次报告。
 *
 * 用于**状态周期性**的诊断：零视口在「进入零尺寸 → 恢复 → 再次归零」时应该重新提示，
 * 而不是整个会话只提示一次。
 */
export function resetDiagnostic(owner: object, code?: DiagnosticCode): void {
  const seen = reported.get(owner);
  if (seen === undefined) return;
  if (code === undefined) {
    seen.clear();
    return;
  }
  for (const key of seen) {
    if (key.startsWith(`${code}:`)) seen.delete(key);
  }
}

/** 仅供测试：清空编号与记忆，让每个用例从干净状态开始。 */
export function resetDiagnosticsForTest(): void {
  override = undefined;
  nextLabel = 1;
}
