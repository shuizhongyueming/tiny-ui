import type { TinyUI, DisplayObject } from "@shuizhongyueming/tiny-ui-core";
import type { UIEvent } from "@shuizhongyueming/tiny-ui-core";

export interface PressableOptions {
  onTap?: () => void;
  onPressChange?: (pressed: boolean) => void;
  /** 按下时节点 y 的位移（正数向下）。命中判定按起手位置算，不受位移影响。 */
  pressDy?: number;
  /** 命中容差：抬起点距节点盒边缘多少像素内仍算命中。默认 0。 */
  slop?: number;
  /**
   * 移动距离阈值：起手点移动超过该距离即**永久**取消本次手势。
   * 与 `slop` 是两件事 —— `slop` 判定「抬起点还在不在按钮上」，
   * `moveThreshold` 判定「这还算不算一次点击」（滚动/拖拽里用它）。
   */
  moveThreshold?: number;
  stopPropagation?: boolean;
}

export interface PressableInstance {
  readonly node: DisplayObject;
  setEnabled(enabled: boolean): void;
  /**
   * 取消当前手势：复位按下视觉、本次手势不再触发 `onTap`，
   * 但**保留**指针直到抬手 —— 否则这次释放会穿透到下层。
   * 控件本身保持可用，下次按下照常工作。
   */
  cancel(): void;
  destroy(): void;
}

/** 鼠标在画布外松开时 canvas 收不到 mouseup，用 window 级监听兜底。 */
type WindowLike = {
  addEventListener(type: string, handler: (event: unknown) => void, capture?: boolean): void;
  removeEventListener(type: string, handler: (event: unknown) => void, capture?: boolean): void;
};

const MOUSE_TYPES = new Set(["mousedown", "mousemove", "mouseup"]);

/* 内部生命周期钩子：让 pressableGroup 在 destroy 时解除登记，不污染公开接口。 */
const disposeHooks = new WeakMap<PressableInstance, Set<() => void>>();

export function onPressableDispose(
  pressable: PressableInstance,
  callback: () => void,
): () => void {
  let hooks = disposeHooks.get(pressable);
  if (!hooks) {
    hooks = new Set();
    disposeHooks.set(pressable, hooks);
  }
  hooks.add(callback);
  return () => hooks!.delete(callback);
}

export function Pressable(app: TinyUI, node: DisplayObject,
  options: PressableOptions = {}): PressableInstance {
  const slop = options.slop ?? 0;
  const moveThreshold = options.moveThreshold ?? 0;
  const pressDy = options.pressDy ?? 0;
  let pointer: number | null = null;
  let cancelled = false;
  let pressed = false;
  let enabled = true;
  let disposed = false;
  let removeObserver: (() => void) | null = null;
  let removeWindow: (() => void) | null = null;
  let detachDestroy: (() => void) | null = null;
  let baseY = node.y;
  let startX = 0;
  let startY = 0;

  const isMouse = (event: UIEvent) => MOUSE_TYPES.has(event.type);
  const pointerOf = (event: UIEvent) => (isMouse(event) ? -1 : event.identifier);

  function isAlive(): boolean {
    for (let current: DisplayObject | null = node; current; current = current.parent) {
      if (current.destroyed || !current.visible) return false;
    }
    return true;
  }

  /**
   * 命中判定。
   *
   * `pressDy` 会移动节点，判定前先把 y 还原到起手位置 —— 否则位移本身会改变
   * 判定基准，边缘点按（位移方向那一侧）会被判成「不在节点内」而丢掉点击。
   */
  function hit(event: UIEvent): boolean {
    const originalY = node.y;
    const restore = pressDy !== 0 && originalY !== baseY;
    if (restore) node.y = baseY;
    try {
      if (slop <= 0) return node.hitTest(event.x, event.y);
      const inverse = node.getGlobalTransformMatrix().invert();
      if (!inverse) return false;
      const point = inverse.transformPoint(event.x, event.y);
      return point.x >= -slop && point.x <= node.width + slop &&
        point.y >= -slop && point.y <= node.height + slop;
    } finally {
      if (restore) node.y = originalY;
    }
  }

  function setPressed(value: boolean): void {
    if (pressed === value) return;
    pressed = value;
    if (pressDy) node.y = baseY + (value ? pressDy : 0);
    options.onPressChange?.(value);
  }

  function detachWindow(): void {
    removeWindow?.();
    removeWindow = null;
  }

  /** 鼠标手势期间挂 window 级 mouseup/blur：画布外、或被 stop 的 up 也能收到。 */
  function attachWindow(): void {
    if (removeWindow) return;
    const doc = (app.canvas as HTMLCanvasElement | undefined)?.ownerDocument;
    const win = (doc?.defaultView ?? (globalThis as any)) as WindowLike | undefined;
    if (!win || typeof win.addEventListener !== "function") return;
    const onUp = () => abort();
    const onBlur = () => abort();
    // 画布内先由 canvas 完成 onTap；画布外的 mouseup 才会由 window 兜底。
    win.addEventListener("mouseup", onUp);
    win.addEventListener("blur", onBlur, true);
    removeWindow = () => {
      win.removeEventListener("mouseup", onUp);
      win.removeEventListener("blur", onBlur, true);
    };
  }

  /** 结束手势并复位状态，但保留「本指剩余事件要不要吞」的信息由调用点决定。 */
  function release(): void {
    pointer = null;
    setPressed(false);
    removeObserver?.();
    removeObserver = null;
    detachWindow();
  }

  /** 彻底丢弃手势：本次不再触发点击，剩余事件也不再吞。 */
  function abort(): void {
    cancelled = false;
    release();
  }

  /** 软取消：不再触发点击、视觉复位，但继续吞本指剩余事件直到抬手。 */
  function cancelGesture(): void {
    if (pointer === null) return;
    cancelled = true;
    setPressed(false);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    abort();
    detachDestroy?.();
    detachDestroy = null;
    node.removeEventListener("touchstart", start);
    node.removeEventListener("mousedown", start);
    for (const hook of Array.from(disposeHooks.get(instance) ?? [])) hook();
    disposeHooks.delete(instance);
  }

  function observe(event: UIEvent): boolean {
    if (pointer === null) return true;
    if (disposed || !enabled || !isAlive()) {
      abort();
      return true;
    }
    /* 不是本方 pointer 的事件必须**只观察、不拦截** —— 返回 false 会让
       EventManager 在入口处丢弃整条事件，另一根手指点另一个按钮、
       或游戏自己的第二触点都会被一起吞掉。 */
    if (pointerOf(event) !== pointer) return true;

    // 到这里才是本方手势的事件，消费它，避免落到下层
    event.markHandled();
    if (options.stopPropagation !== false) event.stop();

    if (event.type === "touchcancel") {
      cancelled = false;
      release();
    } else if (event.type === "touchmove" || event.type === "mousemove") {
      const moved = Math.hypot(event.x - startX, event.y - startY);
      /* 两套判据各管一件事：
         - `hit()` 管「还在不在按钮上」，slop 只是把边界放宽多少（slop=0 时
           出了节点盒就取消，与旧行为一致）；
         - `moveThreshold` 管「这还算不算一次点击」，滚动/拖拽里用它。
         任一判据命中即永久取消，不再回滚（拖出去又拖回来仍然不算点击）。 */
      const leftNode = !hit(event);
      const movedTooFar = moveThreshold > 0 && moved > moveThreshold;
      if (leftNode || movedTooFar) cancelGesture();
    } else if (event.type === "touchend" || event.type === "mouseup") {
      const shouldTap = !cancelled && hit(event);
      release();
      if (shouldTap && enabled && isAlive()) options.onTap?.();
    }
    /* 返回 false 会让 EventManager 在入口处丢弃整条事件（下层与祖先都收不到）。
       `stopPropagation: false` 的语义是「我消费了，但不要替我阻滞传播」——
       此时必须放行显示树，让 markHandled + 显式 stop 决定去向。 */
    return options.stopPropagation === false;
  }

  function start(event: UIEvent): void {
    if (disposed || !enabled || pointer !== null || !isAlive()) return;
    event.markHandled();
    if (options.stopPropagation !== false) event.stop();
    pointer = pointerOf(event);
    cancelled = false;
    baseY = node.y;
    startX = event.x;
    startY = event.y;
    removeObserver = app.eventManager.addEventObserver(observe);
    if (isMouse(event)) attachWindow();
    setPressed(true);
  }

  const instance: PressableInstance = {
    node,
    setEnabled(value: boolean): void {
      enabled = value;
      if (!value) abort();
    },
    cancel(): void {
      cancelGesture();
    },
    destroy: dispose,
  };
  detachDestroy = node.on("destroyed", () => dispose());
  node.addEventListener("touchstart", start);
  node.addEventListener("mousedown", start);
  return instance;
}
