import { describe, expect, it, vi } from "vitest";
import { TweenGroup, Ease, cubicBezier } from "../../src/TweenGroup";
import { Emitter } from "../../../core/src/utils/Emitter";

describe("TweenGroup", () => {
  it("isolates groups and consumes only the remainder after delay", () => {
    const a = new TweenGroup();
    const b = new TweenGroup();
    const x = { x: 0 };
    const y = { x: 0 };
    a.to(x, { x: 100 }, 1, { delay: 0.15, ease: Ease.linear });
    b.to(y, { x: 100 }, 1);
    a.update(0.1);
    expect(x.x).toBe(0);
    a.update(0.1);
    expect(x.x).toBeCloseTo(5);
    expect(y.x).toBe(0);
    a.clear();
    b.update(1);
    expect(y.x).toBe(100);
    a.update(1);
    expect(x.x).toBeCloseTo(5);
  });

  it("replaces only conflicting properties and cancels superseded callbacks", () => {
    const group = new TweenGroup();
    const target = { x: 0, y: 0 };
    const completed = vi.fn();
    group.to(target, { x: 10, y: 20 }, 1, { ease: Ease.linear, onComplete: completed });
    group.update(0.5);
    group.to(target, { x: 50 }, 0.5, { ease: Ease.linear });
    group.update(0.5);
    expect(target).toEqual({ x: 50, y: 20 });
    expect(completed).toHaveBeenCalledTimes(1);
    group.to(target, { x: 100 }, 1, { onComplete: completed });
    group.to(target, { x: 200 }, 1);
    group.update(1);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("cancels handles and owner destruction without completion and removes listeners", () => {
    const group = new TweenGroup();
    const target = Object.assign(new Emitter(), { x: 0, destroyed: false });
    const done = vi.fn();
    const handle = group.to(target, { x: 10 }, 1, { onComplete: done });
    expect(target.listenerCount("destroyed")).toBe(1);
    handle.cancel();
    handle.cancel();
    expect(target.listenerCount("destroyed")).toBe(0);
    group.to(target, { x: 10 }, 1, { onComplete: done });
    group.wait(1, done, target);
    target.destroyed = true;
    target.emit("destroyed");
    group.update(1);
    expect(target.x).toBe(0);
    expect(done).not.toHaveBeenCalled();
    group.update(1);
    expect(done).not.toHaveBeenCalled();
    expect(target.listenerCount("destroyed")).toBe(0);
    group.to(target, { x: 20 }, 1);
    group.update(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("defers completion-created entries until the next update and supports clear in callbacks", () => {
    const group = new TweenGroup();
    const target = { x: 0 };
    group.wait(0, () => group.to(target, { x: 1 }, 1, { ease: Ease.linear }));
    group.update(1);
    expect(target.x).toBe(0);
    group.update(0.5);
    expect(target.x).toBe(0.5);
    group.wait(0, () => group.clear());
    const done = vi.fn();
    group.wait(0, done);
    group.update(0);
    expect(done).not.toHaveBeenCalled();
    group.update(1);
    expect(done).not.toHaveBeenCalled();
  });

  it("supports custom easing, exact endpoints and cubic bezier overshoot", () => {
    const group = new TweenGroup();
    const target = { x: 0 };
    group.to(target, { x: 10 }, 1, { ease: () => 2 });
    group.update(0.5);
    expect(target.x).toBe(20);
    group.update(0.5);
    expect(target.x).toBe(10);
    const curve = cubicBezier(0.34, 1.56, 0.64, 1);
    expect(curve(0)).toBe(0);
    expect(curve(1)).toBe(1);
    expect(curve(0.5)).toBeGreaterThan(1);
    expect(cubicBezier(0, 0, 1, 1)(0.35)).toBeCloseTo(0.35);
    expect(() => cubicBezier(-1, 0, 1, 1)).toThrow();
    expect(() => group.to(target, { x: 1 }, NaN)).toThrow();
    expect(() => group.wait(Infinity, () => {})).toThrow();
  });

  it("ignores non-finite or negative dt instead of throwing mid-frame", () => {
    const group = new TweenGroup();
    const target = { x: 0 };
    const done = vi.fn();
    group.to(target, { x: 10 }, 1, { ease: Ease.linear, onComplete: done });
    group.update(0.5);
    /* 宿主时钟回跳 / 页面节流不应打断整帧，也不应推进进度。
       参数校验留给 to() / wait()。 */
    for (const bad of [NaN, Infinity, -Infinity, -1, -0.5]) {
      expect(() => group.update(bad)).not.toThrow();
    }
    expect(target.x).toBeCloseTo(5);
    expect(done).not.toHaveBeenCalled();
    group.update(0.5);
    expect(target.x).toBe(10);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
