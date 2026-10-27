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
  stopPropagation() {}
  stopImmediatePropagation() {}
}
class FakeMouseEvent {
  constructor(
    public clientX: number,
    public clientY: number,
  ) {}
  stopPropagation() {}
  stopImmediatePropagation() {}
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

  it("捕获观察者覆盖每触点和 mouse，false 停止分发且可卸载", () => {
    const { em, fire, root } = setup();
    root.addEventListener("touchstart", e => e.stop());
    root.addEventListener("touchmove", e => e.stop());
    root.addEventListener("touchend", e => e.stop());
    const seen: string[] = [];
    const off = em.addEventObserver(e => {
      seen.push(`${e.type}:${e.identifier}`);
      if (e.type === "touchend") return false;
    });
    const tail = vi.fn();
    root.addEventListener("touchend", tail);
    fire.touch("touchstart", [new FakeTouch(1, 0, 0), new FakeTouch(2, 1, 1)],
      [new FakeTouch(1, 0, 0), new FakeTouch(2, 1, 1)]);
    fire.touch("touchmove", [new FakeTouch(1, 5, 5)], [new FakeTouch(1, 5, 5)]);
    fire.touch("touchend", [new FakeTouch(1, 5, 5)], [new FakeTouch(1, 5, 5)]);
    vi.setSystemTime(1_000_000 + 400);
    fire.mouse("mousemove", 7, 7);
    expect(seen.slice(0, 4)).toEqual(["touchstart:1", "touchstart:2", "touchmove:1", "touchend:1"]);
    expect(seen[4]).toMatch(/^mousemove:\d+$/);
    expect(tail).not.toHaveBeenCalled();
    off();
    fire.mouse("mousemove", 8, 8);
    expect(seen).toHaveLength(5);
    em.destroy();
    expect(fire.has("mousemove")).toBe(false);
  });

  it("观察者按事件只调用一次，不随显示树节点数增加", () => {
    const { em, fire, root } = setup();
    // 一棵 1 + 3 + 9 = 13 个节点的树，每个节点都挂监听器
    for (let i = 0; i < 3; i++) {
      const group = new Container({} as TinyUI, `g${i}`);
      group.pivotX = group.pivotY = 0;
      group.setSize(800, 600);
      group.addEventListener("touchstart", (e) => e.stop());
      group.addEventListener("mousemove", (e) => e.stop());
      root.addChild(group);
      for (let j = 0; j < 3; j++) {
        const leaf = new Container({} as TinyUI, `leaf${i}${j}`);
        leaf.pivotX = leaf.pivotY = 0;
        leaf.setSize(800, 600);
        leaf.addEventListener("touchstart", (e) => e.stop());
        leaf.addEventListener("mousemove", (e) => e.stop());
        group.addChild(leaf);
      }
    }
    const seen: string[] = [];
    em.addEventObserver((e) => { seen.push(e.type); });
    fire.touch("touchstart", [new FakeTouch(1, 10, 10)], [new FakeTouch(1, 10, 10)]);
    fire.mouse("mousemove", 10, 10);
    expect(seen).toEqual(["touchstart", "mousemove"]);
  });

  it("观察者返回 false 在入口处停止分发，返回 true 只观察", () => {
    const { em, fire, root } = setup();
    const btn = new Container({} as TinyUI, "btn");
    btn.pivotX = btn.pivotY = 0;
    btn.setSize(800, 600);
    root.addChild(btn);
    const onTouch = vi.fn();
    btn.addEventListener("touchstart", onTouch);
    const offTrue = em.addEventObserver(() => true);
    fire.touch("touchstart", [new FakeTouch(1, 10, 10)], [new FakeTouch(1, 10, 10)]);
    expect(onTouch).toHaveBeenCalledTimes(1);
    offTrue();
    em.addEventObserver(() => false);
    fire.touch("touchstart", [new FakeTouch(1, 10, 10)], [new FakeTouch(1, 10, 10)]);
    expect(onTouch).toHaveBeenCalledTimes(1);
  });

  it("自定义触摸入口同样在分发前经过观察者", () => {
    const handlers = new Map<string, EventListener>();
    const app = { canvas: { addEventListener() {}, removeEventListener() {}, width: 10, height: 10,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }) },
    root: new Container({} as TinyUI) } as any;
    const em = new EventManager(app, { handleTouchEventListening: (name, h) => handlers.set(name, h as any) });
    const seen: number[] = [];
    em.addEventObserver(e => { seen.push(e.identifier); return false; });
    (handlers.get("touchcancel") as any)(new FakeTouchEvent([], [new FakeTouch(99, 1, 1)]));
    expect(seen).toEqual([99]);
  });
});
