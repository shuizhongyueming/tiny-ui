import { beforeAll, describe, expect, it, vi } from "vitest";
import { createCanvas, loadTinyUI } from "./setup";

describe("Bitmap 图像采样", () => {
  beforeAll(async () => { await loadTinyUI(); });

  for (const size of [7, 8]) {
    for (const filter of [undefined, "linear", "nearest"] as const) {
      it(`${size}×${size} 的 URL/Image 使用 ${filter ?? "缺省"} 采样`, async () => {
        const canvas = document.getElementById(createCanvas(100, 100)) as HTMLCanvasElement;
        const app = new (window as any).TinyUI(canvas);
        try {
          const source = document.createElement("canvas"); source.width = source.height = size;
          source.getContext("2d")!.fillRect(0, 0, size, size);
          const image = new Image(); image.src = source.toDataURL(); await image.decode();
          const gl = app.gl;
          const parameters = vi.spyOn(gl, "texParameteri");
          const options = filter === undefined ? undefined : { filter };
          const fromImage = app.createBitmapFromImage(image, options);
          const fromUrl = await app.createBitmapFromUrl(image.src, options);
          const emptyOptions = app.createBitmapFromImage(image, {});
          app.render();
          // 9986 是 WebGL 规范默认值 NEAREST_MIPMAP_LINEAR，不是我们设置的。
          const defaultMin = size === 8 ? 9986 : 9729;
          const min = filter === undefined ? defaultMin : filter === "nearest" ? 9728 : 9729;
          const mag = filter === "nearest" ? 9728 : 9729;
          for (const bitmap of [fromImage, fromUrl, emptyOptions]) {
            gl.bindTexture(gl.TEXTURE_2D, bitmap.texture);
            const actualMin = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER);
            const actualMag = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER);
            expect(actualMin).toBe(bitmap === emptyOptions ? defaultMin : min);
            expect(actualMag).toBe(bitmap === emptyOptions ? 9729 : mag);
          }
          if (size === 8 && filter === undefined) {
            expect(parameters).not.toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, expect.anything());
            expect(parameters).not.toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, expect.anything());
          }
          console.info(`实测 ${size}×${size} ${filter ?? "缺省"}: MIN=${min}, MAG=${mag}，URL/Image 均通过`);
          expect(gl.getError()).toBe(gl.NO_ERROR);
          fromImage.destroy(); fromUrl.destroy(); emptyOptions.destroy(); app.render();
        } finally { app.destroy(); canvas.remove(); }
      });
    }
  }
});
