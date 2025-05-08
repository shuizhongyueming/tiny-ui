type UniformValue = number | number[] | Float32Array | Int32Array;

export interface UniformState {
  location: WebGLUniformLocation;
  type: string; // '1f', '2fv', '3i', 'Matrix4fv' 等
  value: UniformValue | UniformValue[];
}

export interface VertexAttributeState {
  location: any;
  enabled: any;
  buffer: any;
  size: any;
  type: any;
  normalized: any;
  stride: any;
  offset: number;
}

interface GlState {
  activeAttributes: any;
  program?: any;
  activeTexture?: any;
  texture2D?: any;
  arrayBuffer?: any;
  elementArrayBuffer?: any;
  blendEnabled?: boolean;
  blendSrc?: any;
  blendDst?: any;
  viewport?: any;
  vertexAttribState?:  VertexAttributeState[];
  uniformState?: UniformState[];
  scissorTestEnabled?: boolean;
  scissorBox?: any;
  depthTestEnabled?: boolean;
  depthFunc?: any;
  depthMask?: any;
  stencilTestEnabled?: boolean;
  stencilMask?: any;
  colorMask?: any;
  clearColor?: any;
  clearDepth?: any;
  clearStencil?: any;
  blendColor?: any;
  cullFaceEnabled?: boolean;
  cullFaceMode?: any;
  frontFace?: any;
  ditherEnabled?: boolean;
  polygonOffsetFillEnabled?: boolean;
  polygonOffsetFactor?: any;
  polygonOffsetUnits?: any;
  sampleCoverageEnabled?: boolean;
  sampleCoverageValue?: any;
  sampleCoverageInvert?: any;
}

let savedState: GlState;

interface StashGlStateParam {
  gl: WebGLRenderingContext;
  vertexAttribState?: VertexAttributeState[];
  uniformState?: UniformState[];
}

export function restoreUniformStates(
  gl: WebGLRenderingContext,
  states: UniformState[],
): void {
  states.forEach((state) => {
    const { location, type, value } = state;

    switch (type) {
      case "1f":
        gl.uniform1f(location, value as number);
        break;
      case "1fv":
        gl.uniform1fv(location, value as Float32Array | number[]);
        break;
      case "1i":
        gl.uniform1i(location, value as number);
        break;
      case "1iv":
        gl.uniform1iv(location, value as Int32Array | number[]);
        break;

      case "2f":
        gl.uniform2f(location, (value as number[])[0], (value as number[])[1]);
        break;
      case "2fv":
        gl.uniform2fv(location, value as Float32Array | number[]);
        break;
      case "2i":
        gl.uniform2i(location, (value as number[])[0], (value as number[])[1]);
        break;
      case "2iv":
        gl.uniform2iv(location, value as Int32Array | number[]);
        break;

      case "3f":
        gl.uniform3f(
          location,
          (value as number[])[0],
          (value as number[])[1],
          (value as number[])[2],
        );
        break;
      case "3fv":
        gl.uniform3fv(location, value as Float32Array | number[]);
        break;
      case "3i":
        gl.uniform3i(
          location,
          (value as number[])[0],
          (value as number[])[1],
          (value as number[])[2],
        );
        break;
      case "3iv":
        gl.uniform3iv(location, value as Int32Array | number[]);
        break;

      case "4f":
        gl.uniform4f(
          location,
          (value as number[])[0],
          (value as number[])[1],
          (value as number[])[2],
          (value as number[])[3],
        );
        break;
      case "4fv":
        gl.uniform4fv(location, value as Float32Array | number[]);
        break;
      case "4i":
        gl.uniform4i(
          location,
          (value as number[])[0],
          (value as number[])[1],
          (value as number[])[2],
          (value as number[])[3],
        );
        break;
      case "4iv":
        gl.uniform4iv(location, value as Int32Array | number[]);
        break;

      case "Matrix2fv":
        gl.uniformMatrix2fv(location, false, value as Float32Array | number[]);
        break;
      case "Matrix3fv":
        gl.uniformMatrix3fv(location, false, value as Float32Array | number[]);
        break;
      case "Matrix4fv":
        gl.uniformMatrix4fv(location, false, value as Float32Array | number[]);
        break;
    }
  });
}


export const stashGlState = ({gl, vertexAttribState, uniformState}: StashGlStateParam) => {

    // 保存关键状态
    savedState = {
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
      vertexAttribState,
      uniformState,

      // 添加剪裁状态
      scissorTestEnabled: gl.isEnabled(gl.SCISSOR_TEST),
      scissorBox: gl.getParameter(gl.SCISSOR_BOX),

      // 添加深度测试状态
      depthTestEnabled: gl.isEnabled(gl.DEPTH_TEST),
      depthFunc: gl.getParameter(gl.DEPTH_FUNC),
      depthMask: gl.getParameter(gl.DEPTH_WRITEMASK),

      // 添加模板测试状态
      stencilTestEnabled: gl.isEnabled(gl.STENCIL_TEST),
      stencilMask: gl.getParameter(gl.STENCIL_WRITEMASK),

      // 保存颜色掩码
      colorMask: gl.getParameter(gl.COLOR_WRITEMASK),

      // 保存缓冲区清除值
      clearColor: gl.getParameter(gl.COLOR_CLEAR_VALUE),
      clearDepth: gl.getParameter(gl.DEPTH_CLEAR_VALUE),
      clearStencil: gl.getParameter(gl.STENCIL_CLEAR_VALUE),

      // 保存混合颜色
      blendColor: gl.getParameter(gl.BLEND_COLOR),

      // 保存剔除面状态
      cullFaceEnabled: gl.isEnabled(gl.CULL_FACE),
      cullFaceMode: gl.getParameter(gl.CULL_FACE_MODE),
      frontFace: gl.getParameter(gl.FRONT_FACE),

      // 保存抖动状态
      ditherEnabled: gl.isEnabled(gl.DITHER),

      // 保存多边形偏移
      polygonOffsetFillEnabled: gl.isEnabled(gl.POLYGON_OFFSET_FILL),
      polygonOffsetFactor: gl.getParameter(gl.POLYGON_OFFSET_FACTOR),
      polygonOffsetUnits: gl.getParameter(gl.POLYGON_OFFSET_UNITS),

      // 保存采样覆盖
      sampleCoverageEnabled: gl.isEnabled(gl.SAMPLE_COVERAGE),
      sampleCoverageValue: gl.getParameter(gl.SAMPLE_COVERAGE_VALUE),
      sampleCoverageInvert: gl.getParameter(gl.SAMPLE_COVERAGE_INVERT),

      activeAttributes: [],
    };

    // 获取活跃顶点属性的数量
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    for (let i = 0; i < maxVertexAttribs; i++) {
      if (gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED)) {
        savedState.activeAttributes.push({
          index: i,
          enabled: true,
          buffer: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
          size: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_SIZE),
          type: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_TYPE),
          normalized: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
          stride: gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
          offset: gl.getVertexAttribOffset(i, gl.VERTEX_ATTRIB_ARRAY_POINTER),
        });
      }
    }

  }


interface RestoreGlStateParam {
  gl: WebGLRenderingContext;
}
export const restoreGlState = ({ gl }: RestoreGlStateParam) => {

  // 恢复着色器程序
  gl.useProgram(savedState.program);

  // 恢复缓冲区绑定
  gl.bindBuffer(gl.ARRAY_BUFFER, savedState.arrayBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, savedState.elementArrayBuffer);

  // 恢复纹理状态
  gl.activeTexture(savedState.activeTexture);
  gl.bindTexture(gl.TEXTURE_2D, savedState.texture2D);

  // 恢复顶点属性状态
  if (savedState.vertexAttribState) {
    for (const attr of savedState.vertexAttribState) {
      const { location, ...state } = attr;

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
          state.offset,
        );
      }
    }
  }

  // 恢复所有顶点属性
  if (savedState.activeAttributes) {
    // 先禁用所有顶点属性
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    for (let i = 0; i < maxVertexAttribs; i++) {
      gl.disableVertexAttribArray(i);
    }

    // 然后恢复保存的活跃顶点属性
    for (const attr of savedState.activeAttributes) {
      gl.enableVertexAttribArray(attr.index);
      gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer);
      gl.vertexAttribPointer(
        attr.index,
        attr.size,
        attr.type,
        attr.normalized,
        attr.stride,
        attr.offset,
      );
    }
  }

  if (savedState.uniformState) {
    restoreUniformStates(gl, savedState.uniformState);
  }

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
    savedState.viewport[3],
  );

  // 恢复剪裁测试状态
  if (savedState.scissorTestEnabled) {
    gl.enable(gl.SCISSOR_TEST);
  } else {
    gl.disable(gl.SCISSOR_TEST);
  }
  gl.scissor(
    savedState.scissorBox[0],
    savedState.scissorBox[1],
    savedState.scissorBox[2],
    savedState.scissorBox[3],
  );

  // 恢复深度测试状态
  if (savedState.depthTestEnabled) {
    gl.enable(gl.DEPTH_TEST);
  } else {
    gl.disable(gl.DEPTH_TEST);
  }
  gl.depthFunc(savedState.depthFunc);
  gl.depthMask(savedState.depthMask);

  // 恢复模板测试状态
  if (savedState.stencilTestEnabled) {
    gl.enable(gl.STENCIL_TEST);
  } else {
    gl.disable(gl.STENCIL_TEST);
  }
  gl.stencilMask(savedState.stencilMask);

  // 恢复颜色掩码
  gl.colorMask(
    savedState.colorMask[0],
    savedState.colorMask[1],
    savedState.colorMask[2],
    savedState.colorMask[3],
  );

  // 恢复清除值
  gl.clearColor(
    savedState.clearColor[0],
    savedState.clearColor[1],
    savedState.clearColor[2],
    savedState.clearColor[3],
  );
  gl.clearDepth(savedState.clearDepth);
  gl.clearStencil(savedState.clearStencil);

  // 恢复混合颜色
  gl.blendColor(
    savedState.blendColor[0],
    savedState.blendColor[1],
    savedState.blendColor[2],
    savedState.blendColor[3],
  );

  // 恢复剔除面
  if (savedState.cullFaceEnabled) {
    gl.enable(gl.CULL_FACE);
  } else {
    gl.disable(gl.CULL_FACE);
  }
  gl.cullFace(savedState.cullFaceMode);
  gl.frontFace(savedState.frontFace);

  // 恢复抖动
  if (savedState.ditherEnabled) {
    gl.enable(gl.DITHER);
  } else {
    gl.disable(gl.DITHER);
  }

  // 恢复多边形偏移
  if (savedState.polygonOffsetFillEnabled) {
    gl.enable(gl.POLYGON_OFFSET_FILL);
  } else {
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  gl.polygonOffset(
    savedState.polygonOffsetFactor,
    savedState.polygonOffsetUnits,
  );

  // 恢复采样覆盖
  if (savedState.sampleCoverageEnabled) {
    gl.enable(gl.SAMPLE_COVERAGE);
  } else {
    gl.disable(gl.SAMPLE_COVERAGE);
  }
  gl.sampleCoverage(
    savedState.sampleCoverageValue,
    savedState.sampleCoverageInvert,
  );

  // 最后再次绑定原始数组缓冲区，确保一致性
  gl.bindBuffer(gl.ARRAY_BUFFER, savedState.arrayBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, savedState.elementArrayBuffer);
}
