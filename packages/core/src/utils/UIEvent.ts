import { DisplayObject } from "../DisplayObject";
import { EventName } from "../type";

interface UIEventInit {
  type: EventName;
  originalEvent: Event;
  x: number;
  y: number;
  target: null | DisplayObject;
}

let customIdentifier = 0;
const getCustomIdentifier = () => customIdentifier++;

export class UIEvent {
  type: EventName;
  originalEvent: Event;
  x: number;
  y: number;
  target: null | DisplayObject;

  private _propagationStopped: boolean;
  private _handled: boolean;
  private _identifier: number;

  constructor({ type, originalEvent, x, y, target }: UIEventInit) {
    this.type = type;
    this.originalEvent = originalEvent;
    this.x = x;
    this.y = y;
    this.target = target;

    if (this.originalEvent instanceof TouchEvent) {
      this._identifier = this.originalEvent.changedTouches[0].identifier;
    } else {
      this._identifier = getCustomIdentifier();
    }

    this._propagationStopped = false;
    this._handled = false;
  }

  get identifier() {
    return this._identifier;
  }

  get propagationStopped() {
    return this._propagationStopped;
  }

  get handled() {
    return this._handled;
  }

  stopPropagation() {
    this._propagationStopped = true;
    this.originalEvent.stopPropagation();
  }

  markHandled() {
    this._handled = true;
  }
}
