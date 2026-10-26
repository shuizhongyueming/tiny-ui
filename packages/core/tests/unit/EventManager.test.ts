import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventManager } from "../../src/utils/EventManager";
import { Container } from "../../src/Container";
import type TinyUI from "../../src/TinyUI";

/* 触摸/鼠标记录的聚合与合成 mouse 抑制回归测试。
   背景：EventManager 曾在 for 块外引用块级 const uiEvent —— 无 stopPropagation
   时 ReferenceError（偶发）；多触点时 handled 必须跨触点聚合，否则合成 mouse
   会把已消费手势再点一遍。 */

class FakeTouch {
  constructor(
    public identifier: number,
    public clientX: number,
    public clientY: number,
  ) {}
}
class FakeTouchEvent {
  constructor(
    public touches: FakeTouch[],
    public changedTouches: FakeTouch[],
  ) {}
}
class FakeMouseEvent {
  constructor(
    public clientX: number,
    public clientY: number,
  ) {}
}

function setup() {
  const handlers = new Map<string, EventListener>();
  const canvas = {
    width: 800,
    height: 600,
    addEventListener: (t: string, h: EventListener) => handlers.set(t, h),
    removeEventListener: (t: string) => handlers.delete(t),
    getBoundingClientRect: () =>
      ({ left: 0, top: 0, width: 400, height: 300 }) as DOMRect,
  };
  const root = new Container({} as TinyUI, "root");
  root.pivotX = 0;
  root.pivotY = 0;
  root.width = 800;
  root.height = 600;
  const app = { canvas, root };
  const em = new EventManager(app as any);
  const fire = {
    touch: (type: string, touches: FakeTouch[], changed: FakeTouch[]) =>
      (handlers.get(type) as any)(new FakeTouchEvent(touches, changed)),
    mouse: (type: string, x: number, y: number) =>
      (handlers.get(type) as any)(new FakeMouseEvent(x, y)),
    has: (type: string) => handlers.has(type),
  };
  return { app, em, fire, root };
}

describe("EventManager 触摸记录与合成 mouse 抑制", () => {
  const RealMouseEvent = globalThis.MouseEvent;
  beforeEach(() => {
    (globalThis as any).TouchEvent = FakeTouchEvent;
    (globalThis as any).MouseEvent = FakeMouseEvent as any;
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).TouchEvent;
    (globalThis as any).MouseEvent = RealMouseEvent;
  });

  it("注册了 touchcancel 监听", () => {
    const { fire } = setup();
    expect(fire.has("touchcancel")).toBe(true);
  });

  it("0 触点（changed/touches 均空）不抛异常、不分发", () => {
    const { fire, root } = setup();
    const onStart = vi.fn();
    root.addEventListener("touchstart", onStart);
    expect(() => fire.touch("touchstart", [], [])).not.toThrow();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("单指被消费（markHandled）→ 300ms 内合成 mouse 被抑制", () => {
    const { fire, root } = setup();
    const btn = new Container({} as TinyUI);
    btn.pivotX = 0;
    btn.pivotY = 0;
    btn.width = 100;
    btn.height = 100;
    root.addChild(btn);
    btn.addEventListener("touchstart", (e) => e.markHandled());

    const onMouse = vi.fn();
    btn.addEventListener("mousedown", onMouse);

    fire.touch("touchstart", [new FakeTouch(1, 25, 25)], [new FakeTouch(1, 25, 25)]);
    fire.mouse("mousedown", 25, 25);
    expect(onMouse).not.toHaveBeenCalled();

    vi.setSystemTime(1_000_000 + 400);
    fire.mouse("mousedown", 25, 25);
    expect(onMouse).toHaveBeenCalledTimes(1);
  });

  it("多指：任一指被消费 → 聚合 handled，mouse 抑制", () => {
    const { fire, root } = setup();
    const btn = new Container({} as TinyUI);
    btn.pivotX = 0;
    btn.pivotY = 0;
    btn.width = 800;
    btn.height = 600;
    root.addChild(btn);
    // 只有第一个触点的分支消费事件
    btn.addEventListener("touchstart", (e) => {
      if (e.identifier === 1) e.markHandled();
    });
    const onMouse = vi.fn();
    btn.addEventListener("mousedown", onMouse);

    fire.touch(
      "touchstart",
      [new FakeTouch(1, 10, 10), new FakeTouch(2, 300, 300)],
      [new FakeTouch(1, 10, 10), new FakeTouch(2, 300, 300)],
    );
    fire.mouse("mousedown", 10, 10);
    expect(onMouse).not.toHaveBeenCalled();
  });

  it("多指全未消费 → 无记录，mouse 正常分发", () => {
    const { fire, root } = setup();
    const btn = new Container({} as TinyUI);
    btn.pivotX = 0;
    btn.pivotY = 0;
    btn.width = 800;
    btn.height = 600;
    root.addChild(btn);
    const onMouse = vi.fn();
    btn.addEventListener("mousedown", onMouse);

    fire.touch(
      "touchstart",
      [new FakeTouch(1, 10, 10), new FakeTouch(2, 300, 300)],
      [new FakeTouch(1, 10, 10), new FakeTouch(2, 300, 300)],
    );
    fire.mouse("mousedown", 10, 10);
    expect(onMouse).toHaveBeenCalledTimes(1);
  });

  it("触摸被消费但无 stopPropagation 时不抛 ReferenceError（回归）", () => {
    const { fire, root } = setup();
    const btn = new Container({} as TinyUI);
    btn.pivotX = 0;
    btn.pivotY = 0;
    btn.width = 800;
    btn.height = 600;
    root.addChild(btn);
    // 只 markHandled、不 stop —— 旧实现会在记录处引用块外 uiEvent 抛错
    btn.addEventListener("touchend", (e) => e.markHandled());
    expect(() =>
      fire.touch("touchend", [new FakeTouch(1, 10, 10)], [new FakeTouch(1, 10, 10)]),
    ).not.toThrow();
  });
});
