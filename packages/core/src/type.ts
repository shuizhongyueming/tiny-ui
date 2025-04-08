import { DisplayObject } from "./DisplayObject";

export type Callback<P = unknown, R extends unknown[] = unknown[]> = (param?: P, ...rest: R) => void;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Size = Pick<Rect, 'width' | 'height'>;

export enum EventName {
  TouchMove = 'touchmove',
  TouchStart = 'touchstart',
  TouchEnd = 'touchend',
}

export interface Color { r: number, g: number, b: number, a: number }

export interface UIEvent {
  type: EventName;
  x: number;
  y: number;
  originalEvent: Event;
  target: null | DisplayObject;
  stopPropagation: boolean;
}
