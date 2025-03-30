import { Bitmap } from "./Bitmap";
import { Text } from "./Text";
import { Container } from "./Container";
import { DisplayObject } from "./DisplayObject";
import { Graphics } from "./Graphics";
import { Color } from "./type";
import { EventManager } from "./utils/EventManager";
import { Matrix } from "./utils/Matrix";
import { ShaderManager } from "./utils/ShaderManager";
import { TextureManager } from "./utils/TextureManager";

// WebGL基础着色器
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;
uniform mat3 u_matrix;
uniform vec2 u_resolution; // 新增：画布分辨率
varying vec2 v_texCoord;
varying vec4 v_color;

void main() {
  // 应用模型变换
  vec3 position = u_matrix * vec3(a_position, 1.0);

  // 将像素坐标转换为 0.0 到 1.0
  vec2 zeroToOne = position.xy / u_resolution;

  // 将 0->1 转换为 0->2
  vec2 zeroToTwo = zeroToOne * 2.0;

  // 将 0->2 转换为 -1->+1 (裁剪空间)
  vec2 clipSpace = zeroToTwo - 1.0;

  // WebGL中y轴向上，而屏幕坐标y轴向下，所以需要翻转y轴
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

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
  private resolutionLocation: WebGLUniformLocation | null; // 新增
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

    // 创建根容器
    this.root = new Container(this, 'RootContainer');

    // 设置视口尺寸
    this.updateViewport();
  }


  private updateViewport() {
    // 获取canvas的显示尺寸
    const displayWidth = this.canvas.clientWidth * window.devicePixelRatio;
    const displayHeight = this.canvas.clientHeight * window.devicePixelRatio;

    // 更新canvas的绘图缓冲区尺寸以匹配显示尺寸
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
    this.root.width = displayWidth;
    this.root.height = displayHeight;

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
    this.resolutionLocation = this.gl.getUniformLocation(this.shaderProgram, 'u_resolution');

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
    console.log('当前视口:', this.viewportWidth, this.viewportHeight);
    gl.viewport(0, 0, this.viewportWidth, this.viewportHeight);

    // 使用着色器程序
    gl.useProgram(this.shaderProgram);

    // 设置分辨率
    console.log('当前分辨率:', this.viewportWidth, this.viewportHeight);
    gl.uniform2f(this.resolutionLocation, this.viewportWidth, this.viewportHeight);

    // 重置当前变换矩阵
    this.currentMatrix = new Matrix();

    // 渲染整个场景树
    this._renderTree(this.root);
  }

  _renderTree(node: DisplayObject, parentMatrix: Matrix = new Matrix(), parentAlpha: number = 1) {
    if (!node.visible || node.alpha <= 0) return;

    // 计算当前节点的实际alpha值（自身alpha × 父级alpha）
    const actualAlpha = node.alpha * parentAlpha;

    // 创建当前节点的变换矩阵，基于父矩阵
    const nodeMatrix = parentMatrix.clone();

    const anchorOffsetX = node.width * node.anchorX;
    const anchorOffsetY = node.height * node.anchorY;

    // 应用当前节点的变换
    // 平移到位置
    nodeMatrix.translate(node.x - anchorOffsetX, node.y - anchorOffsetY);

    // 如果需要围绕锚点旋转/缩放
    if (node.rotation !== 0 || node.scaleX !== 1 || node.scaleY !== 1) {

      // 先将锚点移动到原点
      nodeMatrix.translate(anchorOffsetX, anchorOffsetY);

      // 应用旋转和缩放
      nodeMatrix
        .rotate(node.rotation * Math.PI / 180)
        .scale(node.scaleX, node.scaleY);

      // 将锚点移回原位置
      nodeMatrix.translate(-anchorOffsetX, -anchorOffsetY);
    }

    // 设置变换矩阵并渲染当前节点
    this.currentMatrix = nodeMatrix;
    this.gl.uniformMatrix3fv(this.matrixLocation, false, this.currentMatrix.toArray());

    // 临时存储原始alpha值
    const originalAlpha = node.alpha;
    // 设置实际alpha值用于渲染
    node.alpha = actualAlpha;

    // 渲染当前节点
    node.render(this.currentMatrix);

    // 恢复原始alpha值
    node.alpha = originalAlpha;

    // 如果是容器，递归渲染子节点
    if ('children' in node && Array.isArray((node as any).children)) {
      const children = (node as any).children as DisplayObject[];
      for (const child of children) {
        this._renderTree(child, nodeMatrix, actualAlpha);
      }
    }
  }

  _setBufferData(positions: number[], texCoords: number[], colors: number[], indices: number[]) {
    console.log('_setBufferData', { positions, texCoords, colors, indices });
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
    const bitmap = new Bitmap(this);
    await bitmap.loadFromUrl(url)
    return bitmap;
  }
  createBitmapFromImage(image: HTMLImageElement): Bitmap {
    const bitmap = new Bitmap(this);
    bitmap.loadFromImage(image);
    return bitmap;
  }
  createText(textContent: string): Text {
    const text = new Text(this);
    text.text = textContent;
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

  testRender(x: number, y: number, width: number, height: number) {
    console.log('testRender: ', { x, y, width, height });
    console.log('viewport size:', this.canvas.width, this.canvas.height);
    // 保存当前WebGL状态
    const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM);

    // 使用我们的着色器
    this.gl.useProgram(this.shaderProgram);

    this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // 创建一个简单矩阵，仅包含位移
    const matrix = new Matrix().translate(x, y);
    console.log('matrix:', matrix);
    this.gl.uniformMatrix3fv(this.matrixLocation, false, matrix.toArray());

    // 创建简单的红色矩形
    const positions = [0, 0, width, 0, width, height, 0, height];
    const texCoords = [0, 0, 1, 0, 1, 1, 0, 1];
    const colors = [
      1, 0, 0, 1,  // 红色
      1, 0, 0, 1,
      1, 0, 0, 1,
      1, 0, 0, 1
    ];
    const indices = [0, 1, 2, 0, 2, 3];

    // 设置缓冲
    this._setBufferData(positions, texCoords, colors, indices);

    // 禁用纹理
    this.gl.uniform1i(this._useTextureLocation, 0);

    // 绘制
    this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);

    // 恢复WebGL状态
    this.gl.useProgram(currentProgram);
  }
}

export = TinyUI;
