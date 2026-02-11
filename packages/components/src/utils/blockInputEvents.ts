import type { DisplayObject, UIEvent } from "@shuizhongyueming/tiny-ui-core";

export const blockInputEvents = (node: DisplayObject) => {
  const eventHandler = (e: UIEvent) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.debug(`[TinyUI:blockInputEvents] input event(${e.type}) blocked`);
  };
  node.addEventListener('touchstart', eventHandler);
  node.addEventListener('touchmove', eventHandler);
  node.addEventListener('touchend', eventHandler);
};
