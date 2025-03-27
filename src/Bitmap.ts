import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";

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

  render(_matrix: Matrix): void {
    if (!this.texture) return;

    const gl = this.app.gl;

    // 顶点位置 (矩形)
    const positions = [
      0, 0,
      this.width, 0,
      this.width, this.height,
      0, this.height,
    ];

    // 纹理坐标 (矩形)
    const texCoords = [
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ];

    // 顶点颜色 (应用透明度)
    const colors = [
      1, 1, 1, this.alpha,
      1, 1, 1, this.alpha,
      1, 1, 1, this.alpha,
      1, 1, 1, this.alpha,
    ];

    // 索引 (两个三角形)
    const indices = [0, 1, 2, 0, 2, 3];

    // 使用纹理
    gl.uniform1i(this.app._useTextureLocation, 1);

    // 绑定纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.app._imageLocation, 0);

    // 设置缓冲区数据
    this.app._setBufferData(positions, texCoords, colors, indices);

    // 绘制
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
}
