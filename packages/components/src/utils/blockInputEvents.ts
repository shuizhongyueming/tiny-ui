import TinyUI from "@shuizhongyueming/tiny-ui-core";
import type { DisplayObject, UIEvent } from "@shuizhongyueming/tiny-ui-core";

export const blockInputEvents = (node: DisplayObject) => {
  const eventHandler = (e: UIEvent) => {
    e.stopPropagation = true;
    console.log('input event blocked');
  }
  node.addEventListener(TinyUI.EventName.TouchStart, eventHandler);
  node.addEventListener(TinyUI.EventName.TouchMove, eventHandler);
  node.addEventListener(TinyUI.EventName.TouchEnd, eventHandler);
};
