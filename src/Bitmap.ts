import { DisplayObject } from "./DisplayObject";
import { type TinyUI } from "./TinyUI";

export class Bitmap extends DisplayObject {
  src: string = '';
  texture: WebGLTexture | null = null;
  imgLoadPromise: Promise<Bitmap> | null = null;

  constructor(app: TinyUI, name: string = 'Bitmap') {
    super(app, name);
  }

  loadImage(url: string | HTMLImageElement): Promise<Bitmap> {
    if (typeof url === 'string') {
      this.src = url;
      this.imgLoadPromise = this.app.textureManager.loadTexture(url).then(texture => {
        this.texture = texture;
        return this;
      });
      return this.imgLoadPromise;
    } else {
      this.texture = this.app.textureManager.createImageTexture(url);
      return Promise.resolve(this);
    }
  }

  override destroy(): void {
    super.destroy();

    // 释放纹理
    if (this.texture) {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') as WebGLRenderingContext;
      gl.deleteTexture(this.texture);
      this.texture = null;
    }
  }
}
