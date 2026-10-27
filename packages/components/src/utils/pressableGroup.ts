import type { Container } from "@shuizhongyueming/tiny-ui-core";
import { onPressableDispose, type PressableInstance } from "../Pressable";

/* Pressable 的归属登记。
   目的有两个：
   1. 容器销毁时释放挂在子树里的输入面监听；
   2. 弹窗要关闭时，能一次取消「它内部所有」正在按下的控件 —— 包括 TextBtn
      这种以自身为 owner 登记的。

   因此查询按**子树**生效，而不是只查登记时写的那个 owner。 */

interface Registration {
  pressable: PressableInstance;
  offDispose: () => void;
}

const registrations = new Set<Registration>();

/** 从节点向上走到 root，判断 `node` 是否在 `owner` 的子树里（含自身）。 */
function isInSubtree(node: Container, owner: Container): boolean {
  let current: Container | null = node;
  while (current) {
    if (current === owner) return true;
    current = current.parent as Container | null;
  }
  return false;
}

export function registerPressable(owner: Container, pressable: PressableInstance): void {
  owner.on("destroyed", () => pressable.destroy());
  const record: Registration = { pressable, offDispose: () => {} };
  record.offDispose = onPressableDispose(pressable, () => {
    registrations.delete(record);
  });
  registrations.add(record);

  // 控件节点自己先没了也要解除登记，避免残留引用
  const node = pressable.node as Container;
  const offNodeDestroyed = node.on("destroyed", () => {
    offNodeDestroyed();
    record.offDispose();
    registrations.delete(record);
  });
}

/**
 * 取消 `owner` 子树里所有正在按下的控件。
 *
 * 只取消手势（`cancel()`），不 `setEnabled(false)` —— 弹窗关闭时按下视觉要复位，
 * 但同一个控件在容器被复用时还得能点。真正要禁用请自己调 `setEnabled`。
 */
export function cancelPressables(owner: Container): void {
  for (const record of Array.from(registrations)) {
    if (!isInSubtree(record.pressable.node as Container, owner)) continue;
    record.pressable.cancel();
  }
}

/** 把内容挂到弹窗里。所有权归弹窗：弹窗销毁时内容一并销毁。 */
export function trackPopupContent(popup: Container, content: Container): void {
  popup.addChild(content);
}
