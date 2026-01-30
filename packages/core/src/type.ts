import { DisplayObject } from "./DisplayObject";

export type Callback<P = unknown, R extends unknown[] = unknown[]> = (param?: P, ...rest: R) => void;

export interface Point { x: number, y: number };

export interface Size { width: number, height: number };

export type Rect = Point & Size;

export enum EventName {
  TouchMove = 'touchmove',
  TouchStart = 'touchstart',
  TouchEnd = 'touchend',
  MouseMove = 'mousemove',
  MouseDown = 'mousedown',
  MouseUp = 'mouseup',
}

export interface Color { r: number, g: number, b: number, a: number }
