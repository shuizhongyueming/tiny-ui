import type TinyUI from "../TinyUI";
import { Deferred } from "./Deferred";

/** 像素纹理的采样参数。像素画必须用 "nearest"，否则缩放会糊。 */
export interface PixelTextureOptions {
  filter?: "linear" | "nearest";
  /** 上传前是否预乘 alpha。默认 false。 */
  premultiplyAlpha?: boolean;
}

/**
 * 像素上传的目标区域。
 *
 * 不传 `x`/`y` 时整张重新定义（texImage2D）；
 * 传了则只更新该子矩形（texSubImage2D），`rgba` 必须正好是 `width * height * 4` 字节。
 */
export interface PixelTextureUpdate {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

/**
 * 校验像素缓冲区与尺寸是否匹配。
 *
 * 独立导出，供上层（如 Bitmap）在**排队前**同步校验：
 * `enqueueGLTask` 会吞掉任务内的异常，只在队列里检查会变成静默失败。
 */
export function assertPixelBuffer(
  rgba: Uint8Array,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) {
    throw new Error(
      `[TinyUI] 像素纹理尺寸非法: ${width}x${height}。宽高必须是正整数。`,
    );
  }
  const expected = width * height * 4;
  if (rgba.length < expected) {
    throw new Error(
      `[TinyUI] 像素数据不足: ${width}x${height} 需要 ${expected} 字节，实际 ${rgba.length}。检查 RGBA 长度与宽高是否匹配。`,
    );
  }
}

export class TextureManager {
  private gl: WebGLRenderingContext;
  private app: TinyUI;
  private textures: Map<string, WebGLTexture> = new Map();
  private textureCache: Map<string, WebGLTexture> = new Map();
  private inflight: Map<string, Deferred<WebGLTexture>> = new Map();
  private pixelTextureSeq: number = 0;

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

  /**
   * 用像素数组创建纹理（必须在 safe section 内调用）。
   *
   * 与 `createTexture()` 的区别：显式设置采样/环绕参数并上传真实数据，
   * 且纹理登记到本 manager，`destroy()` 时会统一释放。
   *
   * 用途：像素画、动态画布、每次上色都要改内容的图层。
   */
  createTextureFromPixels(
    rgba: Uint8Array,
    width: number,
    height: number,
    options: PixelTextureOptions = {},
  ): WebGLTexture {
    this.assertPixelBuffer(rgba, width, height);

    const gl = this.gl;
    const texture = this.createTexture();

    this.applyPixelTextureParams(texture, options.filter ?? "linear");
    this.applyPixelUploadState(options.premultiplyAlpha ?? false);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgba,
    );

    this.pixelTextureSeq++;
    this.textures.set(`pixels-${this.pixelTextureSeq}`, texture);

    return texture;
  }

  /**
   * 更新已存在的纹理内容（必须在 safe section 内调用）。
   *
   * 不传 `x`/`y`：整张重新定义，适合尺寸不变但内容整体重画的场景。
   * 传了 `x`/`y`：只上传该子矩形，适合脏矩形增量更新。
   */
  updateTextureFromPixels(
    texture: WebGLTexture,
    rgba: Uint8Array,
    update: PixelTextureUpdate,
  ): void {
    const { width, height, x, y } = update;
    this.assertPixelBuffer(rgba, width, height);

    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.applyPixelUploadState(false);

    if (x === undefined || y === undefined) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        rgba,
      );
      return;
    }

    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      x,
      y,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgba,
    );
  }

  // 设置采样参数：不生成 mipmap，避免非 2 的幂尺寸下采样不完整
  private applyPixelTextureParams(
    texture: WebGLTexture,
    filter: "linear" | "nearest",
  ): void {
    const gl = this.gl;
    const mode = filter === "nearest" ? gl.NEAREST : gl.LINEAR;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mode);
  }

  // 上传前的 pixelStorei。恢复由 GLState.restore() 统一处理
  private applyPixelUploadState(premultiplyAlpha: boolean): void {
    const gl = this.gl;

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
  }

  private assertPixelBuffer(
    rgba: Uint8Array,
    width: number,
    height: number,
  ): void {
    assertPixelBuffer(rgba, width, height);
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
    this.pixelTextureSeq = 0;
  }
}
