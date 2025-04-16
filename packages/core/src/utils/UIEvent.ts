import { DisplayObject } from "../DisplayObject";
import { EventName } from "../type";

interface UIEventInit {
  type: EventName;
  originalEvent: Event;
  x: number;
  y: number;
  target: null | DisplayObject;
}

export class UIEvent {
  type: EventName;
  originalEvent: Event;
  x: number;
  y: number;
  target: null | DisplayObject;

  private _propagationStopped: boolean;

  constructor({ type, originalEvent, x, y, target }: UIEventInit) {
    this.type = type;
    this.originalEvent = originalEvent;
    this.x = x;
    this.y = y;
    this.target = target;
  }

  get propagationStopped() {
    return this._propagationStopped;
  }

  stopPropagation() {
    this._propagationStopped = true;
    this.originalEvent.stopPropagation();
  }
}
