import { describe, it, expect, beforeAll } from "vitest";
import { createCanvas, loadTinyUI } from "./setup";
import type TinyUI from "../../src/TinyUI";

/**
 * 像素纹理（createTextureFromPixels / updateTextureFromPixels / loadFromPixels）
 *
 * 这些 API 是给「动态内容纹理」用的：像素画、每次上色都要改内容的图层。
 * 关键约束：像素画必须 NEAREST；纹理所有权必须归 TextureManager，否则 destroy() 泄漏。
 */
describe("TextureManager 像素纹理", () => {
  beforeAll(async () => {
    await loadTinyUI();
  });

  function makeApp(width = 200, height = 200): TinyUI {
    const canvasId = createCanvas(width, height);
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const TinyUIClass = (window as any).TinyUI;
    return new TinyUIClass(canvas) as TinyUI;
  }

  function makeRgba(
    width: number,
    height: number,
    color: [number, number, number, number],
  ): Uint8Array {
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = color[0];
      data[i * 4 + 1] = color[1];
      data[i * 4 + 2] = color[2];
      data[i * 4 + 3] = color[3];
    }
    return data;
  }

  /** 在 safe section 内执行，返回结果 */
  function inGLTask<T>(app: TinyUI, fn: () => T): T {
    let result: T;
    app.enqueueGLTask(() => {
      result = fn();
    });
    app.render();
    return result!;
  }

  it("createTextureFromPixels 使用 NEAREST 且不生成 mipmap", () => {
    const app = makeApp();
    const gl = app.gl;
    const rgba = makeRgba(8, 8, [255, 0, 0, 255]);

    const texture = inGLTask(app, () =>
      app.textureManager.createTextureFromPixels(rgba, 8, 8, {
        filter: "nearest",
      }),
    );

    expect(texture).toBeTruthy();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER)).toBe(
      gl.NEAREST,
    );
    expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER)).toBe(
      gl.NEAREST,
    );
    expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S)).toBe(
      gl.CLAMP_TO_EDGE,
    );
    expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T)).toBe(
      gl.CLAMP_TO_EDGE,
    );
    expect(gl.getError()).toBe(0);

    app.destroy();
  });

  it("filter 默认 linear", () => {
    const app = makeApp();
    const gl = app.gl;
    const rgba = makeRgba(4, 4, [0, 255, 0, 255]);

    const texture = inGLTask(app, () =>
      app.textureManager.createTextureFromPixels(rgba, 4, 4),
    );

    gl.bindTexture(gl.TEXTURE_2D, texture);
    expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER)).toBe(
      gl.LINEAR,
    );
    expect(gl.getError()).toBe(0);

    app.destroy();
  });

  it("updateTextureFromPixels 支持整张与脏矩形更新", () => {
    const app = makeApp();
    const gl = app.gl;

    const texture = inGLTask(app, () =>
      app.textureManager.createTextureFromPixels(
        makeRgba(8, 8, [0, 0, 0, 255]),
        8,
        8,
        { filter: "nearest" },
      ),
    );

    // 整张更新
    inGLTask(app, () => {
      app.textureManager.updateTextureFromPixels(texture, makeRgba(8, 8, [10, 20, 30, 255]), {
        width: 8,
        height: 8,
      });
    });
    expect(gl.getError()).toBe(0);

    // 脏矩形更新（2x2）
    inGLTask(app, () => {
      app.textureManager.updateTextureFromPixels(
        texture,
        makeRgba(2, 2, [200, 100, 50, 255]),
        { x: 3, y: 3, width: 2, height: 2 },
      );
    });
    expect(gl.getError()).toBe(0);

    // 把纹理挂到 framebuffer 上读回。不能直接 readPixels：那是读默认帧缓冲。
    // 上传时行 0 在纹理底部，所以 readPixels 的 y=0 就是数据第 0 行。
    const pixels = inGLTask(app, () => {
      const data = new Uint8Array(8 * 8 * 4);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      return data;
    });
    expect(gl.getError()).toBe(0);

    const at = (x: number, y: number) => {
      const i = (y * 8 + x) * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2]];
    };
    expect(at(3, 3)).toEqual([200, 100, 50]);
    expect(at(4, 4)).toEqual([200, 100, 50]);
    expect(at(0, 0)).toEqual([10, 20, 30]);

    app.destroy();
  });

  it("像素数据长度不匹配时同步抛错（不能变成静默失败）", () => {
    const app = makeApp();

    expect(() => app.createBitmapFromPixels(new Uint8Array(4), 8, 8)).toThrowError(
      /长度不匹配/,
    );
    expect(() =>
      app.textureManager.createTextureFromPixels(new Uint8Array(4), 8, 8),
    ).toThrowError(/长度不匹配/);
    expect(() =>
      app.textureManager.createTextureFromPixels(new Uint8Array(4), 0, 8),
    ).toThrowError(/width 非法/);

    app.destroy();
  });

  it("Bitmap.loadFromPixels 自动设置尺寸并可增量更新", () => {
    const app = makeApp();
    const rgba = makeRgba(6, 5, [1, 2, 3, 255]);

    const bitmap = app.createBitmapFromPixels(rgba, 6, 5, {
      filter: "nearest",
    });
    app.root.addChild(bitmap);
    app.render();

    expect(bitmap.width).toBe(6);
    expect(bitmap.height).toBe(5);
    expect(bitmap.texture).toBeTruthy();

    bitmap.updateTextureFromPixels(makeRgba(1, 1, [9, 9, 9, 255]), {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    app.render();
    expect(app.gl.getError()).toBe(0);

    app.destroy();
  });

  it("destroy() 释放像素纹理并清空 GL 任务队列", () => {    const app = makeApp();
    const gl = app.gl;

    const bitmap = app.createBitmapFromPixels(
      makeRgba(4, 4, [255, 255, 0, 255]),
      4,
      4,
      { filter: "nearest" },
    );
    app.root.addChild(bitmap);
    app.render();

    const texture = bitmap.texture!;
    expect(gl.isTexture(texture)).toBe(true);

    app.destroy();

    expect(gl.isTexture(texture)).toBe(false);
    expect((app as any)._glTasks.length).toBe(0);
  });

  describe("边界与校验", () => {
    it("x/y 只给一半时同步抛错（不能静默退化成整张重定义）", () => {
      const app = makeApp();
      const rgba = makeRgba(4, 4, [1, 1, 1, 255]);

      expect(() =>
        app.createBitmapFromPixels(new Uint8Array(4), 1, 1, {
          filter: "nearest",
        }),
      ).not.toThrow();

      const bitmap = app.createBitmapFromPixels(rgba, 4, 4);
      app.root.addChild(bitmap);
      app.render();

      expect(() =>
        bitmap.updateTextureFromPixels(makeRgba(1, 1, [9, 9, 9, 255]), {
          width: 1,
          height: 1,
          x: 0,
        }),
      ).toThrowError(/x\/y 必须同时提供/);

      expect(() =>
        bitmap.updateTextureFromPixels(makeRgba(1, 1, [9, 9, 9, 255]), {
          width: 1,
          height: 1,
          y: 0,
        }),
      ).toThrowError(/x\/y 必须同时提供/);

      const texture = bitmap.texture!;
      /* manager 层的校验也是同步的，但不能再包进 inGLTask：
         enqueueGLTask 会吞掉任务内异常，那样测不出东西 */
      expect(() =>
        app.textureManager.updateTextureFromPixels(
          texture,
          makeRgba(1, 1, [9, 9, 9, 255]),
          { width: 1, height: 1, x: 0 },
        ),
      ).toThrowError(/x\/y 必须同时提供/);

      app.destroy();
    });

    it("x/y 同时给 0 时走 texSubImage2D", () => {
      const app = makeApp();
      const gl = app.gl;
      const bitmap = app.createBitmapFromPixels(makeRgba(4, 4, [1, 2, 3, 255]), 4, 4, {
        filter: "nearest",
      });
      app.root.addChild(bitmap);
      app.render();

      const calls = { sub: 0, image: 0 };
      const originSub = gl.texSubImage2D.bind(gl);
      const originImage = gl.texImage2D.bind(gl);
      (gl as any).texSubImage2D = (...args: any[]) => {
        calls.sub++;
        return originSub(...(args as any));
      };
      (gl as any).texImage2D = (...args: any[]) => {
        calls.image++;
        return originImage(...(args as any));
      };

      bitmap.updateTextureFromPixels(makeRgba(1, 1, [200, 0, 0, 255]), {
        width: 1,
        height: 1,
        x: 0,
        y: 0,
      });
      app.render();

      (gl as any).texSubImage2D = originSub;
      (gl as any).texImage2D = originImage;

      expect(calls.sub).toBe(1);
      expect(calls.image).toBe(0);
      expect(gl.getError()).toBe(0);

      app.destroy();
    });

    it("宽高必须是正整数，缓冲区长度必须精确匹配", () => {
      const app = makeApp();

      expect(() =>
        app.textureManager.createTextureFromPixels(new Uint8Array(16), NaN, 2),
      ).toThrowError(/width 非法/);
      expect(() =>
        app.textureManager.createTextureFromPixels(new Uint8Array(16), 2.5, 2),
      ).toThrowError(/width 非法/);
      expect(() =>
        app.textureManager.createTextureFromPixels(
          new Uint8Array(16),
          Infinity,
          2,
        ),
      ).toThrowError(/width 非法/);
      expect(() =>
        app.textureManager.createTextureFromPixels(new Uint8Array(16), 2, -1),
      ).toThrowError(/height 非法/);

      // 超长缓冲区也必须拒绝：文档写的是“正好”
      expect(() =>
        app.textureManager.createTextureFromPixels(new Uint8Array(17), 2, 2),
      ).toThrowError(/长度不匹配/);

      app.destroy();
    });

    it("脏矩形越界抛错", () => {
      const app = makeApp();
      const bitmap = app.createBitmapFromPixels(makeRgba(4, 4, [5, 5, 5, 255]), 4, 4);
      app.root.addChild(bitmap);
      app.render();

      expect(() =>
        bitmap.updateTextureFromPixels(makeRgba(2, 2, [1, 1, 1, 255]), {
          width: 2,
          height: 2,
          x: 3,
          y: 0,
        }),
      ).toThrowError(/超出纹理|脏矩形越界/);

      app.destroy();
    });

    it("脏矩形更新继承创建时的 premultiplyAlpha", () => {      const app = makeApp();
      const gl = app.gl;
      const bitmap = app.createBitmapFromPixels(makeRgba(4, 4, [1, 1, 1, 255]), 4, 4, {
        filter: "nearest",
        premultiplyAlpha: true,
      });
      app.root.addChild(bitmap);
      app.render();

      const observed: boolean[] = [];
      const originSub = gl.texSubImage2D.bind(gl);
      (gl as any).texSubImage2D = (...args: any[]) => {
        observed.push(
          gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean,
        );
        return originSub(...(args as any));
      };

      bitmap.updateTextureFromPixels(makeRgba(1, 1, [7, 7, 7, 128]), {
        width: 1,
        height: 1,
        x: 1,
        y: 1,
      });
      app.render();

      (gl as any).texSubImage2D = originSub;

      expect(observed).toEqual([true]);

      app.destroy();
    });

    it("canvas 纹理也登记元数据：alpha 继承与越界校验都生效", () => {
      const app = makeApp();
      const gl = app.gl;

      const canvas = document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 4;

      const texture = inGLTask(app, () =>
        app.textureManager.createCanvasTexture(canvas, true),
      );

      const info = app.textureManager.getTextureInfo(texture);
      expect(info).toEqual({
        width: 4,
        height: 4,
        premultiplyAlpha: true,
      });

      const observed: boolean[] = [];
      const originSub = gl.texSubImage2D.bind(gl);
      (gl as any).texSubImage2D = (...args: any[]) => {
        observed.push(
          gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean,
        );
        return originSub(...(args as any));
      };

      inGLTask(app, () => {
        app.textureManager.updateTextureFromPixels(
          texture,
          makeRgba(1, 1, [3, 3, 3, 255]),
          { x: 0, y: 0, width: 1, height: 1 },
        );
      });
      (gl as any).texSubImage2D = originSub;

      expect(observed).toEqual([true]);

      expect(() =>
        app.textureManager.updateTextureFromPixels(
          texture,
          makeRgba(2, 2, [1, 1, 1, 255]),
          { x: 3, y: 0, width: 2, height: 2 },
        ),
      ).toThrowError(/脏矩形越界/);

      app.destroy();
    });

    it("pixels → canvas 切换后用新尺寸校验，不再用旧尺寸", () => {
      const app = makeApp();

      const bitmap = app.createBitmapFromPixels(
        makeRgba(2, 2, [1, 1, 1, 255]),
        2,
        2,
      );
      app.root.addChild(bitmap);
      app.render();

      const small = document.createElement("canvas");
      small.width = 1;
      small.height = 1;
      bitmap.loadFromCanvas(small);
      app.render();

      const info = app.textureManager.getTextureInfo(bitmap.texture!);
      expect(info?.width).toBe(1);
      expect(info?.height).toBe(1);

      // 旧的 2×2 尺寸不再有效：1×1 纹理上放 2×2 脏矩形必须报错
      expect(() =>
        bitmap.updateTextureFromPixels(makeRgba(2, 2, [9, 9, 9, 255]), {
          x: 0,
          y: 0,
          width: 2,
          height: 2,
        }),
      ).toThrowError(/脏矩形越界/);

      app.destroy();
    });

    it("image 纹理的元数据用自然尺寸，不用显示尺寸", async () => {
      const app = makeApp();
      const gl = app.gl;

      const image = await app.textureManager.loadImage(
        "tests/fixtures/64x64-red.png",
      );
      expect(image.naturalWidth).toBe(64);

      // 把显示尺寸改成两倍，元数据仍必须是自然尺寸
      image.width = 128;
      image.height = 128;

      const texture = inGLTask(app, () =>
        app.textureManager.createImageTexture(image),
      );

      const info = app.textureManager.getTextureInfo(texture);
      expect(info?.width).toBe(64);
      expect(info?.height).toBe(64);

      // 真实纹理是 64×64，髞 (64,0) 必须同步报错，而不是留下 GL 1281
      expect(() =>
        app.textureManager.updateTextureFromPixels(
          texture,
          makeRgba(1, 1, [1, 1, 1, 255]),
          { x: 64, y: 0, width: 1, height: 1 },
        ),
      ).toThrowError(/脏矩形越界/);

      expect(gl.getError()).toBe(0);

      app.destroy();
    });

    it("非 manager 创建的纹理同步报错，不静默上传", () => {
      const app = makeApp();
      const gl = app.gl;
      const raw = gl.createTexture()!;

      expect(app.textureManager.getTextureInfo(raw)).toBeNull();
      expect(() =>
        app.textureManager.updateTextureFromPixels(
          raw,
          makeRgba(1, 1, [1, 1, 1, 255]),
          { width: 1, height: 1 },
        ),
      ).toThrowError(/只支持由 TextureManager 创建的纹理/);

      app.destroy();
    });
  });
});
