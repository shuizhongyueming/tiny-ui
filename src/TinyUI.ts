import { Bitmap } from "./Bitmap";
import { Container } from "./Container";
import { DisplayObject } from "./DisplayObject";
import { Graphics } from "./Graphics";
import { Text } from "./Text";
import { Matrix } from "./utils/Matrix";
import { EventManager } from "./utils/EventManager";
import { ShaderManager } from "./utils/ShaderManager";
import { TextureManager } from "./utils/TextureManager";
import { Color } from "./type";

// WebGL基础着色器
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;

uniform mat3 u_matrix;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
  vec3 position = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_texCoord = a_texCoord;
  v_color = a_color;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_image;
uniform bool u_useTexture;

varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
  if (u_useTexture) {
    gl_FragColor = texture2D(u_image, v_texCoord) * v_color;
  } else {
    gl_FragColor = v_color;
  }
}
`;

class TinyUI {
  private canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;

  // 管理器
  shaderManager: ShaderManager;
  textureManager: TextureManager;
  eventManager: EventManager;

  // 着色器程序
  private shaderProgram: WebGLProgram;

  // 着色器变量位置
  private positionLocation: number;
  private texCoordLocation: number;
  private colorLocation: number;
  private matrixLocation: WebGLUniformLocation | null;
  _imageLocation: WebGLUniformLocation | null;
  _useTextureLocation: WebGLUniformLocation | null;

  // 缓冲区
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private colorBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;

  // 视口大小
  private viewportWidth: number;
  private viewportHeight: number;

  // 当前变换矩阵
  private currentMatrix: Matrix = new Matrix();

  // 根容器
  root: Container;

  constructor(canvas: HTMLCanvasElement, options: WebGLContextAttributes = {}) {
    this.canvas = canvas;

    // 创建WebGL上下文
    const contextOptions = {
      stencil: options.stencil ?? true,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      premultipliedAlpha: options.premultipliedAlpha ?? true,
      antialias: options.antialias ?? true,
      depth: options.depth ?? false,
      alpha: true,
      ...options
    };

    this.gl = canvas.getContext('webgl', contextOptions) as WebGLRenderingContext;

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // 初始化管理器
    this.shaderManager = new ShaderManager(this.gl);
    this.textureManager = new TextureManager(this.gl);
    this.eventManager = new EventManager(canvas);

    // 初始化着色器
    this.initShaders();

    // 初始化缓冲区
    this.initBuffers();

    // 设置基本WebGL状态
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // 设置视口尺寸
    this.updateViewport();

    // 创建根容器
    this.root = new Container(this, 'RootContainer');
  }

  private updateViewport() {
    // 获取canvas的显示尺寸
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    // 更新canvas的绘图缓冲区尺寸以匹配显示尺寸
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    this.viewportWidth = this.canvas.width;
    this.viewportHeight = this.canvas.height;
  }

  private initShaders() {
    // 创建着色器程序
    this.shaderProgram = this.shaderManager.createProgram(
      VERTEX_SHADER_SOURCE,
      FRAGMENT_SHADER_SOURCE
    );

    // 获取着色器变量位置
    this.positionLocation = this.gl.getAttribLocation(this.shaderProgram, 'a_position');
    this.texCoordLocation = this.gl.getAttribLocation(this.shaderProgram, 'a_texCoord');
    this.colorLocation = this.gl.getAttribLocation(this.shaderProgram, 'a_color');

    this.matrixLocation = this.gl.getUniformLocation(this.shaderProgram, 'u_matrix');
    this._imageLocation = this.gl.getUniformLocation(this.shaderProgram, 'u_image');
    this._useTextureLocation = this.gl.getUniformLocation(this.shaderProgram, 'u_useTexture');

    // 使用着色器程序
    this.gl.useProgram(this.shaderProgram);
  }

  private initBuffers() {
    // 创建缓冲区
    this.positionBuffer = this.gl.createBuffer();
    this.texCoordBuffer = this.gl.createBuffer();
    this.colorBuffer = this.gl.createBuffer();
    this.indexBuffer = this.gl.createBuffer();
  }

  render() {
    this.updateViewport();

    const gl = this.gl;

    // 清除画布
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 设置视口
    gl.viewport(0, 0, this.viewportWidth, this.viewportHeight);

    // 使用着色器程序
    gl.useProgram(this.shaderProgram);

    // 重置当前变换矩阵为正射投影矩阵
    this.currentMatrix = Matrix.projection(this.viewportWidth, this.viewportHeight);

    // 从根容器开始递归渲染整个UI树
    this._renderNode(this.root);
  }

  _renderNode(node: DisplayObject) {
    if (!node.visible || node.alpha <= 0) return;

    // 保存当前变换矩阵
    const savedMatrix = this.currentMatrix.clone();

    // 应用节点的变换 (平移、旋转、缩放)
    this.currentMatrix.translate(node.x, node.y)
      .rotate(node.rotation * Math.PI / 180)
      .scale(node.scaleX, node.scaleY)
      .translate(-node.width * node.anchorX, -node.height * node.anchorY);

    // 设置变换矩阵
    this.gl.uniformMatrix3fv(this.matrixLocation, false, this.currentMatrix.toArray());

    // 调用组件的 render 方法
    node.render(this.currentMatrix);

    // 恢复变换矩阵
    this.currentMatrix = savedMatrix;
  }

  _setBufferData(positions: number[], texCoords: number[], colors: number[], indices: number[]) {
    const gl = this.gl;

    // 位置缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 纹理坐标缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // 颜色缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.colorLocation);
    gl.vertexAttribPointer(this.colorLocation, 4, gl.FLOAT, false, 0, 0);

    // 索引缓冲区
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  parseColor(color: string): Color {
    // 默认颜色
    let r = 0, g = 0, b = 0, a = 1;

    // 解析颜色字符串
    if (color.startsWith('#')) {
      // 十六进制颜色
      const hex = color.substring(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) / 255;
        g = parseInt(hex[1] + hex[1], 16) / 255;
        b = parseInt(hex[2] + hex[2], 16) / 255;
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
      }
    } else if (color.startsWith('rgba')) {
      // rgba(r,g,b,a) 格式
      const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (rgba) {
        r = parseInt(rgba[1]) / 255;
        g = parseInt(rgba[2]) / 255;
        b = parseInt(rgba[3]) / 255;
        a = parseFloat(rgba[4]);
      }
    } else if (color.startsWith('rgb')) {
      // rgb(r,g,b) 格式
      const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgb) {
        r = parseInt(rgb[1]) / 255;
        g = parseInt(rgb[2]) / 255;
        b = parseInt(rgb[3]) / 255;
      }
    }

    return { r, g, b, a };
  }

  // 加载图片并创建纹理
  loadTexture(url: string): Promise<WebGLTexture> {
    return this.textureManager.loadTexture(url);
  }

  resetGLState() {
    const gl = this.gl;

    // 重置绑定的纹理
    gl.bindTexture(gl.TEXTURE_2D, null);

    // 重置使用的着色器程序
    gl.useProgram(null);

    // 重置顶点数组和缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.disableVertexAttribArray(this.positionLocation);
    gl.disableVertexAttribArray(this.texCoordLocation);
    gl.disableVertexAttribArray(this.colorLocation);

    // 重置混合模式
    gl.disable(gl.BLEND);

    // 重置视口
    gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  destroy() {
    const gl = this.gl;

    // 删除缓冲区
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteBuffer(this.colorBuffer);
    gl.deleteBuffer(this.indexBuffer);

    // 删除着色器程序
    this.shaderManager.deleteProgram(this.shaderProgram);

    // 清理纹理管理器
    this.textureManager.destroy();

    // 销毁事件管理器
    this.eventManager.destroy();

    // 销毁根容器及所有子节点
    this.root.destroy();
  }

  async createBitmapFromUrl(url: string): Promise<Bitmap> {
    const texture = await this.loadTexture(url);
    const bitmap = new Bitmap(this);
    bitmap.texture = texture;
    return bitmap;
  }
  createBitmapFromImage(image: HTMLImageElement): Bitmap {
    const texture = this.textureManager.createImageTexture(image);
    const bitmap = new Bitmap(this);
    bitmap.texture = texture;
    return bitmap;
  }
  createText(textContent: string): Text {
    const text = new Text(this);
    text.setText(textContent);
    return text;
  }
  createContainer(name?: string): Container {
    const container = new Container(this, name);
    return container;
  }
  createGraphics(name?: string): Graphics {
    const graphics = new Graphics(this, name);
    return graphics;
  }
}

export = TinyUI;
