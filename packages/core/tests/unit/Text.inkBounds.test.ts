// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Text } from "../../src/Text";
import type TinyUI from "../../src/TinyUI";

const makeText = (value = "Hello") => {
  const app = { enqueueGLTask: () => {}, textureManager: {}, gl: {} } as unknown as TinyUI;
  const text = new Text(app);
  text.fontSize = 32;
  text.text = value;
  return text;
};

describe("Text.inkBounds", () => {
  it("does not draw and invalidates on dirty, empty and destroyed text", () => {
    const text = makeText();
    const draw = vi.spyOn(text, "updateTexture");
    expect(text.inkBounds).toBeNull();
    expect(draw).not.toHaveBeenCalled();
    text.updateTexture();
    expect(text.inkBounds?.width).toBeGreaterThan(0);
    text.fontSize = 40;
    expect(text.inkBounds).toBeNull();
    text.updateTexture();
    expect(text.inkBounds?.width).toBeGreaterThan(0);
    text.text = "";
    text.updateTexture();
    expect(text.inkBounds).toBeNull();
    text.destroy();
    expect(text.inkBounds).toBeNull();
  });

  it("scans the complete alpha rectangle once per canvas version", () => {
    const text = makeText();
    text.updateTexture();
    const canvas = (text as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    pixels.data[(3 * canvas.width + 7) * 4 + 3] = 9;
    pixels.data[(18 * canvas.width + 30) * 4 + 3] = 255;
    pixels.data[3] = 8;
    ctx.putImageData(pixels, 0, 0);
    const read = vi.spyOn(ctx, "getImageData");
    const bounds = text.inkBounds;
    /* 返回的是**节点盒**坐标：渲染时 UV 取 width / textureWidth，
       所以纹素偏移必须乘这个系数，而不是纹素本身。 */
    expect(canvas.width).not.toBe(text.width);
    expect(bounds).toEqual({
      x: 7 * (text.width / canvas.width),
      y: 3 * (text.height / canvas.height),
      width: 24 * (text.width / canvas.width),
      height: 16 * (text.height / canvas.height),
    });
    expect(Object.isFrozen(bounds)).toBe(true);
    expect(text.inkBounds).toBe(bounds);
    expect(read).toHaveBeenCalledTimes(1);
    text.color = "red";
    text.updateTexture();
    expect(text.inkBounds).not.toBe(bounds);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("maps texels onto the node box, not onto the power-of-two texture", () => {
    const text = makeText("Coins");
    text.updateTexture();
    const canvas = (text as any).canvas as HTMLCanvasElement;
    const scaleX = text.width / canvas.width;
    const scaleY = text.height / canvas.height;
    /* 非 2 的幂：只有这时纹素坐标与节点坐标才会明显不同。 */
    expect(text.width).not.toBe(canvas.width);
    expect(text.height).not.toBe(canvas.height);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    const put = (x: number, y: number) => { pixels.data[(y * canvas.width + x) * 4 + 3] = 255; };
    put(0, 0);
    put(canvas.width - 1, canvas.height - 1);
    ctx.putImageData(pixels, 0, 0);
    const bounds = text.inkBounds!;
    expect(bounds.x).toBeCloseTo(0);
    expect(bounds.y).toBeCloseTo(0);
    expect(bounds.width).toBeCloseTo(canvas.width * scaleX, 6);
    expect(bounds.height).toBeCloseTo(canvas.height * scaleY, 6);
    /* 墨迹铺满整块纹理时，节点盒内的右/下边界不能超过 width / height。 */
    expect(bounds.x + bounds.width).toBeCloseTo(text.width, 6);
    expect(bounds.y + bounds.height).toBeCloseTo(text.height, 6);
  });

  it("includes stroke and BBCode background pixels including padding", () => {
    const text = makeText("W");
    text.updateTexture();
    const plain = text.inkBounds!;
    text.borderWidth = 12;
    text.updateTexture();
    expect(text.inkBounds!.width).toBeGreaterThan(plain.width);
    text.bbcodeEnabled = true;
    text.text = "[background=#ff0000]   [/background]";
    text.updateTexture();
    expect(text.inkBounds!.width).toBeGreaterThan(0);
    expect(text.inkBounds!.x).toBeGreaterThanOrEqual(0);
    expect(text.inkBounds!.y).toBeGreaterThanOrEqual(0);
  });

  it("caches empty scans and read failures until the next drawing", () => {
    const text = makeText("   ");
    text.updateTexture();
    expect(text.inkBounds).toBeNull();
    text.text = "Visible";
    text.updateTexture();
    const ctx = ((text as any).canvas as HTMLCanvasElement).getContext("2d")!;
    const read = vi.spyOn(ctx, "getImageData").mockImplementation(() => {
      throw new Error("read blocked");
    });
    expect(text.inkBounds).toBeNull();
    expect(text.inkBounds).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    read.mockRestore();
    text.fontSize = 33;
    text.updateTexture();
    expect(text.inkBounds).not.toBeNull();
  });
});
