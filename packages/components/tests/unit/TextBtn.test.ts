import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TinyUI, Container, Graphics, Text } from "@shuizhongyueming/tiny-ui-core";
import { TextBtn } from "../../src/TextBtn";

// Mock TinyUI factory function
function createMockTinyUI(): TinyUI {
  const mockEventListeners = new Map();
  
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
      setSize: vi.fn(function(this: any, size: { width: number; height: number }) {
        this.width = size.width;
        this.height = size.height;
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
      expect(container.setSize).toHaveBeenCalledWith({ width: 200, height: 60 });
    });

    it("should create button with default size when not specified", () => {
      TextBtn({
        app: mockApp,
        text: "Test",
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(container.setSize).toHaveBeenCalledWith({ width: 180, height: 68 });
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
      expect(container.setSize).toHaveBeenCalledWith({ width: 100, height: 45 });
    });
  });

  describe("Event Handling", () => {
    it("should add touchstart listener without press effect", () => {
      const onClick = vi.fn();
      TextBtn({
        app: mockApp,
        text: "Test",
        pressEffect: false,
        onClick,
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(container.addEventListener).toHaveBeenCalledWith("touchstart", expect.any(Function));
    });

    it("should trigger onClick on touchend when pressEffect is false", () => {
      const onClick = vi.fn();
      TextBtn({
        app: mockApp,
        text: "Test",
        pressEffect: false,
        onClick,
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      // touchstart then touchend triggers onClick (same as pressEffect=true)
      container._triggerEvent("touchstart");
      container._triggerEvent("touchend");

      expect(onClick).toHaveBeenCalled();
    });

    it("should add event listeners with press effect", () => {
      const onClick = vi.fn();
      TextBtn({
        app: mockApp,
        text: "Test",
        pressEffect: true,
        onClick,
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      expect(container.addEventListener).toHaveBeenCalledWith("touchstart", expect.any(Function));
      expect(container.addEventListener).toHaveBeenCalledWith("touchmove", expect.any(Function));
      expect(container.addEventListener).toHaveBeenCalledWith("touchend", expect.any(Function));
    });

    it("should trigger onClick on touchend when pressed", () => {
      const onClick = vi.fn();
      const result = TextBtn({
        app: mockApp,
        text: "Test",
        pressEffect: true,
        onClick,
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      
      // First trigger touchstart to set pressed state
      container._triggerEvent("touchstart");
      
      // Then trigger touchend to complete the click
      container._triggerEvent("touchend");
      
      expect(onClick).toHaveBeenCalled();
    });

    it("should not trigger onClick if moved too far", () => {
      const onClick = vi.fn();
      const result = TextBtn({
        app: mockApp,
        text: "Test",
        pressEffect: true,
        onClick,
      });

      const container = (mockApp.createContainer as any).mock.results[0].value;
      
      // Trigger touchstart at origin
      container._triggerEvent("touchstart", { stopPropagation: vi.fn(), x: 0, y: 0 });
      
      // Trigger touchmove far away
      container._triggerEvent("touchmove", { stopPropagation: vi.fn(), x: 20, y: 0 });
      
      // Trigger touchend
      container._triggerEvent("touchend", { stopPropagation: vi.fn(), x: 20, y: 0 });
      
      expect(onClick).not.toHaveBeenCalled();
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
