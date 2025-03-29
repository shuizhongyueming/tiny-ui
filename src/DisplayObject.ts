import { type Container } from "./Container";
import type { EventName, Callback, Rect } from "./type";
import { type Matrix } from "./utils/Matrix";
import type TinyUI from "./TinyUI";

export class DisplayObject {
  app: TinyUI;
  parent: Container | null = null;
  isScaleAffectedSize: boolean = false;
  x: number = 0;
  y: number = 0;
  width: number = 0;
  height: number = 0;
  visible: boolean = true;
  scaleX: number = 1;
  scaleY: number = 1;
  anchorX: number = 0;
  anchorY: number = 0;
  alpha: number = 1;
  name: string = "";
  rotation: number = 0; // 角度 (0-360)

  private eventListeners: Map<EventName, Set<Callback>> = new Map();

  constructor(app: TinyUI, name?: string) {
    this.app = app;
    this.name = name || "DisplayObject";
  }

  addEventListener(eventName: EventName, handler: Callback): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(handler);
  }

  removeEventListener(eventName: EventName, handler: Callback): void {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName)!.delete(handler);
    }
  }

  dispatchEvent(eventName: EventName, event: any): void {
    if (this.eventListeners.has(eventName)) {
      for (const handler of this.eventListeners.get(eventName)!) {
        handler(event);
      }
    }
  }

  getBounds(): Rect {
    const finalWidth = this.isScaleAffectedSize ? this.width * this.scaleX : this.width;
    const finalHeight = this.isScaleAffectedSize ? this.height * this.scaleY : this.height;

    return {
      x: this.x - finalWidth * this.anchorX,
      y: this.y - finalHeight * this.anchorY,
      width: finalWidth,
      height: finalHeight
    };
  }

  hitTest(x: number, y: number): boolean {
    const bounds = this.getBounds();
    return x >= bounds.x && x <= bounds.x + bounds.width &&
      y >= bounds.y && y <= bounds.y + bounds.height;
  }

  render(_matrix: Matrix): void {
    // Implement rendering logic here
  }

  destroy(): void {
    this.eventListeners.clear();
  }
}
