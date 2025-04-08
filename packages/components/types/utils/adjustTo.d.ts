import type { DisplayObject } from "@shuizhongyueming/tiny-ui-core";
export type HorizontalPosition = 'left' | 'center' | 'right';
export type VerticalPosition = 'top' | 'center' | 'bottom';
export interface OptionAdjust {
    h: HorizontalPosition;
    v: VerticalPosition;
}
type IAdjustTo = (checker: DisplayObject, willContain?: boolean) => (target: DisplayObject, adjust: Partial<OptionAdjust>, move?: {
    x?: number;
    y?: number;
}) => DisplayObject;
export declare const adjustTo: IAdjustTo;
export {};
