import type { TinyUI, Callback } from "@shuizhongyueming/tiny-ui-core";
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
  responsive?: boolean;
  onClick?: Callback;
}

export function TextBtn({
  app,
  text,
  bgColor = '#6584cd',
  textColor = '#ffffff',
  fontSize = 28,
  width,
  height,
  responsive,
  onClick,
}: TextBtnProps) {
  if (!responsive) {
    width = width || 180;
    height = height || 68;
  }

  const btnContainer = app.createContainer('TextBtn/Container');

  const btnText = app.createText(text, 'TextBtn/Text');
  btnText.color = textColor;
  btnText.fontSize = fontSize;

  if (responsive) {
    const charNum = text.length;
    width = btnText.width / charNum * (charNum + 1);
    height = btnText.height * 1.5;
  }

  btnContainer.width = width;
  btnContainer.height = height;

  const adjustToBtn = adjustTo(btnContainer, true);
  const btnBg = ShapeRect(app, { width, height }, bgColor);

  btnContainer.addChild(btnBg);
  btnContainer.addChild(btnText);
  adjustToBtn(btnBg, { h: 'left', v: 'top' });
  adjustToBtn(btnText, { h: 'center', v: 'center' });

  if (onClick) {
    btnBg.addEventListener(app.EventName.TouchStart, onClick);
  }

  return btnContainer;
}
