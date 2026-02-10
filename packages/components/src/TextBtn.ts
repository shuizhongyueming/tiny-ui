import type { TinyUI, Callback, Container, Graphics } from "@shuizhongyueming/tiny-ui-core";
import { adjustTo } from "./utils/adjustTo";
import { ShapeRect } from "./ShapeRect";

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

export interface TextBtnInstance extends Container {
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

  const btnContainer = app.createContainer("TextBtn/Container") as TextBtnInstance;

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

  const redrawBg = (): Graphics => {
    const btnBg = ShapeRect(app, { width, height, radius: currentRadius }, currentBgColor);
    return btnBg;
  };

  let btnBg = redrawBg();
  btnContainer.addChild(btnBg);
  btnContainer.addChild(btnText);
  adjustToBtn(btnBg, { h: "left", v: "top" });
  adjustToBtn(btnText, { h: "center", v: "center" });

  if (onClick) {
    btnBg.addEventListener(app.EventName.TouchStart, onClick);
  }

  // 动态调整圆角
  btnContainer.setRadius = (newRadius: typeof currentRadius) => {
    currentRadius = newRadius;
    const newBg = redrawBg();
    btnContainer.removeChild(btnBg);
    btnBg.destroy();
    btnBg = newBg;
    btnContainer.addChildAt(btnBg, 0);
    adjustToBtn(btnBg, { h: "left", v: "top" });
    if (onClick) {
      btnBg.addEventListener(app.EventName.TouchStart, onClick);
    }
  };

  // 动态调整背景色
  btnContainer.setBgColor = (newColor: string) => {
    currentBgColor = newColor;
    const newBg = redrawBg();
    btnContainer.removeChild(btnBg);
    btnBg.destroy();
    btnBg = newBg;
    btnContainer.addChildAt(btnBg, 0);
    adjustToBtn(btnBg, { h: "left", v: "top" });
    if (onClick) {
      btnBg.addEventListener(app.EventName.TouchStart, onClick);
    }
  };

  return btnContainer;
}
