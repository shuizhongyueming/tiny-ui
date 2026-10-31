import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Scroll } from "../../src/Scroll";
import { setup, installFakeInput } from "./inputHarness";

let restoreInput: () => void = () => {};
beforeEach(() => { restoreInput = installFakeInput(); });
afterEach(() => { restoreInput(); });

describe("Scroll 指针捕获", () => {
  it("已消费 start 的手势仍能滚动，destroy 释放捕获", () => {
    const h = setup();
    const scroll = Scroll({ app: h.app, width: 100, height: 100, autoUpdate: false });
    h.place(scroll.container, 0, 0, 100, 100);
    scroll.container.children[0].setSize(100, 100);
    h.root.addChild(scroll.container);
    const tall = h.place(h.app.createContainer("tall"), 0, 0, 100, 400);
    scroll.content.addChild(tall);
    scroll.refresh();

    /* RootContainer 会在已消费 start 后双停 move。把同样的停止器放在根上，
       旧实现的后注册根监听器会全部失效。 */
    h.root.addEventListener("touchmove", e => e.stop());
    h.touch("touchstart", 1, 50, 80);
    expect(h.observerCount()).toBe(1);
    h.touch("touchmove", 1, 50, 40);
    expect(scroll.content.y).toBe(-40);
    expect(h.observerCount()).toBe(1);

    scroll.destroy();
    expect(h.observerCount()).toBe(0);
  });

  it("touchcancel 结束捕获且不触发惯性", () => {
    const h = setup();
    const scroll = Scroll({ app: h.app, width: 100, height: 100, autoUpdate: false });
    h.place(scroll.container, 0, 0, 100, 100);
    scroll.container.children[0].setSize(100, 100);
    h.root.addChild(scroll.container);
    scroll.content.addChild(h.place(h.app.createContainer("tall"), 0, 0, 100, 400));
    scroll.refresh();

    h.touch("touchstart", 1, 50, 80);
    h.touch("touchmove", 1, 50, 60);
    h.touch("touchcancel", 1, 50, 60);
    expect(h.observerCount()).toBe(0);
    h.touch("touchmove", 1, 50, 20);
    expect(scroll.content.y).toBe(-20);
  });
});
