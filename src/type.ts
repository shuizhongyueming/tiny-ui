export type Callback = (...args: any[]) => void;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum EventName {
  TouchMove = 'touchmove',
  TouchStart = 'touchstart',
  TouchEnd = 'touchend',
}

export interface Color { r: number, g: number, b: number, a: number }
