import * as TinyUIComponents from './mod';

export default TinyUIComponents;

declare global {
  interface Window {
    TinyUIComponents: typeof TinyUIComponents;
  }
}
