import type { TinyUI, Container, DisplayObject, Size } from "@shuizhongyueming/tiny-ui-core";
import { ShapeRect } from "./ShapeRect";
import { adjustTo } from "./utils/adjustTo"

export interface PopupParams {
  app: TinyUI;
  // 在实际应用中，有时候需要把游戏中已有的节点放到 Popup 中
  parent?: Container;
  size?: Size;
  bgColor?: string;
  bg?: DisplayObject;
  alpha?: number; // [0-1]
}
export function Popup({
  app,
  parent,
  size,
  bgColor = '#000',
  bg,
  alpha = 0.7,
}: PopupParams): Container {
  const width = size ? size.width : app.stageWidth;
  const height = size ? size.height : app.stageHeight;

  const container = app.createContainer('Popup/Container');
  container.width = width;
  container.height = height;

  if (!bg) {
    bg = ShapeRect(app, { width, height }, bgColor);
    bg.alpha = alpha;
  }
  container.addChild(bg);
  adjustTo(container, true)(bg, { v: 'top', h: 'left' });

  if (parent) {
    parent.addChild(container);
  }
  return container;
}
