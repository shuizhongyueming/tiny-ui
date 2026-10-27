import type { TinyUI, Container, DisplayObject, Size, UIEvent } from "@shuizhongyueming/tiny-ui-core";
import { ShapeRect } from "./ShapeRect";
import { adjustTo } from "./utils/adjustTo";
import { cancelPressables, trackPopupContent } from "./utils/pressableGroup";

export interface PopupParams {
  app: TinyUI;
  parent?: Container;
  size?: Size;
  bgColor?: string;
  bg?: DisplayObject;
  /** 背景遮罩不透明度，[0,1]。 */
  alpha?: number;
  /** 是否吞掉落在自己的背景/容器上的输入。 */
  modal?: boolean;
  /** 关闭动画时长（秒）。非有限值或负数按 0（立即关闭）处理。 */
  closeDuration?: number;
  /** 关闭完成回调。只调用一次；直接 `destroy()` 不会调用。 */
  onClose?: () => void;
  /**
   * 复用已有容器作为弹窗外壳。
   *
   * ⚠️ 传入即接管所有权：`close()` / `destroy()` 会销毁它。需要重复打开请每次新建容器。
   */
  container?: Container;
}

export interface PopupCloseOptions {
  duration?: number;
  onComplete?: () => void;
}

export interface PopupInstance extends Container {
  /**
   * 关闭弹窗。
   *
   * 幂等：重复调用只有第一次生效，`onClose` 只回调一次。
   * 关闭动画期间对**整个画布**的输入都是模态的（见 llvm 说明）—— 需要在
   * 动画结束后再打开更高层的 UI，请等 `onClose`。
   */
  close(options?: PopupCloseOptions): void;
  /** 把内容挂进弹窗。所有权转移到弹窗：弹窗销毁时内容一并销毁。 */
  addContent(content: Container): void;
}

/** 时长合法化：非有限值/负数一律按 0（立即关闭）。 */
function normalizeDuration(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

/** alpha 合法化：NaN 会污染整棵子树的渲染与淡出计算。 */
function normalizeAlpha(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function Popup({ app, parent, size, bgColor = "#000", bg,
  alpha = 0.7, modal = false, closeDuration = 0, onClose, container }: PopupParams): PopupInstance {
  const width = size ? size.width : app.stageWidth;
  const height = size ? size.height : app.stageHeight;
  if (!container) {
    container = app.createContainer("Popup/Container");
    container.setSize(width, height);
    if (!bg) {
      bg = ShapeRect(app, { width, height }, bgColor);
      bg.alpha = normalizeAlpha(alpha, 0.7);
    }
    container.addChild(bg);
    adjustTo(container, true)(bg, { v: "top", h: "left" });
  }
  if (parent) parent.addChild(container);

  const popup = container as PopupInstance;
  let closing = false;
  let closed = false;
  let tick: ((dt: number) => void) | null = null;
  let removeShield: (() => void) | null = null;

  const stopTick = (): void => {
    if (tick) app.removeTick(tick);
    tick = null;
  };

  container.on("destroyed", () => {
    removeShield?.();
    removeShield = null;
    stopTick();
    closed = true;
    // 容器没了，子树里登记的 Pressable 一并摘掉
    cancelPressables(popup);
  });

  const shield = (event: UIEvent): void => {
    event.markHandled();
    event.stop();
  };
  if (modal) {
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel",
      "mousedown", "mousemove", "mouseup"] as const) {
      // 背景在容器内部，容器的监听已经覆盖它（冒泡到容器就停）
      container.addEventListener(type, shield);
    }
  }

  let startAlpha = 1;
  let elapsed = 0;
  let duration = 0;

  const finish = (): void => {
    stopTick();
    container.destroy();
  };

  const complete = (onComplete?: () => void): void => {
    finish();
    onClose?.();
    onComplete?.();
  };

  popup.close = (options: PopupCloseOptions = {}): void => {
    if (closed || closing) return;
    closing = true;
    // 关闭开始即取消子树里所有正在按下的控件：否则抬手还会补一次 onClick
    cancelPressables(popup);
    /* 关闭动画期间整块画布模态：保证淡出期不会把输入穿透到下层。
       这是刻意的全局拦截，需要在动画后打开更高层 UI 请等 onClose。 */
    removeShield = app.eventManager.addEventObserver((event) => {
      shield(event);
      return false;
    });
    duration = normalizeDuration(options.duration ?? closeDuration);
    if (duration === 0) {
      complete(options.onComplete);
      return;
    }
    startAlpha = normalizeAlpha(container.alpha, 1);
    elapsed = 0;
    tick = (dt: number) => {
      if (container.destroyed) {
        finish();
        return;
      }
      if (Number.isFinite(dt) && dt > 0) elapsed += dt / 1000;
      const progress = Math.min(1, elapsed / duration);
      container.alpha = normalizeAlpha(startAlpha * (1 - progress), 0);
      if (progress >= 1) complete(options.onComplete);
    };
    app.addTick(tick);
  };

  popup.addContent = (content: Container): void => {
    trackPopupContent(popup, content);
  };

  return popup;
}
