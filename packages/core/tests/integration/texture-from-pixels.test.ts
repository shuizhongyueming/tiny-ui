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

  it("像素数据不足时同步抛错（不能变成静默失败）", () => {
    const app = makeApp();

    expect(() => app.createBitmapFromPixels(new Uint8Array(4), 8, 8)).toThrowError(
      /像素数据不足/,
    );
    expect(() =>
      app.textureManager.createTextureFromPixels(new Uint8Array(4), 8, 8),
    ).toThrowError(/像素数据不足/);
    expect(() =>
      app.textureManager.createTextureFromPixels(new Uint8Array(4), 0, 8),
    ).toThrowError(/尺寸非法/);

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

  it("destroy() 释放像素纹理并清空 GL 任务队列", () => {
    const app = makeApp();
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
});
