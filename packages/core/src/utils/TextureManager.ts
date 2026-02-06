export class TextureManager {
  private gl: WebGLRenderingContext;
  private textures: Map<string, WebGLTexture> = new Map();
  private textureCache: Map<string, WebGLTexture> = new Map();

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  // 创建纹理
  createTexture(): WebGLTexture {
    const gl = this.gl;

    const prevActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    const prevBinding = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;

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

    // Restore bindings to avoid polluting shared GL state.
    gl.bindTexture(gl.TEXTURE_2D, prevBinding);
    gl.activeTexture(prevActiveTexture);

    return texture;
  }

  // 从图像设置纹理
  setTextureFromImage(texture: WebGLTexture, image: HTMLImageElement | HTMLCanvasElement, premultiplyAlpha: boolean = false): void {
    const gl = this.gl;

    const prevPremultiplyAlpha = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean;
    const prevUnpackAlignment = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
    const prevFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) as boolean;
    const prevColorSpace = gl.getParameter(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL) as number;

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Use WebGL built-in premultiply alpha (restore previous state afterwards).
    if (prevPremultiplyAlpha !== premultiplyAlpha) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
    }

    // Keep uploads predictable; restore afterwards.
    if (prevUnpackAlignment !== 4) {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    }
    if (prevFlipY !== false) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    if (prevColorSpace !== gl.BROWSER_DEFAULT_WEBGL) {
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    }

    try {
      // 将图像数据上传到纹理
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
    } finally {
      if (prevPremultiplyAlpha !== premultiplyAlpha) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, prevPremultiplyAlpha);
      }
      if (prevUnpackAlignment !== 4) {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, prevUnpackAlignment);
      }
      if (prevFlipY !== false) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, prevFlipY);
      }
      if (prevColorSpace !== gl.BROWSER_DEFAULT_WEBGL) {
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, prevColorSpace);
      }
    }

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

    // 恢复默认值
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.bindTexture(gl.TEXTURE_2D, null);
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

  // 加载纹理
  async loadTexture(url: string): Promise<WebGLTexture> {
    // 检查缓存
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }

    const img = await this.loadImage(url);

    return this.createImageTexture(img)
  }
  createImageTexture(image: HTMLImageElement): WebGLTexture {
    const texture = this.createTexture();
    const url = image.src;
    this.setTextureFromImage(texture, image);


    // 添加到缓存
    this.textureCache.set(url, texture);
    this.textures.set(url, texture);

    return texture;
  }

  // 创建Canvas纹理
  createCanvasTexture(canvas: HTMLCanvasElement, premultiplyAlpha = false): WebGLTexture {
    const texture = this.createTexture();

    this.setTextureFromImage(texture, canvas, premultiplyAlpha);

    // 添加到纹理列表 (但不缓存)
    this.textures.set(`canvas-${Date.now()}`, texture);

    return texture;
  }

  // 删除纹理
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

  // 销毁所有纹理
  destroy(): void {
    const gl = this.gl;

    // 删除所有纹理
    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture);
    }

    this.textures.clear();
    this.textureCache.clear();
  }
}
