import { DisplayObject } from "./DisplayObject";
import type TinyUI from "./TinyUI";
import { type Matrix } from "./utils/Matrix";
export declare class Bitmap extends DisplayObject {
    src: string;
    texture: WebGLTexture | null;
    imgLoadPromise: Promise<Bitmap> | null;
    source: HTMLImageElement | HTMLCanvasElement | null;
    constructor(app: TinyUI, name?: string);
    private realLoadFromUrl;
    /**
    * @param url 图片或者图片地址
    * @param resize 是否调整 Bitmap 的大小为图片的大小
    * @returns
    */
    loadFromUrl(url: string, resize?: boolean): Promise<Bitmap>;
    loadFromImage(image: HTMLImageElement, resize?: boolean): Bitmap;
    loadFromCanvas(canvas: HTMLCanvasElement, resize?: boolean): Bitmap;
    destroy(): void;
    render(_matrix: Matrix): void;
}
