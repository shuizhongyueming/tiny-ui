import * as TinyUIComponents from './mod';

export = TinyUIComponents;

declare global {
  interface Window {
    TinyUIComponents: typeof TinyUIComponents;
  }
}
