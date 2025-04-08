export declare class ShaderManager {
    private gl;
    private shaders;
    private programs;
    constructor(gl: WebGLRenderingContext);
    createShader(type: number, source: string): WebGLShader;
    createProgram(vertexSource: string, fragmentSource: string): WebGLProgram;
    deleteProgram(program: WebGLProgram): void;
    destroy(): void;
}
