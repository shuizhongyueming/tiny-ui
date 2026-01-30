export * from "./Bitmap";
export * from "./Text";
export * from "./Container";
export * from "./DisplayObject";
export * from "./Graphics";
export * from "./type";
export * from "./utils/EventManager";
export * from "./utils/Matrix";
export * from "./utils/ShaderManager";
export * from "./utils/TextureManager";
export * from "./utils/UIEvent";

import TinyUI from "./TinyUI";
export { TinyUI };

export default TinyUI;

declare global {
  interface Window {
    TinyUI: TinyUI;
  }
}
