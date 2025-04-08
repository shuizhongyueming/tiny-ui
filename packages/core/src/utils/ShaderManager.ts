export class ShaderManager {
  private gl: WebGLRenderingContext;
  private shaders: WebGLShader[] = [];
  private programs: WebGLProgram[] = [];

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  // 创建着色器
  createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;

    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('ShaderManager: Could not create shader of type ' + type);
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // 检查编译是否成功
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('ShaderManager: Could not compile shader.\n' + info);
    }

    this.shaders.push(shader);
    return shader;
  }

  // 创建着色器程序
  createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // 检查链接是否成功
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('ShaderManager: Could not link program.\n' + info);
    }

    this.programs.push(program);
    return program;
  }

  // 删除着色器程序
  deleteProgram(program: WebGLProgram): void {
    const gl = this.gl;

    const index = this.programs.indexOf(program);
    if (index !== -1) {
      this.programs.splice(index, 1);
      gl.deleteProgram(program);
    }
  }

  // 销毁所有着色器和程序
  destroy(): void {
    const gl = this.gl;

    // 删除所有着色器
    for (const shader of this.shaders) {
      gl.deleteShader(shader);
    }
    this.shaders = [];

    // 删除所有程序
    for (const program of this.programs) {
      gl.deleteProgram(program);
    }
    this.programs = [];
  }
}
