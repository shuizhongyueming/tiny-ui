import { DisplayObject } from "../DisplayObject";
import { EventName } from "../type";

export type StopType = 'stopPropagation' | 'stopImmediatePropagation';

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
  private _immediatePropagationStopped: boolean;
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
    this._immediatePropagationStopped = false;
    this._handled = false;
  }

  get identifier() {
    return this._identifier;
  }

  get propagationStopped() {
    return this._propagationStopped;
  }

  get immediatePropagationStopped() {
    return this._immediatePropagationStopped;
  }

  get handled() {
    return this._handled;
  }

  stopPropagation() {
    this._propagationStopped = true;
    this.originalEvent.stopPropagation();
  }

  stopImmediatePropagation() {
    this._immediatePropagationStopped = true;
    this.originalEvent.stopImmediatePropagation();
  }

  getStopTypes(): StopType[] {
    const stops: StopType[] = [];
    if (this._propagationStopped) {
      stops.push('stopPropagation');
    }
    if (this._immediatePropagationStopped) {
      stops.push('stopImmediatePropagation');
    }
    return stops;
  }

  markHandled() {
    this._handled = true;
  }
}
