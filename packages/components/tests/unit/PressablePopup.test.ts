import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Pressable } from "../../src/Pressable";
import { TextBtn } from "../../src/TextBtn";
import { Popup } from "../../src/Popup";
import { registerPressable } from "../../src/utils/pressableGroup";
import { setup, installFakeInput } from "./inputHarness";

/* 全部用例跑在真实 EventManager 上：输入从 canvas 监听器或自定义触摸入口进入，
   走完整分发链路，不 mock hitTest、不直接喂观察器回调。 */

let restoreInput: () => void = () => {};
beforeEach(() => { restoreInput = installFakeInput(); });
afterEach(() => { restoreInput(); });

describe("Pressable 多指隔离", () => {
  it("第一指按住 A，第二指点 B 仍然成功", () => {
    const h = setup();
    const a = h.place(h.app.createContainer("A"), 0, 0, 80, 80);
    const b = h.place(h.app.createContainer("B"), 100, 100, 60, 60);
    h.root.addChild(a);
    h.root.addChild(b);
    const taps: string[] = [];
    Pressable(h.app, a, { onTap: () => taps.push("A") });
    Pressable(h.app, b, { onTap: () => taps.push("B") });

    h.touch("touchstart", 1, 20, 20);
    h.touch("touchstart", 2, 130, 130);
    h.touch("touchend", 2, 130, 130);
    expect(taps).toEqual(["B"]);

    h.touch("touchend", 1, 20, 20);
    expect(taps).toEqual(["B", "A"]);
  });

  it("非本方触点不被消费，游戏和祖先仍能收到", () => {
    const h = setup();
    const btn = h.place(h.app.createContainer("btn"), 0, 0, 60, 60);
    const game = h.place(h.app.createContainer("game"), 0, 0, 200, 200);
    h.root.addChild(game);
    game.addChild(btn);
    Pressable(h.app, btn, { onTap: () => {} });
    const gameSaw: string[] = [];
    for (const type of ["touchstart", "touchmove", "touchend"] as const) {
      game.addEventListener(type, () => gameSaw.push(type));
    }
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchstart", 2, 150, 150);
    h.touch("touchmove", 2, 152, 150);
    h.touch("touchend", 2, 152, 150);
    /* 按钮自己那一指被消费（祖先看不到，这是设计）；第二指必须完整透传到 game。
       修复前这里是空的：非本方触点返回 false，整条事件在入口就被丢掉。 */
    expect(gameSaw).toEqual(["touchstart", "touchmove", "touchend"]);
  });

  it("mouse 活跃时其它触摸不吞", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const taps: string[] = [];
    Pressable(h.app, node, { onTap: () => taps.push("tap") });
    h.mouse("mousedown", 20, 20);
    h.touch("touchstart", 7, 150, 150);
    h.touch("touchend", 7, 150, 150);
    h.mouse("mouseup", 20, 20);
    expect(taps).toEqual(["tap"]);
  });

  it("首指独占：第二指不能完成第一指的手势", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    const changes: boolean[] = [];
    Pressable(h.app, node, { onTap: tap, onPressChange: (v) => changes.push(v) });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchstart", 2, 20, 20);
    h.touch("touchend", 2, 20, 20);
    expect(tap).not.toHaveBeenCalled();
    h.touch("touchend", 1, 20, 20);
    expect(tap).toHaveBeenCalledTimes(1);
    expect(changes).toEqual([true, false]);
  });

  it("touchcancel 结束手势且不点击", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    Pressable(h.app, node, { onTap: tap });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchcancel", 1, 20, 20);
    expect(tap).not.toHaveBeenCalled();
    expect(h.observerCount()).toBe(0);
  });

  it("取消后的释放不穿透到下层", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const lower = vi.fn();
    h.root.addEventListener("touchend", lower);
    const tap = vi.fn();
    Pressable(h.app, node, { onTap: tap });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchmove", 1, 150, 150);
    h.touch("touchend", 1, 150, 150);
    expect(tap).not.toHaveBeenCalled();
    expect(lower).not.toHaveBeenCalled();
  });

  it("destroy 摘掉节点监听与观察器", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const p = Pressable(h.app, node, { onTap: vi.fn() });
    h.touch("touchstart", 1, 20, 20);
    expect(h.observerCount()).toBe(1);
    p.destroy();
    expect(h.observerCount()).toBe(0);
    expect(node.hasEventListener("touchstart")).toBe(false);
    expect(node.hasEventListener("mousedown")).toBe(false);
  });

  it("setEnabled(false) 结束手势且不再响应", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    const p = Pressable(h.app, node, { onTap: tap });
    h.touch("touchstart", 1, 20, 20);
    p.setEnabled(false);
    h.touch("touchend", 1, 20, 20);
    h.touch("touchstart", 2, 20, 20);
    h.touch("touchend", 2, 20, 20);
    expect(tap).not.toHaveBeenCalled();
  });

  it("stopPropagation: false 时本指事件仍能到达祖先", () => {
    const h = setup();
    const panel = h.place(h.app.createContainer("panel"), 0, 0, 200, 200);
    h.root.addChild(panel);
    const btn = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    panel.addChild(btn);
    const saw: string[] = [];
    for (const type of ["touchstart", "touchmove", "touchend"] as const) {
      panel.addEventListener(type, () => saw.push(type));
    }
    const tap = vi.fn();
    Pressable(h.app, btn, { onTap: tap, stopPropagation: false });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchmove", 1, 22, 20);
    h.touch("touchend", 1, 22, 20);
    expect(tap).toHaveBeenCalledTimes(1);
    /* 「不替我阻滞传播」意味着祖先必须看得到整个手势。 */
    expect(saw).toEqual(["touchstart", "touchmove", "touchend"]);
  });
});

describe("Pressable 鼠标画布外松开", () => {
  it("画布内 mouseup 先完成 onTap，再经过 window 冒泡且不重复触发", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    Pressable(h.app, node, { onTap: tap });
    h.mouse("mousedown", 20, 20);
    h.mouse("mouseup", 20, 20);
    expect(tap).toHaveBeenCalledTimes(1);
    expect(h.observerCount()).toBe(0);
    expect(h.windowListenerCount("mouseup")).toBe(0);
  });

  it("window mouseup 结束手势，之后输入恢复正常", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    const other = h.place(h.app.createContainer("other"), 0, 0, 200, 200);
    h.root.addChild(other);
    h.root.addChild(node);
    const log: string[] = [];
    Pressable(h.app, node, { onTap: () => log.push("tap") });
    other.addEventListener("mouseup", () => log.push("other:mouseup"));

    h.mouse("mousedown", 20, 20);
    expect(h.windowListenerCount("mouseup")).toBe(1);
    h.mouse("mousemove", 190, 190);
    h.windowMouseUp(190, 190);
    expect(h.windowListenerCount("mouseup")).toBe(0);
    expect(h.observerCount()).toBe(0);

    h.mouse("mousedown", 150, 150);
    h.mouse("mouseup", 150, 150);
    expect(log).toEqual(["other:mouseup"]);
  });

  it("window blur 也结束手势，且不产生点击", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    const changed: boolean[] = [];
    Pressable(h.app, node, { onTap: tap, onPressChange: (v) => changed.push(v) });
    h.mouse("mousedown", 20, 20);
    expect(h.windowListenerCount("blur")).toBe(1);
    h.windowEvent("blur");
    expect(changed).toEqual([true, false]);
    expect(h.windowListenerCount("blur")).toBe(0);
    expect(tap).not.toHaveBeenCalled();
  });

  it("没有 ownerDocument/window 时不报错", () => {
    const h = setup();
    h.app.canvas.ownerDocument = undefined;
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    Pressable(h.app, node, { onTap: tap });
    expect(() => h.mouse("mousedown", 20, 20)).not.toThrow();
    expect(() => h.mouse("mouseup", 20, 20)).not.toThrow();
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("destroy 后 window 监听器被移除", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const p = Pressable(h.app, node, {});
    h.mouse("mousedown", 20, 20);
    expect(h.windowListenerCount("mouseup")).toBe(1);
    p.destroy();
    expect(h.windowListenerCount("mouseup")).toBe(0);
    expect(h.windowListenerCount("blur")).toBe(0);
  });

  it("鼠标按压期间的合成 mouse 不会重复触发", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    Pressable(h.app, node, { onTap: tap });
    h.mouse("mousedown", 20, 20);
    h.mouse("mouseup", 20, 20);
    expect(tap).toHaveBeenCalledTimes(1);
  });
});

describe("Pressable 移动阈值与按下位移", () => {
  it("moveThreshold 超过后永久取消，即使回到节点内", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 180, 180);
    h.root.addChild(node);
    const tap = vi.fn();
    Pressable(h.app, node, { onTap: tap, moveThreshold: 10 });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchmove", 1, 60, 20);
    h.touch("touchmove", 1, 20, 20);
    h.touch("touchend", 1, 20, 20);
    expect(tap).not.toHaveBeenCalled();
  });

  it("未设 moveThreshold 时界内移动不取消", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 180, 180);
    h.root.addChild(node);
    const tap = vi.fn();
    Pressable(h.app, node, { onTap: tap });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchmove", 1, 120, 20);
    h.touch("touchend", 1, 120, 20);
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("移动过程不再无条件弹回按下视觉，只在取消时", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 180, 180);
    h.root.addChild(node);
    const states: boolean[] = [];
    Pressable(h.app, node, { moveThreshold: 10, onPressChange: (v) => states.push(v) });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchmove", 1, 21, 20);
    expect(states).toEqual([true]);
    h.touch("touchmove", 1, 60, 20);
    expect(states).toEqual([true, false]);
    h.touch("touchend", 1, 60, 20);
    expect(states).toEqual([true, false]);
  });

  it("pressDy 位移不改变命中基准：边缘点按仍算点击", () => {
    for (const pressDy of [6, -6]) {
      const h = setup();
      const node = h.place(h.app.createContainer(`btn${pressDy}`), 0, 0, 100, 100);
      h.root.addChild(node);
      const tap = vi.fn();
      Pressable(h.app, node, { onTap: tap, pressDy });
      const y = pressDy > 0 ? 2 : 98;
      h.touch("touchstart", 1, 50, y);
      expect(node.y).toBe(pressDy);
      h.touch("touchend", 1, 50, y);
      expect(tap).toHaveBeenCalledTimes(1);
      expect(node.y).toBe(0);
    }
  });
});

describe("pressableGroup 子树取消", () => {
  it("TextBtn 按下后 popup.close()，release 不触发点击且视觉复位", () => {
    const h = setup();
    const popup = Popup({ app: h.app, parent: h.root, closeDuration: 0.5 });
    h.place(popup, 0, 0, 200, 200);
    const content = h.place(h.app.createContainer("content"), 0, 0, 200, 200);
    popup.addContent(content);
    const onClick = vi.fn();
    const btn = TextBtn({
      app: h.app, text: "OK", width: 100, height: 50, pressEffect: true, onClick,
    });
    h.place(btn.container, 10, 10, 100, 50);
    content.addChild(btn.container);
    const bg = btn.container.children[0] as any;

    h.touch("touchstart", 1, 40, 30);
    expect(bg.alpha).toBe(0.7);
    popup.close();
    expect(bg.alpha).toBe(1);
    h.touch("touchend", 1, 40, 30);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("registerPressable 在 pressable.destroy 后不再持有引用", () => {
    const h = setup();
    const owner = h.place(h.app.createContainer("owner"), 0, 0, 200, 200);
    h.root.addChild(owner);
    const btn = h.place(h.app.createContainer("btn"), 0, 0, 50, 50);
    owner.addChild(btn);
    const p = Pressable(h.app, btn, {});
    registerPressable(owner, p);
    p.destroy();
    expect(() => owner.destroy()).not.toThrow();
    expect(owner.destroyed).toBe(true);
  });

  it("cancel 只取消手势，不永久禁用", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    const tap = vi.fn();
    const p = Pressable(h.app, node, { onTap: tap });
    h.touch("touchstart", 1, 20, 20);
    p.cancel();
    h.touch("touchend", 1, 20, 20);
    expect(tap).not.toHaveBeenCalled();
    h.touch("touchstart", 2, 20, 20);
    h.touch("touchend", 2, 20, 20);
    expect(tap).toHaveBeenCalledTimes(1);
  });
});

describe("Popup 生命周期", () => {
  it("关闭时保留起始 alpha 并淡出", () => {
    const h = setup();
    const popup = Popup({ app: h.app, closeDuration: 0.5 });
    popup.alpha = 0.4;
    popup.close();
    for (const tick of [...h.ticks]) tick(250);
    expect(popup.alpha).toBeCloseTo(0.2);
  });

  it("close 幂等、只注册一个 tick、只调一次 onClose", () => {
    const h = setup();
    const onClose = vi.fn();
    const popup = Popup({ app: h.app, parent: h.root, closeDuration: 0.5, onClose });
    popup.close();
    popup.close();
    expect(h.ticks.size).toBe(1);
    for (const tick of [...h.ticks]) tick(250);
    expect(h.ticks.size).toBe(1);
    for (const tick of [...h.ticks]) tick(250);
    expect(popup.destroyed).toBe(true);
    expect(h.ticks.size).toBe(0);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(h.observerCount()).toBe(0);
  });

  it("直接 destroy 不调 onClose，并清 tick 与遮罩", () => {
    const h = setup();
    const onClose = vi.fn();
    const popup = Popup({ app: h.app, parent: h.root, closeDuration: 1, onClose });
    popup.close();
    expect(h.ticks.size).toBe(1);
    popup.destroy();
    expect(h.ticks.size).toBe(0);
    expect(h.observerCount()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("modal 吞掉落在弹窗上的输入", () => {
    const h = setup();
    const under = vi.fn();
    const btn = TextBtn({ app: h.app, text: "under", width: 200, height: 200, onClick: under });
    h.place(btn.container, 0, 0, 200, 200);
    h.root.addChild(btn.container);
    const popup = Popup({ app: h.app, parent: h.root, modal: true });
    h.place(popup, 0, 0, 200, 200);
    h.touch("touchstart", 1, 50, 50);
    h.touch("touchend", 1, 50, 50);
    expect(under).not.toHaveBeenCalled();
  });

  it("close 期间全局模态，只调用一次 onComplete", () => {
    const h = setup();
    const onComplete = vi.fn();
    const tap = vi.fn();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 100, 100);
    h.root.addChild(node);
    Pressable(h.app, node, { onTap: tap });
    const popup = Popup({ app: h.app, parent: h.root, closeDuration: 0.5 });
    popup.close({ onComplete });
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchend", 1, 20, 20);
    expect(tap).not.toHaveBeenCalled();
    for (const tick of [...h.ticks]) tick(600);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("TextBtn 真实输入链路", () => {
  it("点击触发 onClick 且保持公开接口", () => {
    const h = setup();
    const onClick = vi.fn();
    const btn = TextBtn({ app: h.app, text: "A", width: 100, height: 50, onClick });
    h.place(btn.container, 10, 10, 100, 50);
    h.root.addChild(btn.container);
    expect(() => btn.setRadius(8)).not.toThrow();
    expect(() => btn.setBgColor("#fff")).not.toThrow();
    h.touch("touchstart", 1, 40, 30);
    h.touch("touchend", 1, 40, 30);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("宽按钮上拖拽超过 10px 不再算点击", () => {
    const h = setup();
    const onClick = vi.fn();
    const btn = TextBtn({ app: h.app, text: "WIDE", width: 400, height: 80, onClick });
    h.place(btn.container, 0, 0, 400, 80);
    h.root.addChild(btn.container);
    h.touch("touchstart", 1, 20, 20);
    h.touch("touchmove", 1, 300, 40);
    h.touch("touchend", 1, 300, 40);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("默认尺寸与 pressEffect 视觉复位", () => {
    const h = setup();
    const btn = TextBtn({ app: h.app, text: "A", onClick: vi.fn(), pressEffect: true });
    expect(btn.container.width).toBe(180);
    expect(btn.container.height).toBe(68);
    h.place(btn.container, 0, 0, 180, 68);
    h.root.addChild(btn.container);
    const bg = btn.container.children[0] as any;
    h.touch("touchstart", 1, 40, 30);
    expect(bg.alpha).toBe(0.7);
    h.touch("touchend", 1, 40, 30);
    expect(bg.alpha).toBe(1);
  });
});
