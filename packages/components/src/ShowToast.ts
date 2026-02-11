import type { TinyUI, Container, Graphics, Text } from "@shuizhongyueming/tiny-ui-core";
import { adjustTo } from "./utils/adjustTo";

// Toast 状态枚举
enum ToastState {
  SHOW = "show",
  HOLD = "hold",
  HIDE = "hide",
}

// 动画配置
const ANIMATION_CONFIG = {
  showDuration: 200,
  holdDuration: 1500,
  hideDuration: 200,
  showOffsetY: 30,
  hideOffsetY: -50,
  maxOpacity: 0.8,
};

// Toast 尺寸配置
const TOAST_CONFIG = {
  designWidth: 540,
  fontSize: 28,
  paddingX: 40,
  paddingY: 20,
  minWidth: 200,
  maxWidthRatio: 0.8,
};

// 每个 app 独立的 Toast 状态
interface ToastAppState {
  toasts: ToastInstance[];
  idCounter: number;
  tickCallback: ((delta: number) => void) | null;
}

// WeakMap 用于按 app 存储状态
const toastStates: WeakMap<TinyUI, ToastAppState> =
  typeof WeakMap !== "undefined" ? new WeakMap() : (new Map() as WeakMap<TinyUI, ToastAppState>);

// 获取或创建指定 app 的状态
function getToastState(app: TinyUI): ToastAppState {
  let state = toastStates.get(app);
  if (!state) {
    state = { toasts: [], idCounter: 0, tickCallback: null };
    toastStates.set(app, state);
  }
  return state;
}

interface ToastOptions {
  title: string;
  duration?: number;
  success?: () => void;
  fail?: (err: Error) => void;
}

interface ToastInstance {
  id: number;
  app: TinyUI;
  container: Container;
  bg: Graphics;
  text: Text;
  state: ToastState;
  progress: number;
  startTime: number;
  targetY: number;
  currentY: number;
  holdDuration: number;
}

function getScale(toastWidth: number): number {
  return toastWidth > TOAST_CONFIG.designWidth ? toastWidth / TOAST_CONFIG.designWidth : 1;
}

function createToast(app: TinyUI, title: string, duration?: number): ToastInstance {
  const state = getToastState(app);
  const id = ++state.idCounter;
  const container = app.createContainer(`Toast/Container/${id}`);
  app.root.addChild(container);

  const bg = app.createGraphics();
  bg.alpha = 0;
  container.addChild(bg);

  const maxToastWidth = app.stageWidth * TOAST_CONFIG.maxWidthRatio;
  const scale = getScale(maxToastWidth);

  const fontSize = TOAST_CONFIG.fontSize * scale;
  const paddingX = TOAST_CONFIG.paddingX * scale;
  const paddingY = TOAST_CONFIG.paddingY * scale;

  const text = app.createText(title);
  text.fontSize = fontSize;
  text.color = 0xffffff;
  text.align = "center";
  text.anchorX = 0.5;
  text.anchorY = 0.5;
  text.alpha = 0;
  text.maxWidth = maxToastWidth - paddingX * 2;
  text.updateTexture();
  container.addChild(text);

  // 计算尺寸（应用最小宽度限制，同时确保不超过最大宽度）
  const calculatedWidth = text.width + paddingX * 2;
  const minWidth = Math.min(TOAST_CONFIG.minWidth * scale, maxToastWidth);
  const bgWidth = Math.min(Math.max(calculatedWidth, minWidth), maxToastWidth);
  const bgHeight = text.height + paddingY * 2;

  bg.drawRoundedRect(0, 0, bgWidth, bgHeight, bgHeight / 2, 0x000000);

  container.setSize({ width: bgWidth, height: bgHeight });

  const adjust = adjustTo(container, true);

  adjust(bg, { v: "center", h: "center" });
  adjust(text, { v: "center", h: "center" });

  const stageW = app.stageWidth;
  const stageH = app.stageHeight;
  const targetY = stageH * 0.75;

  container.x = stageW / 2;
  container.y = targetY + ANIMATION_CONFIG.showOffsetY;

  return {
    id,
    app,
    container,
    bg,
    text,
    state: ToastState.SHOW,
    progress: 0,
    startTime: Date.now(),
    targetY,
    currentY: targetY + ANIMATION_CONFIG.showOffsetY,
    holdDuration: duration || ANIMATION_CONFIG.holdDuration,
  };
}

function updateToastsForApp(app: TinyUI, delta: number): void {
  const state = getToastState(app);
  if (state.toasts.length === 0) return;

  const now = Date.now();
  const toastsToRemove: number[] = [];

  for (let i = 0; i < state.toasts.length; i++) {
    const toast = state.toasts[i];
    const elapsed = now - toast.startTime;

    switch (toast.state) {
      case ToastState.SHOW: {
        const showProgress = Math.min(elapsed / ANIMATION_CONFIG.showDuration, 1);
        toast.progress = showProgress;

        const startY = toast.targetY + ANIMATION_CONFIG.showOffsetY;
        toast.currentY = startY + (toast.targetY - startY) * showProgress;
        toast.container.y = toast.currentY;

        const opacity = showProgress * ANIMATION_CONFIG.maxOpacity;
        toast.bg.alpha = opacity;
        toast.text.alpha = showProgress;

        if (showProgress >= 1) {
          toast.state = ToastState.HOLD;
          toast.startTime = now;
        }
        break;
      }

      case ToastState.HOLD: {
        if (elapsed >= toast.holdDuration) {
          toast.state = ToastState.HIDE;
          toast.startTime = now;
          toast.progress = 0;
        }
        break;
      }

      case ToastState.HIDE: {
        const hideProgress = Math.min(elapsed / ANIMATION_CONFIG.hideDuration, 1);
        toast.progress = hideProgress;

        const hideStartY = toast.targetY;
        const hideEndY = toast.targetY + ANIMATION_CONFIG.hideOffsetY;
        toast.currentY = hideStartY + (hideEndY - hideStartY) * hideProgress;
        toast.container.y = toast.currentY;

        const hideOpacity = ANIMATION_CONFIG.maxOpacity * (1 - hideProgress);
        toast.bg.alpha = hideOpacity;
        toast.text.alpha = 1 - hideProgress;

        if (hideProgress >= 1) {
          toastsToRemove.push(i);
        }
        break;
      }
    }
  }

  for (let i = toastsToRemove.length - 1; i >= 0; i--) {
    const index = toastsToRemove[i];
    const toast = state.toasts[index];
    if (toast.container) {
      toast.container.destroy();
    }
    state.toasts.splice(index, 1);
  }
}

export function showToast(app: TinyUI, options: ToastOptions): void {
  const { title, duration, success, fail } = options || {};

  if (!title) {
    console.warn("[showToast] title is required");
    if (fail) fail(new Error("title is required"));
    return;
  }

  const state = getToastState(app);
  const newToast = createToast(app, title, duration);

  // 如果有当前 Toast 正在显示，立即切换到 hide
  const currentToast = state.toasts.length > 0 ? state.toasts[state.toasts.length - 1] : null;
  if (currentToast) {
    if (currentToast.state === ToastState.SHOW || currentToast.state === ToastState.HOLD) {
      currentToast.state = ToastState.HIDE;
      currentToast.startTime = Date.now();
      currentToast.progress = 0;
    }
  }

  state.toasts.push(newToast);

  // 如果还没有注册 tick 回调，则注册
  if (!state.tickCallback) {
    state.tickCallback = (delta: number) => updateToastsForApp(app, delta);
    app.addTick(state.tickCallback);
  }

  // 成功回调（异步）
  if (success) {
    setTimeout(() => success(), 0);
  }
}

export function hideAllToasts(app?: TinyUI): void {
  if (app) {
    const state = getToastState(app);
    state.toasts.forEach((toast) => {
      if (toast.state !== ToastState.HIDE) {
        toast.state = ToastState.HIDE;
        toast.startTime = Date.now();
        toast.progress = 0;
      }
    });
  } else {
    // 如果没有指定 app，遍历所有已知的状态（仅在 Map fallback 时可用）
    if (toastStates instanceof Map) {
      for (const [, state] of toastStates as Map<TinyUI, ToastAppState>) {
        state.toasts.forEach((toast) => {
          if (toast.state !== ToastState.HIDE) {
            toast.state = ToastState.HIDE;
            toast.startTime = Date.now();
            toast.progress = 0;
          }
        });
      }
    }
  }
}

export { ToastState };

export const _testInternals = {
  getToastState,
  createToast,
  updateToastsForApp,
  ANIMATION_CONFIG,
  TOAST_CONFIG,
};