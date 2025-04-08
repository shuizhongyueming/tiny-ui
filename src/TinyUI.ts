import { Bitmap } from "./Bitmap";
import { Text } from "./Text";
import { Container } from "./Container";
import { DisplayObject } from "./DisplayObject";
import { Graphics } from "./Graphics";
import { type Color } from "./type";
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
uniform vec2 u_resolution;
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
  canvas: HTMLCanvasElement;
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

  private prevGlState: any = null;

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

    this.stashGlState();

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // 初始化管理器
    this.shaderManager = new ShaderManager(this.gl);
    this.textureManager = new TextureManager(this.gl);
    this.eventManager = new EventManager(this);

    // 初始化着色器
    this.initShaders();

    // 初始化缓冲区
    this.initBuffers();

    // 设置基本WebGL状态
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // 创建根容器
    this.root = new Container(this, 'RootContainer');
    this.root.anchorX = 0;
    this.root.anchorY = 0;

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

  render(patch: boolean = false) {
    this.updateViewport();

    const gl = this.gl;

    if (!patch) {
      // 清除画布
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // 设置视口
    gl.viewport(0, 0, this.viewportWidth, this.viewportHeight);

    // 使用着色器程序
    gl.useProgram(this.shaderProgram);

    // 设置分辨率
    gl.uniform2f(this.resolutionLocation, this.viewportWidth, this.viewportHeight);

    // 重置当前变换矩阵
    this.currentMatrix = new Matrix();

    // 渲染整个场景树
    this._renderTree(this.root);
  }

  private stashGlState() {
    const gl = this.gl;

    // 保存关键状态
    const savedState = {
      // 着色器程序
      program: gl.getParameter(gl.CURRENT_PROGRAM),

      // 纹理状态
      activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
      texture2D: gl.getParameter(gl.TEXTURE_BINDING_2D),

      // 缓冲区绑定
      arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
      elementArrayBuffer: gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING),

      // 混合状态
      blendEnabled: gl.isEnabled(gl.BLEND),
      blendSrc: gl.getParameter(gl.BLEND_SRC_RGB),
      blendDst: gl.getParameter(gl.BLEND_DST_RGB),

      // 视口
      viewport: gl.getParameter(gl.VIEWPORT),

      // 顶点属性状态（仅保存我们使用的属性）
      vertexAttribState: [
        {
          enabled: gl.getVertexAttrib(this.positionLocation, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
          buffer: gl.getVertexAttrib(this.positionLocation, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
          size: gl.getVertexAttrib(this.positionLocation, gl.VERTEX_ATTRIB_ARRAY_SIZE),
          type: gl.getVertexAttrib(this.positionLocation, gl.VERTEX_ATTRIB_ARRAY_TYPE),
          normalized: gl.getVertexAttrib(this.positionLocation, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
          stride: gl.getVertexAttrib(this.positionLocation, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
          offset: gl.getVertexAttribOffset(this.positionLocation, gl.VERTEX_ATTRIB_ARRAY_POINTER)
        },
        {
          enabled: gl.getVertexAttrib(this.texCoordLocation, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
          buffer: gl.getVertexAttrib(this.texCoordLocation, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
          size: gl.getVertexAttrib(this.texCoordLocation, gl.VERTEX_ATTRIB_ARRAY_SIZE),
          type: gl.getVertexAttrib(this.texCoordLocation, gl.VERTEX_ATTRIB_ARRAY_TYPE),
          normalized: gl.getVertexAttrib(this.texCoordLocation, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
          stride: gl.getVertexAttrib(this.texCoordLocation, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
          offset: gl.getVertexAttribOffset(this.texCoordLocation, gl.VERTEX_ATTRIB_ARRAY_POINTER)
        },
        {
          enabled: gl.getVertexAttrib(this.colorLocation, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
          buffer: gl.getVertexAttrib(this.colorLocation, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
          size: gl.getVertexAttrib(this.colorLocation, gl.VERTEX_ATTRIB_ARRAY_SIZE),
          type: gl.getVertexAttrib(this.colorLocation, gl.VERTEX_ATTRIB_ARRAY_TYPE),
          normalized: gl.getVertexAttrib(this.colorLocation, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
          stride: gl.getVertexAttrib(this.colorLocation, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
          offset: gl.getVertexAttribOffset(this.colorLocation, gl.VERTEX_ATTRIB_ARRAY_POINTER)
        }
      ]
    };

    this.prevGlState = savedState;
  }

  private restoreGlState() {
    const gl = this.gl;
    const savedState = this.prevGlState;

    // 恢复状态

    // 恢复着色器程序
    gl.useProgram(savedState.program);

    // 恢复纹理状态
    gl.activeTexture(savedState.activeTexture);
    gl.bindTexture(gl.TEXTURE_2D, savedState.texture2D);

    // 恢复缓冲区绑定
    gl.bindBuffer(gl.ARRAY_BUFFER, savedState.arrayBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, savedState.elementArrayBuffer);

    // 恢复混合状态
    if (savedState.blendEnabled) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.blendFunc(savedState.blendSrc, savedState.blendDst);

    // 恢复视口
    gl.viewport(
      savedState.viewport[0],
      savedState.viewport[1],
      savedState.viewport[2],
      savedState.viewport[3]
    );

    // 恢复顶点属性状态
    const attributes = [
      { location: this.positionLocation, state: savedState.vertexAttribState[0] },
      { location: this.texCoordLocation, state: savedState.vertexAttribState[1] },
      { location: this.colorLocation, state: savedState.vertexAttribState[2] }
    ];

    for (const attr of attributes) {
      const { location, state } = attr;

      if (state.enabled) {
        gl.enableVertexAttribArray(location);
      } else {
        gl.disableVertexAttribArray(location);
      }

      if (state.buffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
        gl.vertexAttribPointer(
          location,
          state.size,
          state.type,
          state.normalized,
          state.stride,
          state.offset
        );
      }
    }

    // 最后再次绑定原始数组缓冲区，确保一致性
    gl.bindBuffer(gl.ARRAY_BUFFER, savedState.arrayBuffer);
  }

  patchRender() {
    this.stashGlState();

    // 执行UI渲染
    this.render(true);

    this.restoreGlState();
  }

  _renderTree(node: DisplayObject, parentMatrix: Matrix = new Matrix(), parentAlpha: number = 1) {
    if (!node.visible || node.alpha <= 0) return;

    // 计算当前节点的实际alpha值（自身alpha × 父级alpha）
    const actualAlpha = node.alpha * parentAlpha;

    // 直接使用DisplayObject提供的矩阵计算能力
    // 注意：不再需要手动计算nodeMatrix，而是使用node的方法
    const nodeMatrix = node.getLocalTransformMatrix();

    // 与父矩阵组合（如果有父矩阵）
    const combinedMatrix = parentMatrix.clone().multiply(nodeMatrix);

    // 设置WebGL的变换矩阵
    this.currentMatrix = combinedMatrix;
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
        // 传递计算出的组合矩阵和实际alpha值给子节点
        this._renderTree(child, combinedMatrix, actualAlpha);
      }
    }
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

  parseColor(color: string | number): Color {
    // 默认颜色
    let r = 0, g = 0, b = 0, a = 1;

    if (typeof color === 'number') {
      // 处理数字格式: 0xff0000 或 0xff000000
      if (color <= 0xffffff) {
        // 没有 alpha 通道的格式 (0xRRGGBB)
        r = ((color >> 16) & 0xff) / 255;
        g = ((color >> 8) & 0xff) / 255;
        b = (color & 0xff) / 255;
      } else {
        // 有 alpha 通道的格式 (0xAARRGGBB)
        a = ((color >> 24) & 0xff) / 255;
        r = ((color >> 16) & 0xff) / 255;
        g = ((color >> 8) & 0xff) / 255;
        b = (color & 0xff) / 255;
      }
    } else if (typeof color === 'string') {
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
        } else if (hex.length === 8) {
          a = parseInt(hex.substring(0, 2), 16) / 255;
          r = parseInt(hex.substring(2, 4), 16) / 255;
          g = parseInt(hex.substring(4, 6), 16) / 255;
          b = parseInt(hex.substring(6, 8), 16) / 255;
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
    }

    return { r, g, b, a };
  }

  // 加载图片并创建纹理
  loadTexture(url: string): Promise<WebGLTexture> {
    return this.textureManager.loadTexture(url);
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

    this.restoreGlState();
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
