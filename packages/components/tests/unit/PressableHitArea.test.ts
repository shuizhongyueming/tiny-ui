import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pressable } from "../../src/Pressable";
import { setup, installFakeInput } from "./inputHarness";

/* 命中区用真实输入链路验证：从 canvas 监听器进入，走完整 EventManager 分发。 */

let restoreInput: () => void = () => {};
beforeEach(() => { restoreInput = installFakeInput(); });
afterEach(() => { restoreInput(); });

describe("Pressable 命中区", () => {
  it("hitPadding 默认 0：视觉框外点击不触发", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 100, 100, 20, 20);
    h.root.addChild(node);
    const taps: string[] = [];
    Pressable(h.app, node, { onTap: () => taps.push("tap") });

    h.touch("touchstart", 1, 105, 105);
    h.touch("touchend", 1, 105, 105);
    expect(taps).toEqual(["tap"]);

    h.touch("touchstart", 2, 90, 110);
    h.touch("touchend", 2, 90, 110);
    expect(taps).toEqual(["tap"]);
  });

  it("hitPadding 放大命中区，视觉尺寸不变", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 100, 100, 20, 20);
    h.root.addChild(node);
    const taps: string[] = [];
    Pressable(h.app, node, { onTap: () => taps.push("tap"), hitPadding: 12 });

    // 视觉 100..120，命中区 88..132。
    expect(node.width).toBe(20);
    expect(node.hitTest(92, 92)).toBe(true);
    expect(node.hitTest(86, 86)).toBe(false);

    h.touch("touchstart", 1, 92, 92);
    h.touch("touchend", 1, 92, 92);
    expect(taps).toEqual(["tap"]);

    h.touch("touchstart", 2, 130, 130);
    h.touch("touchend", 2, 130, 130);
    expect(taps).toEqual(["tap", "tap"]);

    h.touch("touchstart", 3, 86, 86);
    h.touch("touchend", 3, 86, 86);
    expect(taps).toEqual(["tap", "tap"]);
  });

  it("hitPadding 支持 x/y 不同", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 100, 100, 20, 20);
    h.root.addChild(node);
    const taps: string[] = [];
    Pressable(h.app, node, { onTap: () => taps.push("tap"), hitPadding: { x: 20, y: 4 } });

    h.touch("touchstart", 1, 85, 110);
    h.touch("touchend", 1, 85, 110);
    expect(taps).toEqual(["tap"]);

    h.touch("touchstart", 2, 110, 97);
    h.touch("touchend", 2, 110, 97);
    expect(taps).toEqual(["tap", "tap"]);

    h.touch("touchstart", 3, 110, 85);
    h.touch("touchend", 3, 110, 85);
    expect(taps).toEqual(["tap", "tap"]);
  });

  it("hitPadding 传函数时每次判定重新求值", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 100, 100, 20, 20);
    h.root.addChild(node);
    const taps: string[] = [];
    let padding = 0;
    Pressable(h.app, node, { onTap: () => taps.push("tap"), hitPadding: () => padding });

    h.touch("touchstart", 1, 92, 92);
    h.touch("touchend", 1, 92, 92);
    expect(taps).toEqual([]);

    padding = 12;
    h.touch("touchstart", 2, 92, 92);
    h.touch("touchend", 2, 92, 92);
    expect(taps).toEqual(["tap"]);
  });

  it("hitPadding 与 slop 同时给出时取更大容差", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 100, 100, 20, 20);
    h.root.addChild(node);
    const taps: string[] = [];
    Pressable(h.app, node, { onTap: () => taps.push("tap"), hitPadding: 2, slop: 20 });

    h.touch("touchstart", 1, 82, 82);
    h.touch("touchend", 1, 82, 82);
    expect(taps).toEqual(["tap"]);
  });

  it("缩放后的节点按局部坐标扩边", () => {
    const h = setup();
    const node = h.place(h.app.createContainer("btn"), 0, 0, 20, 20);
    node.scaleX = 2;
    node.scaleY = 2;
    node.anchorX = 0;
    node.anchorY = 0;
    h.root.addChild(node);
    const taps: string[] = [];
    Pressable(h.app, node, { onTap: () => taps.push("tap"), hitPadding: 2 });

    // 视觉 0..40，局部外扩 2 相对缩放后是 4px，命中区 -4..44。
    h.touch("touchstart", 1, 42, 42);
    h.touch("touchend", 1, 42, 42);
    expect(taps).toEqual(["tap"]);

    h.touch("touchstart", 2, 10, -3);
    h.touch("touchend", 2, 10, -3);
    expect(taps).toEqual(["tap", "tap"]);
  });
});
