export type EaseFunction = (progress: number) => number;

export const Ease = {
  linear: (t: number): number => t,
  inQuad: (t: number): number => t * t,
  outQuad: (t: number): number => 1 - (1 - t) * (1 - t),
  outCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
};

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFunction {
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError("Bezier x control points must be between 0 and 1");
  }
  const sample = (t: number, a: number, b: number): number =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const t = (lo + hi) / 2;
      if (sample(t, x1, x2) < x) lo = t;
      else hi = t;
    }
    return sample((lo + hi) / 2, y1, y2);
  };
}

export interface TweenHandle {
  cancel(): void;
}

export interface TweenOwner {
  destroyed?: boolean;
  on?(event: "destroyed", callback: () => void): () => void;
}

export interface TweenOptions {
  delay?: number;
  ease?: EaseFunction;
  from?: Record<string, number>;
  onUpdate?: () => void;
  onComplete?: () => void;
}

interface Entry {
  target?: object;
  values: Record<string, number>;
  from: Record<string, number>;
  elapsed: number;
  duration: number;
  delay: number;
  ease: EaseFunction;
  onUpdate?: () => void;
  onComplete?: () => void;
  detach?: () => void;
  cancel: () => void;
}

export class TweenGroup {
  private entries = new Set<Entry>();

  to<T extends object>(target: T, values: Partial<Record<keyof T, number>>,
    duration: number, options: TweenOptions = {}): TweenHandle {
    const noop = { cancel: () => {} };
    if ((target as TweenOwner).destroyed) return noop;
    this.validateTime(duration);
    this.validateTime(options.delay ?? 0);
    const to = { ...values } as Record<string, number>;
    const from: Record<string, number> = {};
    for (const key of Object.keys(to)) {
      from[key] = options.from?.[key] ?? (target as Record<string, number>)[key];
      if (!Number.isFinite(to[key]) || !Number.isFinite(from[key])) {
        throw new TypeError(`Tween property ${key} must be finite`);
      }
    }
    this.cancel(target, Object.keys(to));
    return this.add({ target, values: to, from, duration, delay: options.delay ?? 0,
      ease: options.ease ?? Ease.outCubic, onUpdate: options.onUpdate,
      onComplete: options.onComplete }, target as TweenOwner);
  }

  wait(seconds: number, onComplete: () => void, owner?: TweenOwner): TweenHandle {
    if (owner?.destroyed) return { cancel: () => {} };
    this.validateTime(seconds);
    return this.add({ values: {}, from: {}, duration: seconds, delay: 0,
      ease: Ease.linear, onComplete }, owner);
  }

  private cancel(target: object, properties?: readonly string[]): void {
    for (const entry of this.entries) {
      if (entry.target !== target) continue;
      if (!properties) {
        entry.cancel();
        continue;
      }
      for (const key of properties) delete entry.values[key];
      if (!Object.keys(entry.values).length) entry.cancel();
    }
  }

  update(dt: number): void {
    /* 宿主时钟回跳、页签节流、rAF 首帧都可能给出 NaN/Infinity/负 delta。
       这里忽略本次 update，而不是抛 RangeError —— 抛异常会打断宿主的整帧循环
       （TinyUI 自己的 tick 有 try/catch，但宿主手写的 rAF 没有）。
       参数校验留在 to() / wait() 的 duration、delay 上。 */
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const entry of Array.from(this.entries)) {
      if (!this.entries.has(entry)) continue;
      entry.elapsed += dt;
      if (entry.delay > 0 && !Object.keys(entry.values).length) entry.delay = 0;
      if (entry.elapsed < entry.delay) continue;
      const progress = entry.duration === 0 ? 1 : Math.min(1, (entry.elapsed - entry.delay) / entry.duration);
      const eased = entry.ease(progress);
      if (!this.entries.has(entry)) continue;
      if (entry.target) {
        for (const key of Object.keys(entry.values)) {
          (entry.target as Record<string, number>)[key] = progress === 1 ? entry.values[key] :
            entry.from[key] + (entry.values[key] - entry.from[key]) * eased;
        }
      }
      /* onUpdate 是宿主代码，可能 cancel/clear 本条目或同目标启动替代动画，
         之后必须重新确认条目仍在集合中再决定完成，避免误触发 onComplete。 */
      if (!this.entries.has(entry)) continue;
      entry.onUpdate?.();
      if (progress === 1 && this.entries.has(entry)) {
        entry.cancel();
        entry.onComplete?.();
      }
    }
  }

  clear(): void {
    for (const entry of this.entries) entry.cancel();
  }

  private validateTime(value: number): void {
    if (!Number.isFinite(value) || value < 0) throw new RangeError("Tween time must be finite and nonnegative");
  }

  private add(input: Omit<Entry, "elapsed" | "cancel">, owner?: TweenOwner): TweenHandle {
    const entry: Entry = { ...input, elapsed: 0, cancel: () => {
      this.entries.delete(entry);
      entry.detach?.();
      entry.detach = undefined;
    } };
    if (!owner?.destroyed) {
      this.entries.add(entry);
      entry.detach = owner?.on?.("destroyed", entry.cancel);
    }
    return { cancel: entry.cancel };
  }
}
