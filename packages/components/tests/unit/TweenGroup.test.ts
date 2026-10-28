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

  it("formats a tweened counter into label text on every advance, update before complete on the final frame", () => {
    const group = new TweenGroup();
    const score = { value: 0 };
    const label = { text: "0" };
    const events: string[] = [];
    group.to(score, { value: 100 }, 1, {
      ease: Ease.linear,
      onUpdate: () => {
        events.push(`update:${score.value}`);
        label.text = Math.round(score.value).toString();
      },
      onComplete: () => events.push("complete"),
    });
    group.update(0.5);
    expect(score.value).toBe(50);
    expect(label.text).toBe("50");
    expect(events).toEqual(["update:50"]);
    group.update(0.5);
    expect(score.value).toBe(100);
    expect(label.text).toBe("100");
    expect(events).toEqual(["update:50", "update:100", "complete"]);
    /* 完成后条目已移除，多余的 update 不再回调。 */
    group.update(1);
    expect(events).toHaveLength(3);
  });

  it("does not call onUpdate during delay and consumes only the remainder after it", () => {
    const group = new TweenGroup();
    const target = { x: 0 };
    const onUpdate = vi.fn();
    group.to(target, { x: 100 }, 1, { delay: 0.15, ease: Ease.linear, onUpdate });
    group.update(0.1);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(target.x).toBe(0);
    group.update(0.1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(target.x).toBeCloseTo(5);
  });

  it("fires onUpdate once with final values before onComplete for zero-duration tweens", () => {
    const group = new TweenGroup();
    const target = { x: 0, y: 1 };
    const events: string[] = [];
    group.to(target, { x: 10, y: 5 }, 0, {
      onUpdate: () => events.push(`update:${target.x},${target.y}`),
      onComplete: () => events.push("complete"),
    });
    group.update(0.5);
    expect(target).toEqual({ x: 10, y: 5 });
    expect(events).toEqual(["update:10,5", "complete"]);
    group.update(1);
    expect(events).toHaveLength(2);
  });

  it("skips onUpdate and onComplete after cancel, clear or owner destruction", () => {
    const group = new TweenGroup();
    const a = { x: 0 };
    const onUpdateA = vi.fn();
    const handle = group.to(a, { x: 10 }, 1, { onUpdate: onUpdateA });
    handle.cancel();
    group.update(1);
    expect(a.x).toBe(0);
    expect(onUpdateA).not.toHaveBeenCalled();
    const b = { x: 0 };
    const onUpdateB = vi.fn();
    group.to(b, { x: 10 }, 1, { onUpdate: onUpdateB });
    group.clear();
    group.update(1);
    expect(b.x).toBe(0);
    expect(onUpdateB).not.toHaveBeenCalled();
    const c = Object.assign(new Emitter(), { x: 0, destroyed: false });
    const onUpdateC = vi.fn();
    const doneC = vi.fn();
    group.to(c, { x: 10 }, 1, { onUpdate: onUpdateC, onComplete: doneC });
    c.destroyed = true;
    c.emit("destroyed");
    group.update(1);
    expect(c.x).toBe(0);
    expect(onUpdateC).not.toHaveBeenCalled();
    expect(doneC).not.toHaveBeenCalled();
  });

  it("keeps onComplete from firing when onUpdate cancels, clears or replaces the tween", () => {
    const group = new TweenGroup();
    const a = { x: 0 };
    const doneA = vi.fn();
    let handle: ReturnType<TweenGroup["to"]> | undefined;
    handle = group.to(a, { x: 10 }, 1, {
      ease: Ease.linear,
      onUpdate: () => handle?.cancel(),
      onComplete: doneA,
    });
    group.update(0.5);
    expect(a.x).toBe(5);
    expect(doneA).not.toHaveBeenCalled();
    group.update(1);
    expect(a.x).toBe(5);
    expect(doneA).not.toHaveBeenCalled();
    const b = { x: 0 };
    const doneB = vi.fn();
    group.to(b, { x: 10 }, 1, {
      ease: Ease.linear,
      onUpdate: () => group.clear(),
      onComplete: doneB,
    });
    group.update(0.5);
    expect(b.x).toBe(5);
    expect(doneB).not.toHaveBeenCalled();
    group.update(1);
    expect(b.x).toBe(5);
    expect(doneB).not.toHaveBeenCalled();
    const c = { x: 0 };
    const doneOld = vi.fn();
    const doneNew = vi.fn();
    const onUpdateNew = vi.fn();
    group.to(c, { x: 100 }, 1, {
      ease: Ease.linear,
      onUpdate: () => {
        /* 同目标启动替代动画：旧条目被接管，不应再触发旧 onComplete，
           新动画从下一次 update 开始推进。 */
        if (c.x >= 50) {
          group.to(c, { x: 200 }, 1, { ease: Ease.linear, onUpdate: onUpdateNew, onComplete: doneNew });
        }
      },
      onComplete: doneOld,
    });
    group.update(0.6);
    expect(c.x).toBe(60);
    expect(doneOld).not.toHaveBeenCalled();
    group.update(0.4);
    expect(c.x).toBe(116);
    expect(onUpdateNew).toHaveBeenCalledTimes(1);
    expect(doneNew).not.toHaveBeenCalled();
    group.update(0.6);
    expect(c.x).toBe(200);
    expect(doneNew).toHaveBeenCalledTimes(1);
    expect(doneOld).not.toHaveBeenCalled();
  });
});
