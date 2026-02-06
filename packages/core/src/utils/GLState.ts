type UniformValue = number | number[] | Float32Array | Int32Array | Uint32Array;

export interface UniformState {
  location: WebGLUniformLocation;
  type: string; // '1f', '2fv', '3i', 'Matrix4fv' 等
  value: UniformValue | UniformValue[];
}

export interface AttribPointerState {
  enabled: boolean;
  buffer: WebGLBuffer | null;
  size: number;
  type: number;
  normalized: boolean;
  stride: number;
  offset: number;
}

interface GLInnerState {
  program: WebGLProgram | null;
  framebuffer: WebGLFramebuffer | null;
  renderbuffer: WebGLRenderbuffer | null;
  arrayBuffer: WebGLBuffer | null;
  elementArrayBuffer: WebGLBuffer | null;
  activeTexture: number;
  texture2DByUnit: Array<WebGLTexture | null>;
  attribs: Record<number, AttribPointerState>;
  uniformState: UniformState[];
  blendEnabled: boolean;
  blendSrcRGB: number;
  blendDstRGB: number;
  blendSrcAlpha: number;
  blendDstAlpha: number;
  blendEqRGB: number;
  blendEqAlpha: number;
  viewport: [number, number, number, number];
  scissorEnabled: boolean;
  scissorBox: [number, number, number, number];
  depthTestEnabled: boolean;
  depthFunc: number;
  depthMask: boolean;
  stencilTestEnabled: boolean;
  stencilMask: number;
  stencilWriteMask: number;
  colorMask: [boolean, boolean, boolean, boolean];
  clearColor: [number, number, number, number];
  clearDepth: number;
  clearStencil: number;
  blendColor: [number, number, number, number];
  cullFaceEnabled: boolean;
  cullFaceMode: number;
  frontFace: number;
  ditherEnabled: boolean;
  polygonOffsetFillEnabled: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
  sampleCoverageEnabled: boolean;
  sampleCoverageValue: number;
  sampleCoverageInvert: boolean;
  vao: WebGLVertexArrayObject | null;
  vaoOES: any;
  // pixelStorei states (tracked for safe section texture uploads)
  unpackPremultiplyAlpha: boolean;
  unpackAlignment: number;
  unpackFlipY: boolean;
  unpackColorspaceConversion: number;
}

type AnyGL = WebGLRenderingContext | WebGL2RenderingContext;

export class GLState {
  readonly gl: AnyGL;
  private installed: boolean = false;
  private state: GLInnerState;
  private isWebGL2: boolean;
  private orig: Record<string, any> = {};
  private trackingEnabled: boolean = true;

  private programUniformStates = new Map<
    WebGLProgram,
    Map<WebGLUniformLocation, UniformState>
  >();
  private currentProgram: WebGLProgram | null = null;

  private vaoExt: any | null = null;

  private syncedFromGL: boolean = false;
  private maxAttribIndexSeen: number = -1;
  private maxTextureUnitSeen: number = -1;

  constructor(gl: AnyGL) {
    this.gl = gl;
    this.isWebGL2 =
      typeof (gl as WebGL2RenderingContext).createVertexArray === "function";

    if (!this.isWebGL2) {
      this.vaoExt = (gl as WebGLRenderingContext).getExtension(
        "OES_vertex_array_object",
      );
    }

    this.state = {
      program: null,
      framebuffer: null,
      renderbuffer: null,
      arrayBuffer: null,
      elementArrayBuffer: null,
      activeTexture: gl.TEXTURE0,
      texture2DByUnit: new Array(32).fill(null),
      attribs: {},
      uniformState: [],
      blendEnabled: false,
      blendSrcRGB: gl.ONE,
      blendDstRGB: gl.ZERO,
      blendSrcAlpha: gl.ONE,
      blendDstAlpha: gl.ZERO,
      blendEqRGB: gl.FUNC_ADD,
      blendEqAlpha: gl.FUNC_ADD,
      viewport: [0, 0, 0, 0],
      scissorEnabled: false,
      scissorBox: [0, 0, 0, 0],
      depthTestEnabled: false,
      depthFunc: gl.LESS,
      depthMask: true,
      stencilTestEnabled: false,
      stencilMask: 0xffffffff,
      stencilWriteMask: 0xffffffff,
      colorMask: [true, true, true, true],
      clearColor: [0, 0, 0, 0],
      clearDepth: 1,
      clearStencil: 0,
      blendColor: [0, 0, 0, 0],
      cullFaceEnabled: false,
      cullFaceMode: gl.BACK,
      frontFace: gl.CCW,
      ditherEnabled: true,
      polygonOffsetFillEnabled: false,
      polygonOffsetFactor: 0,
      polygonOffsetUnits: 0,
      sampleCoverageEnabled: false,
      sampleCoverageValue: 1,
      sampleCoverageInvert: false,
      vao: null,
      vaoOES: null,
      unpackPremultiplyAlpha: false,
      unpackAlignment: 4,
      unpackFlipY: false,
      unpackColorspaceConversion: gl.BROWSER_DEFAULT_WEBGL,
    };
  }

  install(): void {
    if (this.installed) return;
    this.installed = true;

    const gl: any = this.gl as any;

    const wrap = (name: string, fn: (...args: any[]) => any) => {
      const orig = gl[name];
      if (typeof orig !== "function") return;
      this.orig[name] = orig.bind(gl);
      gl[name] = (...args: any[]) => {
        if (this.trackingEnabled) {
          fn(...args);
        }
        return this.orig[name](...args);
      };
    };

    wrap("useProgram", (program: WebGLProgram | null) => {
      this.state.program = program;
      this.currentProgram = program;
      if (program && !this.programUniformStates.has(program)) {
        this.programUniformStates.set(program, new Map());
      }
    });

    wrap("deleteProgram", (program: WebGLProgram) => {
      if (this.trackingEnabled && program) {
        this.programUniformStates.delete(program);
        if (this.currentProgram === program) {
          this.currentProgram = null;
          this.state.program = null;
        }
      }
    });

    wrap("bindFramebuffer", (target: number, fb: WebGLFramebuffer | null) => {
      if (target === this.gl.FRAMEBUFFER) {
        this.state.framebuffer = fb;
      }
    });

    wrap("bindRenderbuffer", (target: number, rb: WebGLRenderbuffer | null) => {
      if (target === this.gl.RENDERBUFFER) {
        this.state.renderbuffer = rb;
      }
    });

    wrap("viewport", (x: number, y: number, w: number, h: number) => {
      this.state.viewport = [x, y, w, h];
    });

    wrap("scissor", (x: number, y: number, w: number, h: number) => {
      this.state.scissorBox = [x, y, w, h];
    });

    wrap("enable", (cap: number) => {
      if (cap === this.gl.BLEND) this.state.blendEnabled = true;
      if (cap === this.gl.SCISSOR_TEST) this.state.scissorEnabled = true;
      if (cap === this.gl.DEPTH_TEST) this.state.depthTestEnabled = true;
      if (cap === this.gl.STENCIL_TEST) this.state.stencilTestEnabled = true;
      if (cap === this.gl.CULL_FACE) this.state.cullFaceEnabled = true;
      if (cap === this.gl.DITHER) this.state.ditherEnabled = true;
      if (cap === this.gl.POLYGON_OFFSET_FILL)
        this.state.polygonOffsetFillEnabled = true;
      if (cap === this.gl.SAMPLE_COVERAGE)
        this.state.sampleCoverageEnabled = true;
    });

    wrap("disable", (cap: number) => {
      if (cap === this.gl.BLEND) this.state.blendEnabled = false;
      if (cap === this.gl.SCISSOR_TEST) this.state.scissorEnabled = false;
      if (cap === this.gl.DEPTH_TEST) this.state.depthTestEnabled = false;
      if (cap === this.gl.STENCIL_TEST) this.state.stencilTestEnabled = false;
      if (cap === this.gl.CULL_FACE) this.state.cullFaceEnabled = false;
      if (cap === this.gl.DITHER) this.state.ditherEnabled = false;
      if (cap === this.gl.POLYGON_OFFSET_FILL)
        this.state.polygonOffsetFillEnabled = false;
      if (cap === this.gl.SAMPLE_COVERAGE)
        this.state.sampleCoverageEnabled = false;
    });

    wrap("blendFunc", (src: number, dst: number) => {
      this.state.blendSrcRGB = src;
      this.state.blendDstRGB = dst;
      this.state.blendSrcAlpha = src;
      this.state.blendDstAlpha = dst;
    });

    wrap(
      "blendFuncSeparate",
      (srcRGB: number, dstRGB: number, srcA: number, dstA: number) => {
        this.state.blendSrcRGB = srcRGB;
        this.state.blendDstRGB = dstRGB;
        this.state.blendSrcAlpha = srcA;
        this.state.blendDstAlpha = dstA;
      },
    );

    wrap("blendEquation", (mode: number) => {
      this.state.blendEqRGB = mode;
      this.state.blendEqAlpha = mode;
    });

    wrap("blendEquationSeparate", (modeRGB: number, modeA: number) => {
      this.state.blendEqRGB = modeRGB;
      this.state.blendEqAlpha = modeA;
    });

    wrap("depthFunc", (func: number) => {
      this.state.depthFunc = func;
    });

    wrap("depthMask", (flag: boolean) => {
      this.state.depthMask = flag;
    });

    wrap("stencilMask", (mask: number) => {
      this.state.stencilMask = mask;
      this.state.stencilWriteMask = mask;
    });

    wrap("cullFace", (mode: number) => {
      this.state.cullFaceMode = mode;
    });

    wrap("frontFace", (mode: number) => {
      this.state.frontFace = mode;
    });

    wrap("colorMask", (r: boolean, g: boolean, b: boolean, a: boolean) => {
      this.state.colorMask = [r, g, b, a];
    });

    wrap("activeTexture", (tex: number) => {
      this.state.activeTexture = tex;
      const unit = tex - this.gl.TEXTURE0;
      if (unit > this.maxTextureUnitSeen) this.maxTextureUnitSeen = unit;
    });

    wrap("bindTexture", (target: number, tex: WebGLTexture | null) => {
      if (target !== this.gl.TEXTURE_2D) return;
      const unit = this.state.activeTexture - this.gl.TEXTURE0;
      if (unit >= 0 && unit < this.state.texture2DByUnit.length) {
        this.state.texture2DByUnit[unit] = tex;
        if (unit > this.maxTextureUnitSeen) this.maxTextureUnitSeen = unit;
      }
    });

    wrap("bindBuffer", (target: number, buffer: WebGLBuffer | null) => {
      if (target === this.gl.ARRAY_BUFFER) {
        this.state.arrayBuffer = buffer;
      }
      if (target === this.gl.ELEMENT_ARRAY_BUFFER) {
        this.state.elementArrayBuffer = buffer;
      }
    });

    wrap("enableVertexAttribArray", (index: number) => {
      if (index > this.maxAttribIndexSeen) this.maxAttribIndexSeen = index;
      const prev = this.state.attribs[index];
      if (prev) {
        prev.enabled = true;
      } else {
        this.state.attribs[index] = {
          enabled: true,
          buffer: this.state.arrayBuffer,
          size: 0,
          type: this.gl.FLOAT,
          normalized: false,
          stride: 0,
          offset: 0,
        };
      }
    });

    wrap("disableVertexAttribArray", (index: number) => {
      if (index > this.maxAttribIndexSeen) this.maxAttribIndexSeen = index;
      const prev = this.state.attribs[index];
      if (prev) prev.enabled = false;
    });

    wrap(
      "vertexAttribPointer",
      (
        index: number,
        size: number,
        type: number,
        normalized: boolean,
        stride: number,
        offset: number,
      ) => {
        if (index > this.maxAttribIndexSeen) this.maxAttribIndexSeen = index;
        const prev = this.state.attribs[index] || {
          enabled: false,
          buffer: null,
          size: 0,
          type: this.gl.FLOAT,
          normalized: false,
          stride: 0,
          offset: 0,
        };
        prev.buffer = this.state.arrayBuffer;
        prev.size = size;
        prev.type = type;
        prev.normalized = normalized;
        prev.stride = stride;
        prev.offset = offset;
        this.state.attribs[index] = prev;
      },
    );

    wrap("clearColor", (r: number, g: number, b: number, a: number) => {
      this.state.clearColor = [r, g, b, a];
    });

    wrap("clearDepth", (depth: number) => {
      this.state.clearDepth = depth;
    });

    wrap("clearStencil", (s: number) => {
      this.state.clearStencil = s;
    });

    wrap("blendColor", (r: number, g: number, b: number, a: number) => {
      this.state.blendColor = [r, g, b, a];
    });

    wrap("polygonOffset", (factor: number, units: number) => {
      this.state.polygonOffsetFactor = factor;
      this.state.polygonOffsetUnits = units;
    });

    wrap("sampleCoverage", (value: number, invert: boolean) => {
      this.state.sampleCoverageValue = value;
      this.state.sampleCoverageInvert = invert;
    });

    wrap("pixelStorei", (pname: number, value: number | boolean) => {
      if (pname === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) {
        this.state.unpackPremultiplyAlpha = value as boolean;
      } else if (pname === gl.UNPACK_ALIGNMENT) {
        this.state.unpackAlignment = value as number;
      } else if (pname === gl.UNPACK_FLIP_Y_WEBGL) {
        this.state.unpackFlipY = value as boolean;
      } else if (pname === gl.UNPACK_COLORSPACE_CONVERSION_WEBGL) {
        this.state.unpackColorspaceConversion = value as number;
      }
    });

    if (this.isWebGL2) {
      wrap("bindVertexArray", (vao: WebGLVertexArrayObject | null) => {
        this.state.vao = vao;
      });
    } else if (this.vaoExt) {
      const ext = this.vaoExt;
      const bindName = "bindVertexArrayOES";
      if (typeof ext[bindName] === "function") {
        this.orig[bindName] = ext[bindName].bind(ext);
        ext[bindName] = (vao: any) => {
          if (this.trackingEnabled) {
            this.state.vaoOES = vao;
          }
          return this.orig[bindName](vao);
        };
      }
    }

    this.installUniformWrappers(gl);
  }

  private installUniformWrappers(gl: any): void {
    const isWebGL2 = this.isWebGL2;

    const createWrapper = (
      type: string,
      original: (...args: any[]) => void,
    ) => {
      return (location: WebGLUniformLocation | null, ...args: any[]) => {
        if (!location) {
          return original(location, ...args);
        }
        if (this.trackingEnabled && this.currentProgram && location) {
          const states = this.programUniformStates.get(this.currentProgram);
          if (states) {
            let value: UniformValue | UniformValue[];
            switch (type) {
              case "1f":
                value = args[0] as number;
                break;
              case "1fv":
                value = args[0] as Float32Array;
                break;
              case "1i":
                value = args[0] as number;
                break;
              case "1iv":
                value = args[0] as Int32Array;
                break;
              case "1ui":
                value = args[0] as number;
                break;
              case "1uiv":
                value = args[0] as Uint32Array;
                break;
              case "2f":
                value = [args[0] as number, args[1] as number];
                break;
              case "2fv":
                value = args[0] as Float32Array;
                break;
              case "2i":
                value = [args[0] as number, args[1] as number];
                break;
              case "2iv":
                value = args[0] as Int32Array;
                break;
              case "2ui":
                value = [args[0] as number, args[1] as number];
                break;
              case "2uiv":
                value = args[0] as Uint32Array;
                break;
              case "3f":
                value = [
                  args[0] as number,
                  args[1] as number,
                  args[2] as number,
                ];
                break;
              case "3fv":
                value = args[0] as Float32Array;
                break;
              case "3i":
                value = [
                  args[0] as number,
                  args[1] as number,
                  args[2] as number,
                ];
                break;
              case "3iv":
                value = args[0] as Int32Array;
                break;
              case "3ui":
                value = [
                  args[0] as number,
                  args[1] as number,
                  args[2] as number,
                ];
                break;
              case "3uiv":
                value = args[0] as Uint32Array;
                break;
              case "4f":
                value = [
                  args[0] as number,
                  args[1] as number,
                  args[2] as number,
                  args[3] as number,
                ];
                break;
              case "4fv":
                value = args[0] as Float32Array;
                break;
              case "4i":
                value = [
                  args[0] as number,
                  args[1] as number,
                  args[2] as number,
                  args[3] as number,
                ];
                break;
              case "4iv":
                value = args[0] as Int32Array;
                break;
              case "4ui":
                value = [
                  args[0] as number,
                  args[1] as number,
                  args[2] as number,
                  args[3] as number,
                ];
                break;
              case "4uiv":
                value = args[0] as Uint32Array;
                break;
              case "Matrix2fv":
                value = args[1] as Float32Array;
                break;
              case "Matrix3fv":
                value = args[1] as Float32Array;
                break;
              case "Matrix4fv":
                value = args[1] as Float32Array;
                break;
              case "Matrix2x3fv":
              case "Matrix2x4fv":
              case "Matrix3x2fv":
              case "Matrix3x4fv":
              case "Matrix4x2fv":
              case "Matrix4x3fv":
                value = args[1] as Float32Array;
                break;
              default:
                break;
            }
            if (value !== undefined) {
              states.set(location, { location, type, value });
            }
          }
        }
        return original(location, ...args);
      };
    };

    const baseUniforms = [
      "1f",
      "1fv",
      "1i",
      "1iv",
      "2f",
      "2fv",
      "2i",
      "2iv",
      "3f",
      "3fv",
      "3i",
      "3iv",
      "4f",
      "4fv",
      "4i",
      "4iv",
      "Matrix2fv",
      "Matrix3fv",
      "Matrix4fv",
    ];

    for (const type of baseUniforms) {
      const methodName = `uniform${type}`;
      if (typeof gl[methodName] === "function") {
        const orig = gl[methodName].bind(gl);
        gl[methodName] = createWrapper(type, orig);
      }
    }

    if (isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      const webgl2Uniforms = [
        "1ui",
        "1uiv",
        "2ui",
        "2uiv",
        "3ui",
        "3uiv",
        "4ui",
        "4uiv",
        "Matrix2x3fv",
        "Matrix2x4fv",
        "Matrix3x2fv",
        "Matrix3x4fv",
        "Matrix4x2fv",
        "Matrix4x3fv",
      ];
      for (const type of webgl2Uniforms) {
        const methodName = `uniform${type}`;
        if (typeof gl2[methodName] === "function") {
          const orig = gl2[methodName].bind(gl2);
          gl2[methodName] = createWrapper(type, orig);
        }
      }
    }

    this.ensureSyncedFromGL();
  }

  hasVAO(): boolean {
    return this.isWebGL2 || !!this.vaoExt;
  }

  getVAOExtension(): any | null {
    return this.vaoExt;
  }

  withoutTracking<T>(fn: () => T): T {
    const prev = this.trackingEnabled;
    this.trackingEnabled = false;
    try {
      return fn();
    } finally {
      this.trackingEnabled = prev;
    }
  }

  setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled = enabled;
  }

  snapshot() {
    // 依赖跟踪的状态，不再查询 GL（性能优化）
    // 状态通过包装的 GL 函数调用自动跟踪更新
    this.setTrackingEnabled(false);
  }

  restore(): void {
    const snapshot = this.state;

    this.withoutTracking(() => {
      const orig: any = this.orig;

      if (orig.useProgram) orig.useProgram(snapshot.program);

      if (orig.bindBuffer) {
        orig.bindBuffer(this.gl.ARRAY_BUFFER, snapshot.arrayBuffer);
        orig.bindBuffer(
          this.gl.ELEMENT_ARRAY_BUFFER,
          snapshot.elementArrayBuffer,
        );
      }

      if (this.isWebGL2 && orig.bindVertexArray) {
        orig.bindVertexArray(snapshot.vao);
      } else if (this.vaoExt && this.orig.bindVertexArrayOES) {
        this.orig.bindVertexArrayOES(snapshot.vaoOES);
      }

      if (orig.bindFramebuffer)
        orig.bindFramebuffer(this.gl.FRAMEBUFFER, snapshot.framebuffer);
      if (orig.bindRenderbuffer)
        orig.bindRenderbuffer(this.gl.RENDERBUFFER, snapshot.renderbuffer);

      if (orig.activeTexture && orig.bindTexture) {
        const maxUnit =
          this.maxTextureUnitSeen >= 0
            ? Math.min(
                this.maxTextureUnitSeen + 1,
                snapshot.texture2DByUnit.length,
              )
            : snapshot.texture2DByUnit.length;

        for (let unit = 0; unit < maxUnit; unit++) {
          orig.activeTexture(this.gl.TEXTURE0 + unit);
          orig.bindTexture(this.gl.TEXTURE_2D, snapshot.texture2DByUnit[unit]);
        }
        orig.activeTexture(snapshot.activeTexture);
      }

      // 修复：即使没有绑定 VAO，也应该恢复顶点属性
      const shouldRestoreAttribs = !this.hasVAO() || snapshot.vao === null;
      if (shouldRestoreAttribs && orig.disableVertexAttribArray) {
        let max = this.maxAttribIndexSeen + 1;
        for (const k of Object.keys(snapshot.attribs)) {
          const idx = parseInt(k);
          if (idx + 1 > max) max = idx + 1;
        }
        if (max < 0) max = 0;

        for (let i = 0; i < max; i++) {
          orig.disableVertexAttribArray(i);
        }
        for (const k of Object.keys(snapshot.attribs)) {
          const idx = parseInt(k);
          const a = snapshot.attribs[idx];
          if (!a || !a.enabled) continue;
          orig.enableVertexAttribArray(idx);
          if (orig.bindBuffer) orig.bindBuffer(this.gl.ARRAY_BUFFER, a.buffer);
          orig.vertexAttribPointer(
            idx,
            a.size,
            a.type,
            a.normalized,
            a.stride,
            a.offset,
          );
        }
      }

      this.restoreUniforms();

      if (orig.viewport)
        orig.viewport(
          snapshot.viewport[0],
          snapshot.viewport[1],
          snapshot.viewport[2],
          snapshot.viewport[3],
        );

      if (snapshot.scissorEnabled) {
        if (orig.enable) orig.enable(this.gl.SCISSOR_TEST);
      } else {
        if (orig.disable) orig.disable(this.gl.SCISSOR_TEST);
      }
      if (orig.scissor)
        orig.scissor(
          snapshot.scissorBox[0],
          snapshot.scissorBox[1],
          snapshot.scissorBox[2],
          snapshot.scissorBox[3],
        );

      if (snapshot.blendEnabled) {
        if (orig.enable) orig.enable(this.gl.BLEND);
      } else {
        if (orig.disable) orig.disable(this.gl.BLEND);
      }
      if (snapshot.depthTestEnabled) {
        if (orig.enable) orig.enable(this.gl.DEPTH_TEST);
      } else {
        if (orig.disable) orig.disable(this.gl.DEPTH_TEST);
      }
      if (snapshot.stencilTestEnabled) {
        if (orig.enable) orig.enable(this.gl.STENCIL_TEST);
      } else {
        if (orig.disable) orig.disable(this.gl.STENCIL_TEST);
      }
      if (snapshot.cullFaceEnabled) {
        if (orig.enable) orig.enable(this.gl.CULL_FACE);
      } else {
        if (orig.disable) orig.disable(this.gl.CULL_FACE);
      }

      if (orig.blendFuncSeparate) {
        orig.blendFuncSeparate(
          snapshot.blendSrcRGB,
          snapshot.blendDstRGB,
          snapshot.blendSrcAlpha,
          snapshot.blendDstAlpha,
        );
      } else if (orig.blendFunc) {
        orig.blendFunc(snapshot.blendSrcRGB, snapshot.blendDstRGB);
      }
      if (orig.blendEquationSeparate) {
        orig.blendEquationSeparate(snapshot.blendEqRGB, snapshot.blendEqAlpha);
      } else if (orig.blendEquation) {
        orig.blendEquation(snapshot.blendEqRGB);
      }

      if (orig.depthFunc) orig.depthFunc(snapshot.depthFunc);
      if (orig.depthMask) orig.depthMask(snapshot.depthMask);
      if (orig.stencilMask) orig.stencilMask(snapshot.stencilWriteMask);
      if (orig.cullFace) orig.cullFace(snapshot.cullFaceMode);
      if (orig.frontFace) orig.frontFace(snapshot.frontFace);
      if (orig.colorMask)
        orig.colorMask(
          snapshot.colorMask[0],
          snapshot.colorMask[1],
          snapshot.colorMask[2],
          snapshot.colorMask[3],
        );
      if (orig.clearColor)
        orig.clearColor(
          snapshot.clearColor[0],
          snapshot.clearColor[1],
          snapshot.clearColor[2],
          snapshot.clearColor[3],
        );
      if (orig.clearDepth) orig.clearDepth(snapshot.clearDepth);
      if (orig.clearStencil) orig.clearStencil(snapshot.clearStencil);
      if (orig.blendColor)
        orig.blendColor(
          snapshot.blendColor[0],
          snapshot.blendColor[1],
          snapshot.blendColor[2],
          snapshot.blendColor[3],
        );

      if (snapshot.ditherEnabled) {
        if (orig.enable) orig.enable(this.gl.DITHER);
      } else {
        if (orig.disable) orig.disable(this.gl.DITHER);
      }

      if (snapshot.polygonOffsetFillEnabled) {
        if (orig.enable) orig.enable(this.gl.POLYGON_OFFSET_FILL);
      } else {
        if (orig.disable) orig.disable(this.gl.POLYGON_OFFSET_FILL);
      }
      if (orig.polygonOffset)
        orig.polygonOffset(
          snapshot.polygonOffsetFactor,
          snapshot.polygonOffsetUnits,
        );

      if (snapshot.sampleCoverageEnabled) {
        if (orig.enable) orig.enable(this.gl.SAMPLE_COVERAGE);
      } else {
        if (orig.disable) orig.disable(this.gl.SAMPLE_COVERAGE);
      }
      if (orig.sampleCoverage)
        orig.sampleCoverage(
          snapshot.sampleCoverageValue,
          snapshot.sampleCoverageInvert,
        );

      // Restore pixelStorei states (tracked for safe section texture uploads)
      if (orig.pixelStorei) {
        if (orig.pixelStorei) {
          orig.pixelStorei(
            this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
            snapshot.unpackPremultiplyAlpha,
          );
        }
        if (orig.pixelStorei) {
          orig.pixelStorei(
            this.gl.UNPACK_ALIGNMENT,
            snapshot.unpackAlignment,
          );
        }
        if (orig.pixelStorei) {
          orig.pixelStorei(
            this.gl.UNPACK_FLIP_Y_WEBGL,
            snapshot.unpackFlipY,
          );
        }
        if (orig.pixelStorei) {
          orig.pixelStorei(
            this.gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
            snapshot.unpackColorspaceConversion,
          );
        }
      }
    });

    this.setTrackingEnabled(true);
  }

  restoreUniforms(): void {
    const states = this.programUniformStates.get(this.currentProgram);
    if (!states) return;
    const orig = this.orig;

    for (const { location, type, value } of states.values()) {
      if (!location) continue;

      switch (type) {
        case "1f":
          if (orig.uniform1f) orig.uniform1f(location, value as number);
          break;
        case "1fv":
          if (orig.uniform1fv)
            orig.uniform1fv(location, value as Float32Array | number[]);
          break;
        case "1i":
          if (orig.uniform1i) orig.uniform1i(location, value as number);
          break;
        case "1iv":
          if (orig.uniform1iv)
            orig.uniform1iv(location, value as Int32Array | number[]);
          break;
        case "2f":
          if (orig.uniform2f)
            orig.uniform2f(
              location,
              (value as number[])[0],
              (value as number[])[1],
            );
          break;
        case "2fv":
          if (orig.uniform2fv)
            orig.uniform2fv(location, value as Float32Array | number[]);
          break;
        case "2i":
          if (orig.uniform2i)
            orig.uniform2i(
              location,
              (value as number[])[0],
              (value as number[])[1],
            );
          break;
        case "2iv":
          if (orig.uniform2iv)
            orig.uniform2iv(location, value as Int32Array | number[]);
          break;
        case "3f":
          if (orig.uniform3f)
            orig.uniform3f(
              location,
              (value as number[])[0],
              (value as number[])[1],
              (value as number[])[2],
            );
          break;
        case "3fv":
          if (orig.uniform3fv)
            orig.uniform3fv(location, value as Float32Array | number[]);
          break;
        case "3i":
          if (orig.uniform3i)
            orig.uniform3i(
              location,
              (value as number[])[0],
              (value as number[])[1],
              (value as number[])[2],
            );
          break;
        case "3iv":
          if (orig.uniform3iv)
            orig.uniform3iv(location, value as Int32Array | number[]);
          break;
        case "4f":
          if (orig.uniform4f)
            orig.uniform4f(
              location,
              (value as number[])[0],
              (value as number[])[1],
              (value as number[])[2],
              (value as number[])[3],
            );
          break;
        case "4fv":
          if (orig.uniform4fv)
            orig.uniform4fv(location, value as Float32Array | number[]);
          break;
        case "4i":
          if (orig.uniform4i)
            orig.uniform4i(
              location,
              (value as number[])[0],
              (value as number[])[1],
              (value as number[])[2],
              (value as number[])[3],
            );
          break;
        case "4iv":
          if (orig.uniform4iv)
            orig.uniform4iv(location, value as Int32Array | number[]);
          break;
        case "Matrix2fv":
          if (orig.uniformMatrix2fv)
            orig.uniformMatrix2fv(
              location,
              false,
              value as Float32Array | number[],
            );
          break;
        case "Matrix3fv":
          if (orig.uniformMatrix3fv)
            orig.uniformMatrix3fv(
              location,
              false,
              value as Float32Array | number[],
            );
          break;
        case "Matrix4fv":
          if (orig.uniformMatrix4fv)
            orig.uniformMatrix4fv(
              location,
              false,
              value as Float32Array | number[],
            );
          break;
        case "Matrix2x3fv":
        case "Matrix2x4fv":
        case "Matrix3x2fv":
        case "Matrix3x4fv":
        case "Matrix4x2fv":
        case "Matrix4x3fv":
          const matrixFn = `uniform${type}` as keyof typeof orig;
          if (orig[matrixFn])
            (orig[matrixFn] as Function)(
              location,
              false,
              value as Float32Array | number[],
            );
          break;
        default:
          break;
      }
    }
  }

  ensureSyncedFromGL(): void {
    if (this.syncedFromGL) return;
    this.state = this.readFromGL();
    this.syncedFromGL = true;
    this.updateSeenRanges();
  }

  private updateSeenRanges(): void {
    this.maxTextureUnitSeen = this.state.texture2DByUnit.length - 1;
    for (const k of Object.keys(this.state.attribs)) {
      const idx = parseInt(k);
      if (idx > this.maxAttribIndexSeen) this.maxAttribIndexSeen = idx;
    }
  }

  private readFromGL(): GLInnerState {
    const gl: any = this.gl as any;

    return this.withoutTracking(() => {
      const orig: any = this.orig;

      const program = orig.getParameter
        ? orig.getParameter(gl.CURRENT_PROGRAM)
        : gl.getParameter(gl.CURRENT_PROGRAM);
      const framebuffer = orig.getParameter
        ? orig.getParameter(gl.FRAMEBUFFER_BINDING)
        : gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const renderbuffer = orig.getParameter
        ? orig.getParameter(gl.RENDERBUFFER_BINDING)
        : gl.getParameter(gl.RENDERBUFFER_BINDING);

      const viewportP = orig.getParameter
        ? orig.getParameter(gl.VIEWPORT)
        : gl.getParameter(gl.VIEWPORT);
      const scissorEnabled = orig.isEnabled
        ? orig.isEnabled(gl.SCISSOR_TEST)
        : gl.isEnabled(gl.SCISSOR_TEST);
      const scissorBoxP = orig.getParameter
        ? orig.getParameter(gl.SCISSOR_BOX)
        : gl.getParameter(gl.SCISSOR_BOX);

      const blendEnabled = orig.isEnabled
        ? orig.isEnabled(gl.BLEND)
        : gl.isEnabled(gl.BLEND);
      const blendSrcRGB = orig.getParameter
        ? orig.getParameter(gl.BLEND_SRC_RGB)
        : gl.getParameter(gl.BLEND_SRC_RGB);
      const blendDstRGB = orig.getParameter
        ? orig.getParameter(gl.BLEND_DST_RGB)
        : gl.getParameter(gl.BLEND_DST_RGB);
      const blendSrcAlpha = orig.getParameter
        ? orig.getParameter(gl.BLEND_SRC_ALPHA)
        : gl.getParameter(gl.BLEND_SRC_ALPHA);
      const blendDstAlpha = orig.getParameter
        ? orig.getParameter(gl.BLEND_DST_ALPHA)
        : gl.getParameter(gl.BLEND_DST_ALPHA);
      const blendEqRGB = orig.getParameter
        ? orig.getParameter(gl.BLEND_EQUATION_RGB)
        : gl.getParameter(gl.BLEND_EQUATION_RGB);
      const blendEqAlpha = orig.getParameter
        ? orig.getParameter(gl.BLEND_EQUATION_ALPHA)
        : gl.getParameter(gl.BLEND_EQUATION_ALPHA);

      const depthTestEnabled = orig.isEnabled
        ? orig.isEnabled(gl.DEPTH_TEST)
        : gl.isEnabled(gl.DEPTH_TEST);
      const depthFunc = orig.getParameter
        ? orig.getParameter(gl.DEPTH_FUNC)
        : gl.getParameter(gl.DEPTH_FUNC);
      const depthMask = orig.getParameter
        ? orig.getParameter(gl.DEPTH_WRITEMASK)
        : gl.getParameter(gl.DEPTH_WRITEMASK);
      const stencilTestEnabled = orig.isEnabled
        ? orig.isEnabled(gl.STENCIL_TEST)
        : gl.isEnabled(gl.STENCIL_TEST);
      const stencilWriteMask = orig.getParameter
        ? orig.getParameter(gl.STENCIL_WRITEMASK)
        : gl.getParameter(gl.STENCIL_WRITEMASK);
      const cullFaceEnabled = orig.isEnabled
        ? orig.isEnabled(gl.CULL_FACE)
        : gl.isEnabled(gl.CULL_FACE);
      const cullFaceMode = orig.getParameter
        ? orig.getParameter(gl.CULL_FACE_MODE)
        : gl.getParameter(gl.CULL_FACE_MODE);
      const frontFace = orig.getParameter
        ? orig.getParameter(gl.FRONT_FACE)
        : gl.getParameter(gl.FRONT_FACE);

      const colorMaskP = orig.getParameter
        ? orig.getParameter(gl.COLOR_WRITEMASK)
        : gl.getParameter(gl.COLOR_WRITEMASK);

      const arrayBuffer = orig.getParameter
        ? orig.getParameter(gl.ARRAY_BUFFER_BINDING)
        : gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      const elementArrayBuffer = orig.getParameter
        ? orig.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)
        : gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);

      const activeTexture = orig.getParameter
        ? orig.getParameter(gl.ACTIVE_TEXTURE)
        : gl.getParameter(gl.ACTIVE_TEXTURE);
      const maxUnits =
        (orig.getParameter
          ? orig.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)
          : gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)) || 32;
      const texture2DByUnit: Array<WebGLTexture | null> = new Array(
        Math.max(1, maxUnits),
      ).fill(null);

      if (orig.activeTexture) {
        for (let unit = 0; unit < texture2DByUnit.length; unit++) {
          orig.activeTexture(gl.TEXTURE0 + unit);
          texture2DByUnit[unit] = orig.getParameter
            ? orig.getParameter(gl.TEXTURE_BINDING_2D)
            : gl.getParameter(gl.TEXTURE_BINDING_2D);
        }
        orig.activeTexture(activeTexture);
      }

      let vao: WebGLVertexArrayObject | null = null;
      let vaoOES: any = null;
      if (this.isWebGL2) {
        const bindingEnum = (gl as any).VERTEX_ARRAY_BINDING;
        if (typeof bindingEnum === "number") {
          vao = orig.getParameter
            ? orig.getParameter(bindingEnum)
            : gl.getParameter(bindingEnum);
        }
      } else if (
        this.vaoExt &&
        typeof this.vaoExt.VERTEX_ARRAY_BINDING_OES === "number"
      ) {
        vaoOES = orig.getParameter
          ? orig.getParameter(this.vaoExt.VERTEX_ARRAY_BINDING_OES)
          : gl.getParameter(this.vaoExt.VERTEX_ARRAY_BINDING_OES);
      }

      const attribs: Record<number, AttribPointerState> = {};
      // 修复：即使支持 VAO，如果当前没有绑定 VAO，也应该查询顶点属性
      const shouldQueryAttribs = !this.hasVAO() || vao === null;

      if (shouldQueryAttribs) {
        const maxAttribs =
          (orig.getParameter
            ? orig.getParameter(gl.MAX_VERTEX_ATTRIBS)
            : gl.getParameter(gl.MAX_VERTEX_ATTRIBS)) || 0;
        for (let i = 0; i < maxAttribs; i++) {
          const enabled = orig.getVertexAttrib
            ? orig.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED)
            : gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED);
          if (!enabled) continue;
          attribs[i] = {
            enabled: true,
            buffer: orig.getVertexAttrib
              ? orig.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)
              : gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
            size: orig.getVertexAttrib
              ? orig.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_SIZE)
              : gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_SIZE),
            type: orig.getVertexAttrib
              ? orig.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_TYPE)
              : gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_TYPE),
            normalized: orig.getVertexAttrib
              ? orig.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED)
              : gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
            stride: orig.getVertexAttrib
              ? orig.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_STRIDE)
              : gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
            offset: orig.getVertexAttribOffset
              ? orig.getVertexAttribOffset(i, gl.VERTEX_ATTRIB_ARRAY_POINTER)
              : gl.getVertexAttribOffset(i, gl.VERTEX_ATTRIB_ARRAY_POINTER),
          };
        }
      }

      return {
        program,
        framebuffer,
        renderbuffer,
        viewport: [viewportP[0], viewportP[1], viewportP[2], viewportP[3]],
        scissorEnabled,
        scissorBox: [
          scissorBoxP[0],
          scissorBoxP[1],
          scissorBoxP[2],
          scissorBoxP[3],
        ],
        blendEnabled,
        blendSrcRGB,
        blendDstRGB,
        blendSrcAlpha,
        blendDstAlpha,
        blendEqRGB,
        blendEqAlpha,
        depthTestEnabled,
        depthFunc,
        depthMask,
        stencilTestEnabled,
        stencilMask: stencilWriteMask,
        stencilWriteMask,
        cullFaceEnabled,
        cullFaceMode,
        frontFace,
        colorMask: [colorMaskP[0], colorMaskP[1], colorMaskP[2], colorMaskP[3]],
        activeTexture,
        texture2DByUnit,
        arrayBuffer,
        elementArrayBuffer,
        vao,
        vaoOES,
        attribs,
        uniformState: [],
        clearColor: [0, 0, 0, 0],
        clearDepth: 1,
        clearStencil: 0,
        blendColor: [0, 0, 0, 0],
        ditherEnabled: true,
        polygonOffsetFillEnabled: false,
        polygonOffsetFactor: 0,
        polygonOffsetUnits: 0,
        sampleCoverageEnabled: false,
        sampleCoverageValue: 1,
        sampleCoverageInvert: false,
        // pixelStorei defaults per WebGL spec
        unpackPremultiplyAlpha: false,
        unpackAlignment: 4,
        unpackFlipY: false,
        unpackColorspaceConversion: gl.BROWSER_DEFAULT_WEBGL,
      };
    });
  }

  getCurrentProgram(): WebGLProgram | null {
    return this.currentProgram;
  }

  isInstalled(): boolean {
    return this.installed;
  }
}
