import type { TinyUI, Callback, Container, Graphics } from "@shuizhongyueming/tiny-ui-core";
import { adjustTo } from "./utils/adjustTo";

export interface TextBtnProps {
  app: TinyUI;
  text: string;
  name?: string;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  width?: number;
  height?: number;
  radius?: number | { tl: number; tr: number; br: number; bl: number };
  responsive?: boolean;
  pressEffect?: boolean;
  onClick?: Callback;
}

export interface TextBtnInstance {
  container: Container;
  setRadius: (radius: number | { tl: number; tr: number; br: number; bl: number }) => void;
  setBgColor: (color: string) => void;
}

export function TextBtn({
  app,
  text,
  name = "TextBtn",
  bgColor = "#6584cd",
  textColor = "#ffffff",
  fontSize = 28,
  fontWeight = "normal",
  width,
  height,
  radius,
  responsive,
  pressEffect = false,
  onClick,
}: TextBtnProps): TextBtnInstance {
  if (!responsive) {
    width = width || 180;
    height = height || 68;
  }

  const btnContainer = app.createContainer(`${name}/Container`);

  const btnText = app.createText(text, `${name}/Text`);
  btnText.color = textColor;
  btnText.fontSize = fontSize;
  btnText.fontWeight = fontWeight;

  // 强制更新纹理以获取准确尺寸
  btnText.updateTexture();

  if (responsive) {
    const charNum = text.length;
    width = btnText.width / charNum * (charNum + 1);
    height = btnText.height * 1.5;
  }

  btnContainer.setSize({ width: width!, height: height! });

  const adjustToBtn = adjustTo(btnContainer, true);
  let currentRadius = radius;
  let currentBgColor = bgColor;
  const isTransparent = bgColor === "transparent";

  // 创建背景 Graphics（仅在非透明时）
  let btnBg: Graphics | null = null;
  if (!isTransparent) {
    btnBg = app.createGraphics(`${name}/Bg`);
  }

  // 绘制背景的辅助函数
  const redrawBg = () => {
    if (!btnBg || isTransparent) return;

    btnBg.clear();

    const hasRadius = currentRadius !== undefined &&
      (typeof currentRadius === "number"
        ? currentRadius > 0
        : Object.values(currentRadius).some((r) => r > 0));

    if (hasRadius) {
      btnBg.drawRoundedRect(0, 0, width!, height!, currentRadius, currentBgColor);
    } else {
      btnBg.drawRect(0, 0, width!, height!, currentBgColor);
    }
  };

  if (btnBg) {
    redrawBg();
    btnContainer.addChild(btnBg);
  }
  btnContainer.addChild(btnText);

  if (btnBg) {
    adjustToBtn(btnBg, { h: "left", v: "top" });
  }
  adjustToBtn(btnText, { h: "center", v: "center" });

  // 按钮交互 - 统一绑定到容器，确保点击按钮任何区域（包括文字）都能触发
  let isPressed = false;
  let shouldTriggerClick = false;
  let startX = 0;
  let startY = 0;

  const setPressed = (pressed: boolean) => {
    isPressed = pressed;
    if (pressed) {
      shouldTriggerClick = true;
      if (pressEffect) {
        if (isTransparent) {
          btnContainer.alpha = 0.6;
        } else if (btnBg) {
          btnBg.alpha = 0.7;
        }
      }
    } else if (pressEffect) {
      if (isTransparent) {
        btnContainer.alpha = 1;
      } else if (btnBg) {
        btnBg.alpha = 1;
      }
    }
  };

  btnContainer.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    startX = (e as any).x;
    startY = (e as any).y;
    setPressed(true);
  });

  btnContainer.addEventListener('touchmove', (e) => {
    e.stopPropagation();
    if (!isPressed) return;

    const dx = (e as any).x - startX;
    const dy = (e as any).y - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      setPressed(false);
      shouldTriggerClick = false;
    }
  });

  if (onClick) {
    btnContainer.addEventListener('touchend', (e) => {
      e.stopPropagation();
      const wasPressed = isPressed;
      setPressed(false);
      if (wasPressed && shouldTriggerClick) {
        onClick();
      }
    });
  }

  return {
    container: btnContainer,
    setRadius: (newRadius: typeof currentRadius) => {
      currentRadius = newRadius;
      redrawBg();
    },
    setBgColor: (newColor: string) => {
      currentBgColor = newColor;
      redrawBg();
    },
  };
}
