// from
// https://github.com/nicolas-van/modern-async/blob/master/src/Deferred.mjs

export class Deferred<T = void> {
  _promise: Promise<T>;
  _resolve!: (value: T | PromiseLike<T>) => void;
  _reject!: (reason?: unknown) => void;

  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  get promise(): Promise<T> {
    return this._promise;
  }
  get resolve(): (value: T | PromiseLike<T>) => void {
    return this._resolve;
  }
  get reject(): (reason?: unknown) => void {
    return this._reject;
  }
}
