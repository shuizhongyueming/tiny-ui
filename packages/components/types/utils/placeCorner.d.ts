import { type DisplayObject } from "@shuizhongyueming/tiny-ui-core";
export type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
interface PlaceCornerProps {
    boundNode: DisplayObject;
    cornerNode: DisplayObject;
    position: CornerPosition;
    willContain?: boolean;
}
export declare const placeCorner: ({ boundNode, cornerNode, position, willContain }: PlaceCornerProps) => void;
export {};
