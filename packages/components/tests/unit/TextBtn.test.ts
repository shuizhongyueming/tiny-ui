import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TinyUI, Container, Graphics, Text } from "@shuizhongyueming/tiny-ui-core";
import { TextBtn } from "../../src/TextBtn";

// Mock TinyUI factory function
function createMockTinyUI(): TinyUI {
  const mockEventListeners = new Map();
  let capture: any;
  const event = (type: string) => ({ type, identifier: 1, originalEvent: {}, x: 0, y: 0,
    stopPropagation: vi.fn(), stop: vi.fn(), markHandled: vi.fn() });
  return {
    viewportWidth: 750,
    viewportHeight: 1334,
    stageWidth: 750,
    stageHeight: 1334,
    root: {
      addChild: vi.fn(),
      removeChild: vi.fn(),
      children: [],
    } as unknown as Container,
    createContainer: vi.fn((name: string) => ({
      name,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      scaleX: 1,
      scaleY: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      alpha: 1,
      visible: true,
      addChild: vi.fn(),
      removeChild: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(() => () => {}),
      hitTest: vi.fn(() => true),
      getGlobalTransformMatrix: vi.fn(() => ({ invert: () => ({ transformPoint: (x: number, y: number) => ({ x, y }) }) })),
      setSize: vi.fn(function(this: any, width: number, height?: number) {
        this.width = width;
        this.height = height === undefined ? width : height;
      }),
      scaleTo: vi.fn(function(this: any, scale: number) {
        this.scaleX = scale;
        this.scaleY = scale;
      }),
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!mockEventListeners.has(event)) {
          mockEventListeners.set(event, []);
        }
        mockEventListeners.get(event).push(handler);
      }),
      _triggerEvent: (event: string, data?: any) => {
        const handlers = mockEventListeners.get(event) || [];
        handlers.forEach((h: Function) => h(data || { stopPropagation: vi.fn(), x: 0, y: 0 }));
      },
    })),
    createGraphics: vi.fn((name?: string) => ({
      name,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      alpha: 1,
      drawRect: vi.fn(),
      drawRoundedRect: vi.fn(),
      clear: vi.fn(),
      addChild: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!mockEventListeners.has(event)) {
          mockEventListeners.set(event, []);
        }
        mockEventListeners.get(event).push(handler);
      }),
      _triggerEvent: (event: string, data?: any) => {
        const handlers = mockEventListeners.get(event) || [];
        handlers.forEach((h: Function) => h(data || { stopPropagation: vi.fn(), x: 0, y: 0 }));
      },
    })),
    createText: vi.fn((text: string, name?: string) => ({
      name: name || "text",
      text,
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      alpha: 1,
      fontSize: 14,
      fontWeight: "normal",
      color: "#000000",
      align: "left",
      updateTexture: vi.fn(),
      addChild: vi.fn(),
      removeChild: vi.fn(),
    })),
    _event: event,
    eventManager: { addEventObserver: vi.fn((fn: any) => { capture = fn; return () => {}; }) },
    addTick: vi.fn(),
    removeTick: vi.fn(),
    render: vi.fn(),
    setAutoRender: vi.fn(),
    patchRender: vi.fn(),
    enqueueGLTask: vi.fn(),
    createImage: vi.fn(),
    createBitmap: vi.fn(),
    createAnimation: vi.fn(),
  } as unknown as TinyUI;
}

describe("TextBtn", () => {
  let mockApp: TinyUI;

  beforeEach(() => {
    mockApp = createMockTinyUI();
  });

  describe("Basic Creation", () => {
    it("should create button with default values", () => {
      const result = TextBtn({
        app: mockApp,
        text: "Click Me",
      });

      expect(result).toBeDefined();
      expect(result.container).toBeDefined();
      expect(mockApp.createContainer).toHaveBeenCalledWith("TextBtn/Container");
      expect(mockApp.createText).toHaveBeenCalledWith("Click Me", "TextBtn/Text");
    });

    it("should create button with custom name", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
        name: "CustomBtn",
      });

      expect(mockApp.createContainer).toHaveBeenCalledWith("CustomBtn/Container");
      expect(mockApp.createText).toHaveBeenCalledWith("Test", "CustomBtn/Text");
    });

    it("should create button with custom size", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
        width: 200,
        height: 60,
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(container.setSize).toHaveBeenCalledWith(200, 60);
    });

    it("should create button with default size when not specified", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(container.setSize).toHaveBeenCalledWith(180, 68);
    });
  });

  describe("Styling", () => {
    it("should apply custom colors", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
        bgColor: "#ff0000",
        textColor: "#ffffff",
      });

      const textObj = (mockApp.createText as any).mock.results[0].value;
      expect(textObj.color).toBe("#ffffff");
    });

    it("should apply custom font size", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
        fontSize: 24,
      });

      const textObj = (mockApp.createText as any).mock.results[0].value;
      expect(textObj.fontSize).toBe(24);
    });

    it("should apply font weight", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
        fontWeight: "bold",
      });

      const textObj = (mockApp.createText as any).mock.results[0].value;
      expect(textObj.fontWeight).toBe("bold");
    });

    it("should use default font weight as normal", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
      });

      const textObj = (mockApp.createText as any).mock.results[0].value;
      expect(textObj.fontWeight).toBe("normal");
    });

    it("should create background graphics with default color", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
      });

      expect(mockApp.createGraphics).toHaveBeenCalledWith("TextBtn/Bg");
    });

    it("should not create background when bgColor is transparent", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
        bgColor: "transparent",
      });

      // Should still be called 0 times since transparent skips bg creation
      const graphicsCalls = (mockApp.createGraphics as any).mock.calls;
      const bgCalls = graphicsCalls.filter((call: any[]) => call[0]?.includes("Bg"));
      expect(bgCalls.length).toBe(0);
    });
  });

  describe("Responsive Mode", () => {
    it("should calculate width based on text length in responsive mode", () => {
      const textObj = {
        name: "text",
        text: "ABCD",
        x: 0,
        y: 0,
        width: 80,
        height: 30,
        alpha: 1,
        fontSize: 14,
        fontWeight: "normal",
        color: "#000000",
        align: "left",
        updateTexture: vi.fn(),
        addChild: vi.fn(),
        removeChild: vi.fn(),
      };

      (mockApp.createText as any).mockReturnValue(textObj);

      TextBtn({
        app: mockApp,
        text: "ABCD",
        responsive: true,
      });

      // In responsive mode, width = charWidth * (charNum + 1)
      // charWidth = 80 / 4 = 20, width = 20 * 5 = 100
      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(container.setSize).toHaveBeenCalledWith(100, 45);
    });
  });

  describe("Event Handling", () => {
    /* 点击行为（含移动取消、按下视觉）已在 PressablePopup.test.ts 里
       用真实 EventManager 覆盖。这里只验证 TextBtn 是否正确装配了
       Pressable：绑定 touchstart/mousedown，并按需注册捕获观察器。 */
    it("binds both touch and mouse entry points", () => {
      TextBtn({ app: mockApp, text: "Test", pressEffect: false, onClick: vi.fn() });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(container.addEventListener).toHaveBeenCalledWith("touchstart", expect.any(Function));
      expect(container.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(container.addEventListener).not.toHaveBeenCalledWith("touchend", expect.any(Function));
    });

    it("registers the capture observer lazily on press", () => {
      TextBtn({ app: mockApp, text: "Test", pressEffect: true, onClick: vi.fn() });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(mockApp.eventManager.addEventObserver).not.toHaveBeenCalled();
      container._triggerEvent("touchstart", (mockApp as any)._event("touchstart"));
      expect(mockApp.eventManager.addEventObserver).toHaveBeenCalledOnce();
    });
  });

  describe("API Methods", () => {
    it("should update radius via setRadius", () => {
      const result = TextBtn({
        app: mockApp,
        text: "Test",
        radius: 8,
      });

      const bg = (mockApp.createGraphics as any).mock.results[0].value;
      expect(bg.drawRoundedRect).toHaveBeenCalled();
      
      result.setRadius(16);
      expect(bg.clear).toHaveBeenCalled();
    });

    it("should update background color via setBgColor", () => {
      const result = TextBtn({
        app: mockApp,
        text: "Test",
        bgColor: "#ff0000",
      });

      const bg = (mockApp.createGraphics as any).mock.results[0].value;
      result.setBgColor("#00ff00");
      
      expect(bg.clear).toHaveBeenCalled();
    });
  });
});
