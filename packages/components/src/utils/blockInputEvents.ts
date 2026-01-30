import TinyUI from "@shuizhongyueming/tiny-ui-core";
import type { DisplayObject, UIEvent } from "@shuizhongyueming/tiny-ui-core";

export const blockInputEvents = (node: DisplayObject) => {
  const eventHandler = (e: UIEvent) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log(`[TinyUI:blockInputEvents] input event(${e.type}) blocked`);
  };
  node.addEventListener(TinyUI.EventName.TouchStart, eventHandler);
  node.addEventListener(TinyUI.EventName.TouchMove, eventHandler);
  node.addEventListener(TinyUI.EventName.TouchEnd, eventHandler);
};
