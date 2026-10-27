import type { TinyUI, Callback, Container, Graphics } from "@shuizhongyueming/tiny-ui-core";
import { adjustTo } from "./utils/adjustTo";
import { Pressable } from "./Pressable";
import { registerPressable } from "./utils/pressableGroup";

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

  btnContainer.setSize(width!, height!);

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

  const pressable = Pressable(app, btnContainer, {
    onTap: onClick,
    /* 原实现是「移动超过 10px 就取消点击」，那是移动距离阈值，
       不是命中容差 —— 两者混用会让宽按钮上的拖拽被当成点击。 */
    moveThreshold: 10,
    onPressChange: pressed => {
      if (!pressEffect) return;
      if (isTransparent) btnContainer.alpha = pressed ? 0.6 : 1;
      else if (btnBg) btnBg.alpha = pressed ? 0.7 : 1;
    },
  });
  registerPressable(btnContainer, pressable);

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
