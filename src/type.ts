export type Callback = (...args: any[]) => void;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum EventName {
  Click = 'click',
  TouchMove = 'touchmove',
  TouchStart = 'touchstart',
  TouchEnd = 'touchend',
}
