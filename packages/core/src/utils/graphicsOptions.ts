/** `createGraphics` 的选项。 */
export interface CreateGraphicsOptions {
  /** 节点名，出现在诊断消息里。 */
  name?: string;
  /**
   * 本地坐标原点落在节点上的位置。对应 `pivotX / pivotY`（不是 `anchor`）。
   *
   * - `"center"`（默认）：`pivot = 0.5`，`x/y` 指节点中心
   * - `"topLeft"`：`pivot = 0`，`drawRect(0, 0, w, h)` 从该点铺开
   *
   * 两种情况都不改动 `anchor`，旋转缩放中心始终是盒中心。
   */
  origin?: "center" | "topLeft";
}

/**
 * 把 `createGraphics` 的参数归一化。
 *
 * 单独抽出来是为了可测 —— `TinyUI.ts` 用 `export =`，在 ESM 测试里拿不到运行时值。
 */
export function normalizeGraphicsOptions(
  input?: string | CreateGraphicsOptions,
): { name?: string; topLeft: boolean } {
  if (typeof input === "string") return { name: input, topLeft: false };
  if (input === undefined || input === null) return { topLeft: false };
  return { name: input.name, topLeft: input.origin === "topLeft" };
}
