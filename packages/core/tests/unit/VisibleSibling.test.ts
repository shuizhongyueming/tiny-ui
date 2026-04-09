import { describe, it, expect, vi, beforeEach } from "vitest";
import { Container } from "../../src/Container";
import { Bitmap } from "../../src/Bitmap";
import { DisplayObject } from "../../src/DisplayObject";
import type TinyUI from "../../src/TinyUI";

describe("Visible Sibling Test", () => {
  // 创建更完整的 mockApp
  const createMockApp = () => {
    return {
      root: null as Container | null,
      render: vi.fn(),
      textureManager: {
        loadImage: vi.fn(),
        createImageTexture: vi.fn(),
        createCanvasTexture: vi.fn(),
      },
      gl: {
        createTexture: vi.fn(() => ({})),
        bindTexture: vi.fn(),
        texImage2D: vi.fn(),
        texParameteri: vi.fn(),
        deleteTexture: vi.fn(),
        activeTexture: vi.fn(),
        uniform1i: vi.fn(),
        uniformMatrix3fv: vi.fn(),
        viewport: vi.fn(),
        clear: vi.fn(),
        clearColor: vi.fn(),
        useProgram: vi.fn(),
        enable: vi.fn(),
        blendFunc: vi.fn(),
        drawElements: vi.fn(),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        bindFramebuffer: vi.fn(),
        getParameter: vi.fn(),
        ARRAY_BUFFER: 34962,
        ELEMENT_ARRAY_BUFFER: 34963,
        TEXTURE_2D: 3553,
        TEXTURE0: 33984,
        TRIANGLES: 4,
        UNSIGNED_SHORT: 5123,
        FLOAT: 5126,
        COLOR_BUFFER_BIT: 16384,
        BLEND: 3042,
        ONE: 1,
        ONE_MINUS_SRC_ALPHA: 771,
        STATIC_DRAW: 35044,
        FRAMEBUFFER: 36160,
      },
      enqueueGLTask: vi.fn((task) => task()),
      _setBufferData: vi.fn(),
      _useTextureLocation: {},
      _imageLocation: {},
      matrixLocation: {},
      resolutionLocation: {},
    } as unknown as TinyUI;
  };

  let mockApp: TinyUI;

  beforeEach(() => {
    mockApp = createMockApp();
  });

  it("should not affect sibling visibility when setting visible=false", () => {
    // 创建 root 容器
    const root = new Container(mockApp, "root");
    
    // 创建 btn (模拟 Bitmap)
    const btn = new Bitmap(mockApp, "btn");
    btn.visible = true;
    
    // 创建 popup (Container)
    const popup = new Container(mockApp, "popup");
    popup.visible = true;
    
    // 将两者都添加到 root
    root.addChild(btn);
    root.addChild(popup);
    
    // 验证初始状态
    expect(root.children.length).toBe(2);
    expect(root.children[0]).toBe(btn);
    expect(root.children[1]).toBe(popup);
    expect(btn.visible).toBe(true);
    expect(popup.visible).toBe(true);
    
    // 设置 btn.visible = false
    btn.visible = false;
    
    // 验证 popup 的 visible 仍然是 true
    expect(btn.visible).toBe(false);
    expect(popup.visible).toBe(true);
    expect(root.children.length).toBe(2);
    expect(root.children[0]).toBe(btn);
    expect(root.children[1]).toBe(popup);
  });

  it("should verify children array is not shared between siblings", () => {
    const root = new Container(mockApp, "root");
    const btn = new Bitmap(mockApp, "btn");
    const popup = new Container(mockApp, "popup");
    
    root.addChild(btn);
    root.addChild(popup);
    
    // 验证每个节点的 children 是独立的
    // Bitmap 继承自 DisplayObject，children 应该是 null
    expect((btn as any).children).toBeNull();
    
    // Container 的 children 是数组
    expect(Array.isArray((popup as any).children)).toBe(true);
    expect((popup as any).children.length).toBe(0);
    
    // root 的 children 包含 btn 和 popup
    expect(root.children.length).toBe(2);
    expect(root.children).toContain(btn);
    expect(root.children).toContain(popup);
  });

  it("should handle render tree correctly with visible siblings", () => {
    const root = new Container(mockApp, "root");
    const btn = new Bitmap(mockApp, "btn");
    const popup = new Container(mockApp, "popup");
    
    // 给 Bitmap 设置一个纹理以避免渲染时返回
    (btn as any).texture = {};
    (btn as any).source = {};
    btn.setWidth(100);
    btn.setHeight(100);
    
    root.addChild(btn);
    root.addChild(popup);
    
    // 模拟 _renderTree 的核心逻辑
    const renderNode = (node: DisplayObject, visited: string[]) => {
      if (!node.visible) return;
      visited.push(node.name);
      
      if ("children" in node && Array.isArray((node as any).children)) {
        const children = (node as any).children as DisplayObject[];
        for (const child of children) {
          renderNode(child, visited);
        }
      }
    };
    
    // 测试 1: 两者都可见
    btn.visible = true;
    popup.visible = true;
    const visited1: string[] = [];
    renderNode(root, visited1);
    expect(visited1).toContain("btn");
    expect(visited1).toContain("popup");
    
    // 测试 2: btn 不可见
    btn.visible = false;
    popup.visible = true;
    const visited2: string[] = [];
    renderNode(root, visited2);
    expect(visited2).not.toContain("btn");
    expect(visited2).toContain("popup");
  });

  it("should verify addChild order is correct", () => {
    const root = new Container(mockApp, "root");
    const btn = new Bitmap(mockApp, "btn");
    const popup = new Container(mockApp, "popup");
    
    root.addChild(btn);
    root.addChild(popup);
    
    // 验证添加顺序
    expect(root.children[0].name).toBe("btn");
    expect(root.children[1].name).toBe("popup");
    
    // 验证 parent 引用
    expect(btn.parent).toBe(root);
    expect(popup.parent).toBe(root);
  });
});
