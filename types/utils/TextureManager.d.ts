export declare class TextureManager {
    private gl;
    private textures;
    private textureCache;
    constructor(gl: WebGLRenderingContext);
    createTexture(): WebGLTexture;
    setTextureFromImage(texture: WebGLTexture, image: HTMLImageElement | HTMLCanvasElement): void;
    loadImage(url: string): Promise<HTMLImageElement>;
    loadTexture(url: string): Promise<WebGLTexture>;
    createImageTexture(image: HTMLImageElement): WebGLTexture;
    createCanvasTexture(canvas: HTMLCanvasElement): WebGLTexture;
    deleteTexture(texture: WebGLTexture): void;
    destroy(): void;
}
