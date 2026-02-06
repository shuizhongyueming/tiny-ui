import type TinyUI from "../TinyUI";
import { Deferred } from "./Deferred";

export class TextureManager {
  private gl: WebGLRenderingContext;
  private app: TinyUI;
  private textures: Map<string, WebGLTexture> = new Map();
  private textureCache: Map<string, WebGLTexture> = new Map();
  private inflight: Map<string, Deferred<WebGLTexture>> = new Map();

  constructor(gl: WebGLRenderingContext, app: TinyUI) {
    this.gl = gl;
    this.app = app;
  }

  // 创建纹理
  createTexture(): WebGLTexture {
    const gl = this.gl;

    const texture = gl.createTexture();

    // 使用默认白色像素初始化纹理
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]) // 白色
    );

    return texture;
  }

  // 从图像设置纹理
  // 注意：此函数必须在 TinyUI 的 safe section 内调用（即 GLState.snapshot 和 restore 之间）
  // pixelStorei 状态的恢复由 GLState.restore() 统一处理，不需要每张图单独恢复
  setTextureFromImage(texture: WebGLTexture, image: HTMLImageElement | HTMLCanvasElement, premultiplyAlpha: boolean = false): void {
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // 设置需要的 pixelStorei 值（恢复由 GLState.restore() 统一处理）
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);

    // 将图像数据上传到纹理
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image,
    );

    // 检查图像尺寸是否为2的幂
    const isPowerOf2 = (value: number) => (value & (value - 1)) === 0;
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // 为2的幂的纹理可以使用 mipmap
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // 非2的幂纹理需要设置为 CLAMP 并禁用 mipmap
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }

  loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous'; // 允许跨域图像

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };

      image.src = url;
    });
  }

  // 加载纹理（deferred upload，在 safe section 内完成 GL 上传）
  async loadTexture(url: string): Promise<WebGLTexture> {
    // 1. 检查缓存
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }

    // 2. 检查 inflight（合并并发请求）
    const existing = this.inflight.get(url);
    if (existing) {
      return existing.promise;
    }

    // 3. 创建 Deferred
    const deferred = new Deferred<WebGLTexture>();
    this.inflight.set(url, deferred);

    // 4. 加载图片（不触碰 GL）
    try {
      const image = await this.loadImage(url);

      // 5. 在 safe section 内上传
      this.app.enqueueGLTask(() => {
        try {
          const texture = this.createImageTexture(image);
          deferred.resolve(texture);
        } catch (err) {
          deferred.reject(err instanceof Error ? err : new Error(String(err)));
        } finally {
          this.inflight.delete(url);
        }
      });
    } catch (err) {
      deferred.reject(err instanceof Error ? err : new Error(String(err)));
      this.inflight.delete(url);
    }

    return deferred.promise;
  }

  // 创建图像纹理（必须在 safe section 内调用）
  createImageTexture(image: HTMLImageElement): WebGLTexture {
    const texture = this.createTexture();
    const url = image.src;
    this.setTextureFromImage(texture, image);

    // 添加到缓存
    this.textureCache.set(url, texture);
    this.textures.set(url, texture);

    return texture;
  }

  // 创建Canvas纹理（必须在 safe section 内调用）
  createCanvasTexture(canvas: HTMLCanvasElement, premultiplyAlpha = false): WebGLTexture {
    const texture = this.createTexture();

    this.setTextureFromImage(texture, canvas, premultiplyAlpha);

    // 添加到纹理列表 (但不缓存)
    this.textures.set(`canvas-${Date.now()}`, texture);

    return texture;
  }

  // 删除纹理（必须在 safe section 内调用）
  deleteTexture(texture: WebGLTexture): void {
    const gl = this.gl;

    // 从纹理列表中删除
    for (const [key, value] of this.textures.entries()) {
      if (value === texture) {
        this.textures.delete(key);

        // 同时从缓存中删除
        this.textureCache.delete(key);
        break;
      }
    }

    gl.deleteTexture(texture);
  }

  // 销毁所有纹理（必须在 safe section 内调用）
  destroy(): void {
    const gl = this.gl;

    // Reject all inflight texture loads
    for (const [url, deferred] of this.inflight.entries()) {
      deferred.reject(new Error(`TextureManager destroyed while loading texture: ${url}`));
    }
    this.inflight.clear();

    // 删除所有纹理
    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture);
    }

    this.textures.clear();
    this.textureCache.clear();
  }
}
