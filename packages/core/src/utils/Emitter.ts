export type EmitterCallback<P = unknown> = [P] extends [void]
  ? () => void
  : (p: P) => void;

export type EventType = "resize" | "childrenChanged" | "destroyed";

export class Emitter {
  private listeners: Map<EventType | string, Set<EmitterCallback>> = new Map();

  on<P = unknown>(
    eventName: EventType | string,
    callback: EmitterCallback<P>
  ): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback as EmitterCallback);
    return () => this.off(eventName, callback);
  }

  once<P = unknown>(
    eventName: EventType | string,
    callback: EmitterCallback<P>
  ): void {
    const wrapped = (data?: P) => {
      this.off(eventName, wrapped);
      (callback as EmitterCallback)(data);
    };
    this.on(eventName, wrapped);
  }

  off(eventName: EventType | string, callback: EmitterCallback): void {
    this.listeners.get(eventName)?.delete(callback);
  }

  emit<P = unknown>(eventName: EventType | string, data?: P): void {
    if (this.listeners.has(eventName)) {
      const callbacks = Array.from(this.listeners.get(eventName)!);
      for (const callback of callbacks) {
        (callback as EmitterCallback)(data);
      }
    }
  }

  listenerCount(eventName: EventType | string): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }

  hasListener(eventName: EventType | string): boolean {
    return this.listenerCount(eventName) > 0;
  }

  removeAllListeners(eventName?: EventType | string): void {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
  }
}
