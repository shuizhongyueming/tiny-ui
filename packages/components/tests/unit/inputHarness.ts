import { EventManager } from "../../../core/src/utils/EventManager";
import { Container } from "../../../core/src/Container";
import type TinyUI from "../../../core/src/TinyUI";

/* 真实 EventManager 接缝的测试夹具：不 mock hitTest，不绕过 observer，
   输入从 canvas 监听器（或自定义触摸入口）真实进入，走完整分发链路。 */

export class FakeTouch {
  constructor(
    public identifier: number,
    public clientX: number,
    public clientY: number,
  ) {}
}

export class FakeTouchEvent {
  touches: FakeTouch[];
  changedTouches: FakeTouch[];
  constructor(changed: FakeTouch[], touches = changed) {
    this.touches = touches;
    this.changedTouches = changed;
  }
  stopPropagation() {}
  stopImmediatePropagation() {}
}

export class FakeMouseEvent {
  constructor(
    public clientX: number,
    public clientY: number,
  ) {}
  stopPropagation() {}
  stopImmediatePropagation() {}
}

export interface Harness {
  app: any;
  root: Container;
  touch(type: string, id: number, x: number, y: number): void;
  touchMulti(type: string, points: FakeTouch[]): void;
  mouse(type: string, x: number, y: number): void;
  /** 模拟鼠标在画布外松开：canvas 收不到 mouseup，只有 window 级事件。 */
  windowMouseUp(x: number, y: number): void;
  windowEvent(type: string): void;
  windowListenerCount(type: string): number;
  observerCount(): number;
  ticks: Set<(dt: number) => void>;
  /** 把节点放到世界坐标 x,y，并把 pivot 置为左上角。 */
  place<T extends Container>(node: T, x: number, y: number, w: number, h: number): T;
}

export function setup(stage = 200): Harness {
  const handlers = new Map<string, (event: any) => void>();
  const customHandlers = new Map<string, (event: any) => void>();
  const windowHandlers = new Map<string, Array<{ handler: (event: any) => void; capture: boolean }>>();
  const ticks = new Set<(dt: number) => void>();

  const win = {
    addEventListener: (name: string, handler: (event: any) => void, capture = false) => {
      const list = windowHandlers.get(name) ?? [];
      list.push({ handler, capture });
      windowHandlers.set(name, list);
    },
    removeEventListener: (name: string, handler: (event: any) => void, capture = false) => {
      const list = windowHandlers.get(name);
      if (!list) return;
      const index = list.findIndex(item => item.handler === handler && item.capture === capture);
      if (index !== -1) list.splice(index, 1);
    },
  };

  const canvas = {
    width: stage,
    height: stage,
    ownerDocument: { defaultView: win },
    addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
    removeEventListener: (name: string) => handlers.delete(name),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: stage, height: stage }),
  };

  const root = new Container({} as TinyUI);
  root.pivotX = root.pivotY = 0;
  root.setSize(stage, stage);

  const app: any = {
    root,
    canvas,
    stageWidth: stage,
    stageHeight: stage,
    ticks,
    createContainer: (name: string) => new Container(app as TinyUI, name),
    createGraphics: (name: string) => Object.assign(new Container(app as TinyUI, name), {
      drawRect() {}, clear() {}, drawRoundedRect() {},
    }),
    createText: (value: string, name: string) => Object.assign(new Container(app as TinyUI, name), {
      updateTexture() {}, width: 10, height: 10, text: value,
    }),
    addTick(fn: (dt: number) => void) { ticks.add(fn); },
    removeTick(fn: (dt: number) => void) { ticks.delete(fn); },
  };
  app.eventManager = new EventManager(app, {
    handleTouchEventListening: (name: string, handler: any) => customHandlers.set(name, handler),
  });

  return {
    app,
    root,
    ticks,
    touch: (type, id, x, y) => {
      customHandlers.get(type)?.(new FakeTouchEvent([new FakeTouch(id, x, y)]));
    },
    touchMulti: (type, points) => {
      customHandlers.get(type)?.(new FakeTouchEvent(points));
    },
    mouse: (type, x, y) => {
      const event = new FakeMouseEvent(x, y);
      for (const item of [...(windowHandlers.get(type) ?? [])]) {
        if (item.capture) item.handler(event);
      }
      handlers.get(type)?.(event);
      for (const item of [...(windowHandlers.get(type) ?? [])]) {
        if (!item.capture) item.handler(event);
      }
    },
    windowMouseUp: (x, y) => {
      for (const item of [...(windowHandlers.get("mouseup") ?? [])]) {
        item.handler(new FakeMouseEvent(x, y));
      }
    },
    windowEvent: (type) => {
      for (const item of [...(windowHandlers.get(type) ?? [])]) item.handler({ type });
    },
    windowListenerCount: (type) => windowHandlers.get(type)?.length ?? 0,
    observerCount: () => (app.eventManager as any).observers.size,
    place: (node, x, y, w, h) => {
      node.pivotX = 0;
      node.pivotY = 0;
      node.setSize(w, h);
      node.x = x;
      node.y = y;
      return node;
    },
  };
}

/** 装上假 TouchEvent / MouseEvent 构造器，返回卸载函数。 */
export function installFakeInput(): () => void {
  const realTouch = (globalThis as any).TouchEvent;
  const realMouse = (globalThis as any).MouseEvent;
  (globalThis as any).TouchEvent = FakeTouchEvent;
  (globalThis as any).MouseEvent = FakeMouseEvent;
  return () => {
    (globalThis as any).TouchEvent = realTouch;
    (globalThis as any).MouseEvent = realMouse;
  };
}
