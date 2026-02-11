import type { TinyUI, Container, Graphics, Text } from "@shuizhongyueming/tiny-ui-core";
import { adjustTo } from "./utils/adjustTo";
import { blockInputEvents } from "./utils/blockInputEvents";
import { TextBtn } from "./TextBtn";

// Dialog 状态枚举
enum DialogState {
  SHOW = "show",
  HOLD = "hold",
  HIDE = "hide",
}

// iOS 风格动画配置
const ANIMATION_CONFIG = {
  showDuration: 180,
  hideDuration: 200,
  showScale: 0.9,
  maxOpacity: 1,
  backdropOpacity: 0.4,
};

// iOS 风格尺寸配置
const DIALOG_CONFIG = {
  widthRatio: 0.82,
  maxWidth: 540,
  borderRadius: 26,
  textPaddingX: 20,
  innerPadding: 32,
  titleFontSize: 36,
  textFontSize: 28,
  buttonFontSize: 34,
  buttonHeight: 88,
  titleBottomMargin: 10,
  dividerColor: 0x000000,
  dividerAlpha: 0.2,
  dividerWidth: 2,
  themeColor: 0x007aff,
};

// 每个 app 独立的 Dialog 状态
interface DialogAppState {
  dialogs: DialogInstance[];
  idCounter: number;
  tickCallback: ((delta: number) => void) | null;
}

// WeakMap 用于按 app 存储状态
const dialogStates: WeakMap<TinyUI, DialogAppState> =
  typeof WeakMap !== "undefined" ? new WeakMap() : (new Map() as WeakMap<TinyUI, DialogAppState>);

// 获取或创建指定 app 的状态
function getDialogState(app: TinyUI): DialogAppState {
  let state = dialogStates.get(app);
  if (!state) {
    state = { dialogs: [], idCounter: 0, tickCallback: null };
    dialogStates.set(app, state);
  }
  return state;
}

interface DialogOptions {
  title?: string;
  content: string;
  showCancel?: boolean;
  cancelText?: string;
  confirmText?: string;
  success?: (res: { confirm: boolean; cancel: boolean }) => void;
  fail?: (err: Error) => void;
}

interface DialogInstance {
  id: number;
  app: TinyUI;
  container: Container;
  dialogContainer: Container;
  contentText: Text;
  bg: Graphics;
  dialogBg: Graphics;
  state: DialogState;
  progress: number;
  startTime: number;
  success?: (res: { confirm: boolean; cancel: boolean }) => void;
  fail?: (err: Error) => void;
}

function getScale(dialogWidth: number): number {
  return dialogWidth > DIALOG_CONFIG.maxWidth ? dialogWidth / DIALOG_CONFIG.maxWidth : 1;
}

function hexToCssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function createDialog(app: TinyUI, options: DialogOptions): DialogInstance {
  const {
    title,
    content,
    showCancel = true,
    cancelText = "取消",
    confirmText = "确定",
    success,
    fail,
  } = options;

  const state = getDialogState(app);
  const id = ++state.idCounter;

  const dialogWidth = app.stageWidth * DIALOG_CONFIG.widthRatio;
  const scale = getScale(dialogWidth);

  const borderRadius = DIALOG_CONFIG.borderRadius * scale;
  const textPaddingX = DIALOG_CONFIG.textPaddingX;
  const innerPadding = DIALOG_CONFIG.innerPadding * scale;
  const titleFontSize = DIALOG_CONFIG.titleFontSize * scale;
  const textFontSize = DIALOG_CONFIG.textFontSize * scale;
  const buttonFontSize = DIALOG_CONFIG.buttonFontSize * scale;
  const buttonHeight = DIALOG_CONFIG.buttonHeight * scale;
  const titleBottomMargin = DIALOG_CONFIG.titleBottomMargin * scale;

  const container = app.createContainer(`Dialog/Container/${id}`);
  app.root.addChild(container);

  const bg = app.createGraphics(`Dialog/Mask/${id}`);
  bg.alpha = 0;
  bg.drawRect(0, 0, app.stageWidth, app.stageHeight, 0x000000);
  blockInputEvents(bg);
  container.addChild(bg);

  const dialogContainer = app.createContainer(`Dialog/Content/${id}`);
  dialogContainer.scaleTo(ANIMATION_CONFIG.showScale);
  dialogContainer.alpha = 0;
  container.addChild(dialogContainer);

  const dialogBg = app.createGraphics(`Dialog/Background/${id}`);
  dialogBg.alpha = 0.95;
  dialogBg.drawRoundedRect(0, 0, dialogWidth, 300, borderRadius, 0xffffff);
  dialogContainer.addChild(dialogBg);

  let titleText: Text | null = null;
  let contentTopY = -100;

  if (title) {
    titleText = app.createText(title, `Dialog/TitleText/${id}`);
    titleText.fontSize = titleFontSize;
    titleText.fontWeight = "bold";
    titleText.color = 0x000000;
    titleText.align = "center";
    titleText.anchorX = 0.5;
    titleText.anchorY = 0.5;
    titleText.maxWidth = dialogWidth - textPaddingX * 2;
    titleText.updateTexture();
    dialogContainer.addChild(titleText);
  }

  const contentText = app.createText(content, `Dialog/ContentText/${id}`);
  contentText.fontSize = textFontSize;
  contentText.color = 0x000000;
  contentText.align = "left";
  contentText.anchorX = 0.5;
  contentText.anchorY = 0.5;
  contentText.maxWidth = dialogWidth - textPaddingX * 2;
  contentText.lineHeight = 40 * scale;
  contentText.updateTexture();
  dialogContainer.addChild(contentText);

  const buttonAreaHeight = buttonHeight + 20;
  const finalDialogHeight = Math.max(
    innerPadding +
      (titleText ? titleText.height : 0) +
      titleBottomMargin +
      contentText.height +
      titleBottomMargin +
      buttonAreaHeight,
    dialogWidth * 0.5
  );

  container.setSize({ width: app.stageWidth, height: app.stageHeight });
  container.x = app.stageWidth / 2;
  container.y = app.stageHeight / 2;

  dialogContainer.setSize({ width: dialogWidth, height: finalDialogHeight });

  const adjustContainer = adjustTo(container, true);
  adjustContainer(bg, { v: "center", h: "center" });
  adjustContainer(dialogContainer, { v: "center", h: "center" });

  dialogBg.clear();
  dialogBg.alpha = 0.95;
  dialogBg.drawRoundedRect(0, 0, dialogWidth, finalDialogHeight, borderRadius, 0xffffff);

  const adjustDialog = adjustTo(dialogContainer, true);

  adjustDialog(dialogBg, { v: "center", h: "center" });
  if (titleText) {
    adjustDialog(titleText, { v: "top", h: "center" }, { y: innerPadding });
    contentTopY = titleText.y + titleText.height / 2 + titleBottomMargin;
  } else {
    contentTopY = innerPadding;
  }
  adjustDialog(contentText, { v: "top", h: "center" }, { y: contentTopY });

  const btnDivider = app.createGraphics(`Dialog/TopDivider/${id}`);
  btnDivider.alpha = DIALOG_CONFIG.dividerAlpha;
  btnDivider.drawRect(0, 0, dialogWidth, DIALOG_CONFIG.dividerWidth, DIALOG_CONFIG.dividerColor);
  dialogContainer.addChild(btnDivider);
  adjustDialog(btnDivider, { v: "bottom", h: "center" }, { y: -buttonHeight - 10 });

  const onCancel = () => {
    hideDialog(app, id);
    if (success) success({ confirm: false, cancel: true });
  };

  const onConfirm = () => {
    hideDialog(app, id);
    if (success) success({ confirm: true, cancel: false });
  };

  if (showCancel) {
    const cancelBtn = TextBtn({
      app,
      text: cancelText,
      name: "Dialog/Button",
      bgColor: "transparent",
      textColor: hexToCssColor(DIALOG_CONFIG.themeColor),
      fontSize: buttonFontSize,
      fontWeight: "normal",
      width: dialogWidth / 2,
      height: buttonHeight,
      pressEffect: true,
      onClick: onCancel,
    });
    dialogContainer.addChild(cancelBtn.container);
    adjustDialog(cancelBtn.container, { v: "bottom", h: "left" });

    const confirmBtn = TextBtn({
      app,
      text: confirmText,
      name: "Dialog/Button",
      bgColor: "transparent",
      textColor: hexToCssColor(DIALOG_CONFIG.themeColor),
      fontSize: buttonFontSize,
      fontWeight: "bold",
      width: dialogWidth / 2,
      height: buttonHeight,
      pressEffect: true,
      onClick: onConfirm,
    });
    dialogContainer.addChild(confirmBtn.container);
    adjustDialog(confirmBtn.container, { v: "bottom", h: "right" });

    const middleDivider = app.createGraphics(`Dialog/Button/MiddleDivider/${id}`);
    middleDivider.alpha = DIALOG_CONFIG.dividerAlpha;
    middleDivider.drawRect(0, 0, DIALOG_CONFIG.dividerWidth, buttonHeight * 0.4, DIALOG_CONFIG.dividerColor);
    dialogContainer.addChild(middleDivider);
    adjustDialog(middleDivider, { v: "bottom", h: "center" }, { y: buttonHeight * -0.3 });
  } else {
    const confirmBtn = TextBtn({
      app,
      text: confirmText,
      name: "Dialog/Button",
      bgColor: "transparent",
      textColor: hexToCssColor(DIALOG_CONFIG.themeColor),
      fontSize: buttonFontSize,
      fontWeight: "bold",
      width: dialogWidth,
      height: buttonHeight,
      pressEffect: true,
      onClick: onConfirm,
    });
    dialogContainer.addChild(confirmBtn.container);
    adjustDialog(confirmBtn.container, { v: "bottom", h: "center" });
  }

  return {
    id,
    app,
    container,
    dialogContainer,
    contentText,
    bg,
    dialogBg,
    state: DialogState.SHOW,
    progress: 0,
    startTime: Date.now(),
    success,
    fail,
  };
}

function updateDialogsForApp(app: TinyUI, delta: number): void {
  const state = getDialogState(app);
  if (state.dialogs.length === 0) return;

  const now = Date.now();
  const dialogsToRemove: number[] = [];

  for (let i = 0; i < state.dialogs.length; i++) {
    const dialog = state.dialogs[i];
    const elapsed = now - dialog.startTime;

    switch (dialog.state) {
      case DialogState.SHOW: {
        const showProgress = Math.min(elapsed / ANIMATION_CONFIG.showDuration, 1);
        dialog.progress = showProgress;

        const scale = ANIMATION_CONFIG.showScale - (ANIMATION_CONFIG.showScale - 1) * showProgress;
        dialog.dialogContainer.scaleTo(scale);

        const opacity = 0.85 + showProgress * (ANIMATION_CONFIG.maxOpacity - 0.85);
        dialog.dialogContainer.alpha = opacity;
        dialog.bg.alpha = opacity * ANIMATION_CONFIG.backdropOpacity;

        if (showProgress >= 1) {
          dialog.state = DialogState.HOLD;
          dialog.startTime = now;
        }
        break;
      }

      case DialogState.HOLD: {
        break;
      }

      case DialogState.HIDE: {
        const hideProgress = Math.min(elapsed / ANIMATION_CONFIG.hideDuration, 1);
        dialog.progress = hideProgress;

        const opacity = 0.55 + (ANIMATION_CONFIG.maxOpacity - 0.55) * (1 - hideProgress);
        dialog.dialogContainer.alpha = opacity;
        dialog.bg.alpha = opacity * ANIMATION_CONFIG.backdropOpacity;

        if (hideProgress >= 1) {
          dialogsToRemove.push(i);
        }
        break;
      }
    }
  }

  for (let i = dialogsToRemove.length - 1; i >= 0; i--) {
    const index = dialogsToRemove[i];
    const dialog = state.dialogs[index];
    if (dialog.container) {
      dialog.container.destroy();
    }
    state.dialogs.splice(index, 1);
  }
}

export function showDialog(app: TinyUI, options: DialogOptions): void {
  const { content, fail } = options || {};

  if (!content) {
    console.warn("[showDialog] content is required");
    if (fail) fail(new Error("content is required"));
    return;
  }

  const state = getDialogState(app);
  const newDialog = createDialog(app, options);
  state.dialogs.push(newDialog);

  // 如果还没有注册 tick 回调，则注册
  if (!state.tickCallback) {
    state.tickCallback = (delta: number) => updateDialogsForApp(app, delta);
    app.addTick(state.tickCallback);
  }
}

export function hideDialog(app: TinyUI, id: number): void {
  const state = getDialogState(app);
  const dialog = state.dialogs.find((d) => d.id === id);
  if (dialog && dialog.state !== DialogState.HIDE) {
    dialog.state = DialogState.HIDE;
    dialog.startTime = Date.now();
    dialog.progress = 0;
  }
}

export function hideAllDialogs(app?: TinyUI): void {
  if (app) {
    const state = getDialogState(app);
    state.dialogs.forEach((dialog) => {
      if (dialog.state !== DialogState.HIDE) {
        dialog.state = DialogState.HIDE;
        dialog.startTime = Date.now();
        dialog.progress = 0;
      }
    });
  } else {
    // 如果没有指定 app，遍历所有已知的状态（仅在 Map fallback 时可用）
    if (dialogStates instanceof Map) {
      for (const [, state] of dialogStates as Map<TinyUI, DialogAppState>) {
        state.dialogs.forEach((dialog) => {
          if (dialog.state !== DialogState.HIDE) {
            dialog.state = DialogState.HIDE;
            dialog.startTime = Date.now();
            dialog.progress = 0;
          }
        });
      }
    }
  }
}

export { DialogState };

export const _testInternals = {
  getDialogState,
  createDialog,
  updateDialogsForApp,
};