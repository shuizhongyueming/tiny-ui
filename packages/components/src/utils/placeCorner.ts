import { type DisplayObject } from "@shuizhongyueming/tiny-ui-core";
import { adjustTo, type HorizontalPosition, type VerticalPosition } from "./adjustTo";

export type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface PlaceCornerProps {
  boundNode: DisplayObject;
  cornerNode: DisplayObject;
  position: CornerPosition;
  willContain?: boolean
}

export const placeCorner = ({ boundNode, cornerNode, position, willContain = true }: PlaceCornerProps) => {
  const [v, h] = position.split('-') as [VerticalPosition, HorizontalPosition];
  adjustTo(boundNode, willContain)(cornerNode, { v, h });
}
