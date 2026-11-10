import { describe, expect, it, vi } from "vitest";
import { TextureManager } from "../../src/utils/TextureManager";
import { Bitmap } from "../../src/Bitmap";
import TinyUI from "../../src/TinyUI";

function fixture() {
  const gl: any = {
    TEXTURE_2D: 1, TEXTURE_WRAP_S: 2, TEXTURE_WRAP_T: 3,
    TEXTURE_MIN_FILTER: 4, TEXTURE_MAG_FILTER: 5,
    CLAMP_TO_EDGE: 6, LINEAR: 7, NEAREST: 8,
    createTexture: vi.fn(() => ({})), bindTexture: vi.fn(),
    texImage2D: vi.fn(), texParameteri: vi.fn(), pixelStorei: vi.fn(),
    generateMipmap: vi.fn(), deleteTexture: vi.fn(),
  };
  const tasks: Array<() => void> = [];
  const app: any = { enqueueGLTask: (task: () => void) => tasks.push(task) };
  app.textureManager = new TextureManager(gl, app);
  const image = { src: "pixel.png", width: 8, height: 8 } as HTMLImageElement;
  return { gl, app, tasks, image };
}

describe("图像纹理采样", () => {
  it.each(["linear", "nearest"] as const)("MIN/MAG 使用显式 %s", filter => {
    const { gl, app, image } = fixture();
    app.textureManager.createImageTexture(image, { filter });
    const mode = filter === "nearest" ? gl.NEAREST : gl.LINEAR;
    expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mode);
    expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mode);
    expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  });

  it.each([7, 8])("边长 %s 的图像缺省与空选项保留旧采样", size => {
    for (const options of [undefined, {}]) {
      const { gl, app, image } = fixture();
      image.width = image.height = size;
      app.textureManager.createImageTexture(image, options);
      if (size === 8) {
        expect(gl.generateMipmap).toHaveBeenCalledWith(gl.TEXTURE_2D);
        expect(gl.texParameteri).not.toHaveBeenCalled();
      } else {
        expect(gl.generateMipmap).not.toHaveBeenCalled();
        expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    }
  });

  it("同一 URL 的缺省、linear、nearest 缓存互不命中", async () => {
    const { app, tasks, image } = fixture();
    const manager = app.textureManager;
    manager.loadImage = vi.fn(async () => image);
    const linear = manager.createImageTexture(image, { filter: "linear" });
    const nearest = manager.createImageTexture(image, { filter: "nearest" });
    const loading = manager.loadTexture(image.src);
    await Promise.resolve();
    tasks.splice(0).forEach(task => task());
    const legacy = await loading;
    expect(manager.loadImage).toHaveBeenCalledTimes(1);
    expect(legacy).not.toBe(linear);
    expect(legacy).not.toBe(nearest);
    expect(linear).not.toBe(nearest);
    manager.createImageTexture(image, { filter: "linear" });
    manager.createImageTexture(image, { filter: "nearest" });
    expect(await manager.loadTexture(image.src)).toBe(legacy);
    expect(manager.loadImage).toHaveBeenCalledTimes(1);
  });

  it("Bitmap 的 Image/URL 和工厂路径透传选项，并保留 resize=false", async () => {
    const { app, tasks, image } = fixture();
    const create = vi.spyOn(app.textureManager, "createImageTexture");
    app.textureManager.loadImage = vi.fn(async () => image);
    const bitmap = new Bitmap(app);
    bitmap.setSize(20, 30);
    bitmap.loadFromImage(image, false, { filter: "nearest" });
    tasks.splice(0).forEach(task => task());
    expect(bitmap.width).toBe(20);
    expect(create).toHaveBeenLastCalledWith(image, { filter: "nearest" });
    await bitmap.loadFromUrl("pixel.png", true, { filter: "nearest" });
    tasks.splice(0).forEach(task => task());
    expect(bitmap.width).toBe(8);
    expect(create).toHaveBeenLastCalledWith(image, { filter: "nearest" });
    TinyUI.prototype.createBitmapFromImage.call(app, image, { filter: "nearest" });
    await TinyUI.prototype.createBitmapFromUrl.call(app, "pixel.png", { filter: "nearest" });
    tasks.splice(0).forEach(task => task());
    expect(create).toHaveBeenLastCalledWith(image, { filter: "nearest" });
    bitmap.loadFromImage(image);
    tasks.splice(0).forEach(task => task());
    expect(create).toHaveBeenLastCalledWith(image, {});
  });
});
