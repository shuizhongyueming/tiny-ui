
export * from './Bitmap';
export * from './Text';
export * from './Container';
export * from './DisplayObject';
export * from './Graphics';
export * from './type';
export * from './utils/EventManager';
export * from './utils/Matrix';
export * from './utils/ShaderManager';
export * from './utils/TextureManager';
export * from './utils/UIEvent';
export * from './utils/GLStateMinimal';
export type { StatePreservationStrategy } from './utils/GLStateMinimal';
export * from './utils/GLStateTracker';
export * from './utils/UniformStateTracker';

import TinyUI from './TinyUI';
export { TinyUI };

export default TinyUI;

declare global {
  interface Window {
    TinyUI: TinyUI;
  }
}
