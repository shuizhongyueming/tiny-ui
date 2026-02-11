import { Bitmap } from "./Bitmap";
import { Text } from "./Text";
import { Container } from "./Container";
import { DisplayObject } from "./DisplayObject";
import { Graphics } from "./Graphics";
import { type Size, type Color, type EventName } from "./type";
import { EventManager, TouchEventListeningHandler } from "./utils/EventManager";
import { Matrix } from "./utils/Matrix";
import { ShaderManager } from "./utils/ShaderManager";
import { TextureManager } from "./utils/TextureManager";
import { GLState } from "./utils/GLState";

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
    vec4 texColor = texture2D(u_image, v_texCoord);
    // 适当处理透明度
    vec4 color = texColor * v_color;
    // 预乘 alpha：RGB 乘以 alpha，保持 alpha 不变
    gl_FragColor = vec4(color.rgb * color.a, color.a);
    // 确保完全透明的像素被正确处理
    if (gl_FragColor.a < 0.01) {
      discard;
    }
  } else {
    // 预乘 alpha：RGB 乘以 alpha，保持 alpha 不变
    gl_FragColor = vec4(v_color.rgb * v_color.a, v_color.a);
    // 同样处理纯色的透明度
    if (gl_FragColor.a < 0.01) {
      discard;
    }
  }
}
`;

interface TinyUIOption {
  handleTouchEventListening?: TouchEventListeningHandler;
  glState?: GLState;
}

class TinyUI {
  static GLState = GLState;
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  contextOptions: WebGLContextAttributes;

  // 状态管理
  private glState: GLState;

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

  private _glTasks: Array<() => void> = [];
  private _glSafeDepth: number = 0;

  // tick 机制
  private _tickCallbacks: Array<(delta: number) => void> = [];
  private _lastTickTime: number = 0;
  private _autoRender: boolean = false;
  private _isTickLoopRunning: boolean = false;
  private _rafId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    glContextArrtibutes: WebGLContextAttributes = {},
    contextId: "webgl" | "webgl2" = "webgl",
    option: TinyUIOption = {},
  ) {
    this.canvas = canvas;

    // 创建WebGL上下文
    this.contextOptions = glContextArrtibutes;

    this.gl = canvas.getContext(
      contextId,
      glContextArrtibutes,
    ) as WebGLRenderingContext;

    if (!this.gl) {
      throw new Error("WebGL not supported");
    }

    if (option.glState) {
      this.glState = option.glState;
    } else {
      this.glState = new GLState(this.gl);
    }
    this.glState.install();

    // 初始化管理器
    this.shaderManager = new ShaderManager(this.gl);
    this.textureManager = new TextureManager(this.gl, this);
    this.eventManager = new EventManager(this, option);

    // 初始化着色器
    this.initShaders();

    // 初始化缓冲区
    this.initBuffers();

    // 设置基本WebGL状态
    // 注意：片段着色器已输出预乘 alpha 的颜色，所以 blendFunc 固定为 (ONE, ONE_MINUS_SRC_ALPHA)
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    // 创建根容器
    this.root = new Container(this, "RootContainer");
    this.root.anchorX = 0;
    this.root.anchorY = 0;

    const displayWidth = this.canvas.clientWidth * window.devicePixelRatio;
    const displayHeight = this.canvas.clientHeight * window.devicePixelRatio;
    this.canvas.width = displayWidth;
    this.canvas.height = displayHeight;

    // 设置视口尺寸
    this.updateViewport();
  }

  private updateViewport(patch = false) {
    // 获取canvas的显示尺寸
    let displayWidth: number;
    let displayHeight: number;

    // if (!patch) {
    //   displayWidth = this.canvas.clientWidth * window.devicePixelRatio;
    //   displayHeight = this.canvas.clientHeight * window.devicePixelRatio;
    //   // 更新canvas的绘图缓冲区尺寸以匹配显示尺寸
    //   if (
    //     this.canvas.width !== displayWidth ||
    //     this.canvas.height !== displayHeight
    //   ) {
    //     this.canvas.width = displayWidth;
    //     this.canvas.height = displayHeight;
    //   }
    // } else {
    //   displayWidth = this.canvas.width;
    //   displayHeight = this.canvas.height;
    // }

    displayWidth = this.canvas.width;
    displayHeight = this.canvas.height;

    this.root.width = displayWidth;
    this.root.height = displayHeight;

    this.viewportWidth = this.canvas.width;
    this.viewportHeight = this.canvas.height;
  }

  get stageWidth() {
    return this.viewportWidth;
  }

  get stageHeight() {
    return this.viewportHeight;
  }

  get stageSize(): Size {
    return { width: this.stageWidth, height: this.stageHeight };
  }

  private initShaders() {
    // 创建着色器程序
    this.shaderProgram = this.shaderManager.createProgram(
      VERTEX_SHADER_SOURCE,
      FRAGMENT_SHADER_SOURCE,
    );

    // 获取着色器变量位置
    this.positionLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "a_position",
    );
    this.texCoordLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "a_texCoord",
    );
    this.colorLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "a_color",
    );

    this.matrixLocation = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_matrix",
    );
    this.resolutionLocation = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_resolution",
    );

    this._imageLocation = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_image",
    );
    this._useTextureLocation = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_useTexture",
    );

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
    this.updateViewport(patch);

    this._glSafeDepth++;
    try {
      // 在 _flushGLTasks 之前执行 tick
      this._executeTicks();
      
      this._flushGLTasks();

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
      gl.uniform2f(
        this.resolutionLocation,
        this.viewportWidth,
        this.viewportHeight,
      );

      // 重置当前变换矩阵
      this.currentMatrix = new Matrix();

      // 渲染整个场景树
      this._renderTree(this.root);
    } finally {
      this._glSafeDepth--;
    }
  }

  private stashGlState() {
    this.glState.snapshot();
  }

  private restoreGlState() {
    this.glState.restore();
  }

  patchRender() {
    this.stashGlState();
    try {
      // 启用正确的混合模式
      // 注意：片段着色器已输出预乘 alpha 的颜色
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

      // 执行UI渲染
      this.render(true);
    } finally {
      this.restoreGlState();
    }
  }

  isInGLSafeSection(): boolean {
    return this._glSafeDepth > 0;
  }

  enqueueGLTask(task: () => void): void {
    if (this.isInGLSafeSection()) {
      task();
      return;
    }
    this._glTasks.push(task);
  }

  private _flushGLTasks(): void {
    // Tasks can enqueue more tasks; keep flushing until stable.
    let guard = 0;
    while (this._glTasks.length > 0) {
      if (guard++ > 1000) {
        console.warn("[TinyUI] GL task flush exceeded guard limit");
        this._glTasks.length = 0;
        return;
      }

      const tasks = this._glTasks.splice(0, this._glTasks.length);
      for (const task of tasks) {
        try {
          task();
        } catch (err) {
          console.warn("[TinyUI] GL task failed:", err);
        }
      }
    }
  }

  _renderTree(
    node: DisplayObject,
    parentMatrix: Matrix = new Matrix(),
    parentAlpha: number = 1,
  ) {
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
    this.gl.uniformMatrix3fv(
      this.matrixLocation,
      false,
      this.currentMatrix.toArray(),
    );

    // 临时存储原始alpha值
    const originalAlpha = node.alpha;
    // 设置实际alpha值用于渲染
    node.alpha = actualAlpha;

    // 处理裁剪区域
    let scissorEnabled = false;
    if (node.clipRect) {
      scissorEnabled = this._applyScissor(node, combinedMatrix);
    }

    // 渲染当前节点
    node.render(this.currentMatrix);

    // 如果是容器，递归渲染子节点
    if ("children" in node && Array.isArray((node as any).children)) {
      const children = (node as any).children as DisplayObject[];
      for (const child of children) {
        // 传递计算出的组合矩阵和实际alpha值给子节点
        this._renderTree(child, combinedMatrix, actualAlpha);
      }
    }

    // 恢复裁剪状态
    if (scissorEnabled) {
      this._restoreScissor();
    }

    // 恢复原始alpha值
    node.alpha = originalAlpha;
  }

  /**
   * 应用 scissor 裁剪
   * @returns 是否成功启用 scissor
   */
  private _applyScissor(node: DisplayObject, matrix: Matrix): boolean {
    if (!node.clipRect) return false;

    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;

    // 将裁剪区域的四个角转换到屏幕坐标
    const rect = node.clipRect;
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ];

    // 应用变换矩阵到裁剪区域
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const corner of corners) {
      const transformed = matrix.transformPoint(corner.x, corner.y);
      minX = Math.min(minX, transformed.x);
      minY = Math.min(minY, transformed.y);
      maxX = Math.max(maxX, transformed.x);
      maxY = Math.max(maxY, transformed.y);
    }

    // 转换为 WebGL 视口坐标（左下角原点，向上/右为正）
    // minX/minY/maxX/maxY 已经是物理像素（TinyUI 使用物理像素坐标系）
    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;
    
    // 直接使用物理像素坐标
    const physicalMinX = minX;
    const physicalMinY = minY;
    const physicalMaxX = maxX;
    const physicalMaxY = maxY;
    
    // TinyUI: 左上角为原点，Y 向下
    // WebGL scissor: 左下角为原点，Y 向上
    // 转换 Y 坐标：scissorY 是距离视口底部的距离
    const rawScissorX = Math.round(physicalMinX);
    const rawScissorY = Math.round(viewportHeight - physicalMaxY);
    const rawScissorWidth = Math.round(physicalMaxX - physicalMinX);
    const rawScissorHeight = Math.round(physicalMaxY - physicalMinY);
    
    // 裁剪到视口范围内（计算两个矩形的交集）
    // 视口矩形: (0, 0) 到 (viewportWidth, viewportHeight)
    // Scissor 矩形: (rawScissorX, rawScissorY) 到 (rawScissorX + rawScissorWidth, rawScissorY + rawScissorHeight)
    const intersectLeft = Math.max(0, rawScissorX);
    const intersectTop = Math.max(0, rawScissorY);
    const intersectRight = Math.min(viewportWidth, rawScissorX + rawScissorWidth);
    const intersectBottom = Math.min(viewportHeight, rawScissorY + rawScissorHeight);
    
    const scissorX = Math.round(intersectLeft);
    const scissorY = Math.round(intersectTop);
    const scissorWidth = Math.max(0, Math.round(intersectRight - intersectLeft));
    const scissorHeight = Math.max(0, Math.round(intersectBottom - intersectTop));

    // 确保有效范围
    if (scissorWidth <= 0 || scissorHeight <= 0) {
      return false;
    }

    // 保存当前 scissor 状态
    this._scissorStateStack.push({
      enabled: gl.isEnabled(gl.SCISSOR_TEST),
      box: gl.getParameter(gl.SCISSOR_BOX),
    });

    // 启用 scissor
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(scissorX, scissorY, scissorWidth, scissorHeight);

    return true;
  }

  /**
   * 恢复 scissor 状态
   */
  private _scissorStateStack: Array<{ enabled: boolean; box: Int32Array }> = [];

  private _restoreScissor(): void {
    const gl = this.gl;
    const state = this._scissorStateStack.pop();
    if (!state) return;

    if (state.enabled) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(state.box[0], state.box[1], state.box[2], state.box[3]);
    } else {
      gl.disable(gl.SCISSOR_TEST);
    }
  }

  _setBufferData(
    positions: number[],
    texCoords: number[],
    colors: number[],
    indices: number[],
  ) {
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
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW,
    );
  }

  parseColor(color: string | number): Color {
    // 默认颜色
    let r = 0,
      g = 0,
      b = 0,
      a = 1;

    if (typeof color === "number") {
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
    } else if (typeof color === "string") {
      // 解析颜色字符串
      if (color.startsWith("#")) {
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
      } else if (color.startsWith("rgba")) {
        // rgba(r,g,b,a) 格式
        const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (rgba) {
          r = parseInt(rgba[1]) / 255;
          g = parseInt(rgba[2]) / 255;
          b = parseInt(rgba[3]) / 255;
          a = parseFloat(rgba[4]);
        }
      } else if (color.startsWith("rgb")) {
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

  // 加载图片并创建纹理（deferred upload，在 safe section 内完成 GL 上传）
  loadTexture(url: string): Promise<WebGLTexture> {
    return this.textureManager.loadTexture(url);
  }

  destroy() {
    const gl = this.gl;

    // Flush any pending GL tasks (e.g. queued texture deletes).
    this._glSafeDepth++;
    try {
      this._flushGLTasks();
    } finally {
      this._glSafeDepth--;
    }

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

    // 恢复GL状态
    this.restoreGlState();

    // 停止 tick 循环
    this._stopTickLoop();
    this._tickCallbacks = [];
  }

  // ========== tick 机制 ==========

  /**
   * 获取当前时间戳（兼容性处理）
   * 优先使用 performance.now()，如果不存在则使用 Date.now()
   */
  private _now(): number {
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  /**
   * 计算时间差并执行所有 tick 回调
   * 包含：计算 delta、更新 _lastTickTime、执行回调
   */
  private _executeTicks(): void {
    const now = this._now();
    const delta = this._lastTickTime === 0 ? 0 : now - this._lastTickTime;
    this._lastTickTime = now;

    // 执行 tick 回调（传入计算好的 delta）
    for (let i = 0; i < this._tickCallbacks.length; i++) {
      try {
        this._tickCallbacks[i](delta);
      } catch (err) {
        console.error("[TinyUI] Tick callback error:", err);
      }
    }
  }

  /**
   * 注册 tick 回调函数
   * 纯数组操作，幂等：同一回调多次添加只会注册一次
   * 注意：需要调用 setAutoRender(true) 启动 RAF 循环才能执行 tick
   */
  addTick(callback: (delta: number) => void): void {
    // 检查是否已存在（幂等）
    if (this._tickCallbacks.indexOf(callback) === -1) {
      this._tickCallbacks.push(callback);
    }
  }

  /**
   * 解绑 tick 回调函数
   * 纯数组操作，不影响 RAF 循环状态
   */
  removeTick(callback: (delta: number) => void): void {
    const index = this._tickCallbacks.indexOf(callback);
    if (index !== -1) {
      this._tickCallbacks.splice(index, 1);
    }
  }

  /**
   * 设置是否在 tick 后自动 render，并控制 RAF 循环
   * 默认 false
   * 设为 true 时启动 RAF 循环（如果尚未运行）
   * 设为 false 时停止 RAF 循环（如果正在运行）
   */
  setAutoRender(value: boolean): void {
    this._autoRender = value;
    if (value) {
      this._startTickLoop();
    } else {
      this._stopTickLoop();
    }
  }

  /**
   * 获取当前的 autoRender 状态
   */
  getAutoRender(): boolean {
    return this._autoRender;
  }

  /**
   * 启动 tick 循环（内部方法）
   */
  private _startTickLoop(): void {
    if (this._isTickLoopRunning) return;
    this._isTickLoopRunning = true;
    this._runTickLoop();
  }

  /**
   * 停止 tick 循环（内部方法）
   */
  private _stopTickLoop(): void {
    this._isTickLoopRunning = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * RAF 循环（内部方法）
   * 只触发 render，delta 计算在 render 中通过 _executeTicks 统一处理
   */
  private _runTickLoop(): void {
    if (!this._isTickLoopRunning) return;

    if (this._autoRender) {
      try {
        this.render();
      } catch (err) {
        console.error("[TinyUI] Auto render error:", err);
      }
    }

    // 继续下一帧
    this._rafId = requestAnimationFrame(() => this._runTickLoop());
  }

  async createBitmapFromUrl(url: string): Promise<Bitmap> {
    const bitmap = new Bitmap(this);
    await bitmap.loadFromUrl(url);
    return bitmap;
  }
  createBitmapFromImage(image: HTMLImageElement): Bitmap {
    const bitmap = new Bitmap(this);
    bitmap.loadFromImage(image);
    return bitmap;
  }
  createBitmapFromCanvas(
    canvas: HTMLCanvasElement,
    resize: boolean = true,
  ): Bitmap {
    const bitmap = new Bitmap(this);
    bitmap.loadFromCanvas(canvas, resize);
    return bitmap;
  }
  createText(textContent: string, name?: string): Text {
    const text = new Text(this, name);
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

    this.gl.uniform2f(
      this.resolutionLocation,
      this.canvas.width,
      this.canvas.height,
    );

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // 创建一个简单矩阵，仅包含位移
    const matrix = new Matrix().translate(x, y);
    this.gl.uniformMatrix3fv(this.matrixLocation, false, matrix.toArray());

    // 创建简单的红色矩形
    const positions = [0, 0, width, 0, width, height, 0, height];
    const texCoords = [0, 0, 1, 0, 1, 1, 0, 1];
    const colors = [
      1,
      0,
      0,
      1, // 红色
      1,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
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
