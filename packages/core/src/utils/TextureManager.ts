import type TinyUI from "../TinyUI";
import { Deferred } from "./Deferred";

export interface ImageTextureOptions {
  filter?: "linear" | "nearest";
}

/** 像素纹理的采样参数。像素画必须用 "nearest"，否则缩放会糊。 */
export interface PixelTextureOptions {
  filter?: "linear" | "nearest";
  /** 上传前是否预乘 alpha。默认 false。 */
  premultiplyAlpha?: boolean;
}

/**
 * 像素上传的目标区域。
 *
 * `x`/`y` 必须**成对**出现：
 * - 两个都不传：整张重新定义（texImage2D）
 * - 两个都传：只更新该子矩形（texSubImage2D）
 * - 只传一个：直接抛错。否则会静默退化成整张重定义，把纹理尺寸改错。
 *
 * `rgba` 长度必须**正好**是 `width * height * 4` 字节。
 */
/** 由 TextureManager 创建的纹理的元数据 */
export interface TextureInfo {
  width: number;
  height: number;
  premultiplyAlpha: boolean;
}

export interface PixelTextureUpdate {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `[TinyUI] 像素纹理 ${name} 非法: ${String(value)}。必须是正整数。`,
    );
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `[TinyUI] 像素纹理 ${name} 非法: ${String(value)}。必须是非负整数。`,
    );
  }
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
  assertPositiveInteger(width, "width");
  assertPositiveInteger(height, "height");

  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(
      `[TinyUI] 像素数据长度不匹配: ${width}x${height} 必须正好 ${expected} 字节，实际 ${rgba.length}。`,
    );
  }
}

/**
 * 校验更新区域：`x`/`y` 必须成对出现，且为非负整数。
 *
 * 同样独立导出，供上层在入队前同步校验。
 */
export function assertPixelUpdate(update: PixelTextureUpdate): void {
  const hasX = update.x !== undefined;
  const hasY = update.y !== undefined;

  if (hasX !== hasY) {
    throw new Error(
      "[TinyUI] updateTextureFromPixels 的 x/y 必须同时提供或同时省略：只给一半会被当成整张重定义。",
    );
  }

  if (hasX) {
    assertNonNegativeInteger(update.x as number, "x");
    assertNonNegativeInteger(update.y as number, "y");
  }
}

export class TextureManager {
  private gl: WebGLRenderingContext;
  private app: TinyUI;
  private textures: Map<string, WebGLTexture> = new Map();
  private textureCache: Map<string, WebGLTexture> = new Map();
  private inflight: Map<string, Deferred<WebGLTexture>> = new Map();
  private pixelTextureSeq: number = 0;
  /**
   * 本 manager 创建的每条纹理的尺寸与上传口径。
   *
   * 用途：`updateTextureFromPixels` 需要知道目标纹理多大才能校验脏矩形范围，
   * 也需要知道创建时的 `premultiplyAlpha` 才能保证前后口径一致。
   * 不由 manager 创建的纹理没有这条元数据，更新时会同步报错而不是静默按默认值处理。
   */
  private textureInfo: Map<WebGLTexture, TextureInfo> = new Map();

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
    this.textureInfo.set(texture, {
      width,
      height,
      premultiplyAlpha: options.premultiplyAlpha ?? false,
    });

    return texture;
  }

  /**
   * 更新已存在的纹理内容（必须在 safe section 内调用）。
   *
   * 适用于**任何由本 manager 创建的纹理**（pixels / image / canvas），
   * 因为只有它们登记了尺寸与 alpha 口径。外部自建的 `gl.createTexture()` 没有元数据，
   * 直接抛错而不是按默认值静默上传。
   *
   * - 不传 `x`/`y`：整张重新定义，适合尺寸不变但内容整体重画的场景。
   * - 两个都传：只上传该子矩形，适合脏矩形增量更新。
   * - 只传一个：抛错（否则会静默退化成整张重定义，把纹理尺寸改错）。
   *
   * alpha 上传口径继承创建时的 `premultiplyAlpha`。
   */
  updateTextureFromPixels(
    texture: WebGLTexture,
    rgba: Uint8Array,
    update: PixelTextureUpdate,
  ): void {
    const { width, height, x, y } = update;

    assertPixelUpdate(update);
    this.assertPixelBuffer(rgba, width, height);

    const info = this.textureInfo.get(texture);
    if (!info) {
      throw new Error(
        "[TinyUI] updateTextureFromPixels 只支持由 TextureManager 创建的纹理：缺少尺寸与 alpha 元数据。" +
          "请改用 createTextureFromPixels / createImageTexture / createCanvasTexture。",
      );
    }

    const hasX = x !== undefined;

    if (hasX) {
      this.assertSubRectInBounds(update, info);
    }

    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.applyPixelUploadState(info.premultiplyAlpha);

    if (!hasX) {
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

      /* 整张重定义后尺寸变了，同步记录，否则后续脏矩形的越界校验会用到旧尺寸 */
      info.width = width;
      info.height = height;
      return;
    }

    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      x as number,
      y as number,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgba,
    );
  }

  /** 读取纹理元数据。不是本 manager 创建的纹理返回 null。 */
  getTextureInfo(texture: WebGLTexture): TextureInfo | null {
    return this.textureInfo.get(texture) ?? null;
  }

  /** 校验脏矩形是否越界（同步可用，不碰 GL） */
  assertSubRectInBounds(update: PixelTextureUpdate, info: TextureInfo): void {
    const { width, height, x, y } = update;
    if (x === undefined || y === undefined) return;
    if (x + width > info.width || y + height > info.height) {
      throw new Error(
        `[TinyUI] 脏矩形越界: (${x},${y}) ${width}x${height} 超出纹理 ${info.width}x${info.height}。`,
      );
    }
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
    const cacheKey = `${url}|default`;
    // 1. 检查缓存
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
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
  createImageTexture(image: HTMLImageElement, options: ImageTextureOptions = {}): WebGLTexture {
    const texture = this.createTexture();
    const url = `${image.src}|${options.filter ?? "default"}`;
    this.setTextureFromImage(texture, image);
    // 未指定 filter 时保留旧路径：POT 使用 mipmap，NPOT 使用 LINEAR。
    if (options.filter !== undefined) {
      this.applyPixelTextureParams(texture, options.filter);
    }

    // 添加到缓存
    this.textureCache.set(url, texture);
    this.textures.set(url, texture);
    /* 上传的是图片的自然像素，必须用 naturalWidth/Height。
       image.width/height 是显示尺寸，被 CSS 或属性改过时会与纹理真实尺寸不一致，
       拿它做越界校验会出现「校验通过、GL 报 INVALID_VALUE」。 */
    this.textureInfo.set(texture, {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      premultiplyAlpha: false,
    });

    return texture;
  }

  // 创建Canvas纹理（必须在 safe section 内调用）
  createCanvasTexture(canvas: HTMLCanvasElement, premultiplyAlpha = false): WebGLTexture {
    const texture = this.createTexture();

    this.setTextureFromImage(texture, canvas, premultiplyAlpha);

    // 添加到纹理列表 (但不缓存)
    this.textures.set(`canvas-${Date.now()}`, texture);
    this.textureInfo.set(texture, {
      width: canvas.width,
      height: canvas.height,
      premultiplyAlpha,
    });

    return texture;
  }

  // 删除纹理（必须在 safe section 内调用）
  deleteTexture(texture: WebGLTexture): void {
    const gl = this.gl;

    this.textureInfo.delete(texture);

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
    this.textureInfo.clear();
    this.pixelTextureSeq = 0;
  }
}
