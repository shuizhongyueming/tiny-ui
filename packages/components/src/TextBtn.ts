import type { TinyUI, Callback, Container, Graphics } from "@shuizhongyueming/tiny-ui-core";
import { adjustTo } from "./utils/adjustTo";

export interface TextBtnProps {
  app: TinyUI;
  text: string;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  radius?: number | { tl: number; tr: number; br: number; bl: number };
  responsive?: boolean;
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
  bgColor = "#6584cd",
  textColor = "#ffffff",
  fontSize = 28,
  width,
  height,
  radius,
  responsive,
  onClick,
}: TextBtnProps): TextBtnInstance {
  if (!responsive) {
    width = width || 180;
    height = height || 68;
  }

  const btnContainer = app.createContainer("TextBtn/Container");

  const btnText = app.createText(text, "TextBtn/Text");
  btnText.color = textColor;
  btnText.fontSize = fontSize;

  // 强制更新纹理以获取准确尺寸
  btnText.updateTexture();

  if (responsive) {
    const charNum = text.length;
    width = btnText.width / charNum * (charNum + 1);
    height = btnText.height * 1.5;
  }

  btnContainer.width = width;
  btnContainer.height = height;

  const adjustToBtn = adjustTo(btnContainer, true);
  let currentRadius = radius;
  let currentBgColor = bgColor;

  // 创建背景 Graphics
  const btnBg = app.createGraphics("TextBtn/Bg");

  // 绘制背景的辅助函数
  const redrawBg = () => {
    btnBg.clear();

    const hasRadius = currentRadius !== undefined &&
      (typeof currentRadius === "number"
        ? currentRadius > 0
        : Object.values(currentRadius).some((r) => r > 0));

    if (hasRadius) {
      btnBg.drawRoundedRect(0, 0, width, height, currentRadius, currentBgColor);
    } else {
      btnBg.drawRect(0, 0, width, height, currentBgColor);
    }
  };

  redrawBg();
  btnContainer.addChild(btnBg);
  btnContainer.addChild(btnText);
  adjustToBtn(btnBg, { h: "left", v: "top" });
  adjustToBtn(btnText, { h: "center", v: "center" });

  if (onClick) {
    btnBg.addEventListener('touchstart', onClick);
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
