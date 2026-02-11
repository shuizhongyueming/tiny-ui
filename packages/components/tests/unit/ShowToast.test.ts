import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TinyUI, Container } from "@shuizhongyueming/tiny-ui-core";

// Import ShowToast
import { showToast, hideAllToasts, ToastState, _testInternals } from "../../src/ShowToast";

// Mock TinyUI factory function
function createMockTinyUI(): TinyUI {
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
      height: 50,
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
    })),
    createGraphics: vi.fn(() => ({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      alpha: 0,
      drawRoundedRect: vi.fn(),
      addChild: vi.fn(),
      destroy: vi.fn(),
    })),
    createText: vi.fn((text: string) => ({
      text,
      x: 0,
      y: 0,
      width: text.length * 16,
      height: 30,
      alpha: 0,
      fontSize: 14,
      color: 0xffffff,
      align: "center",
      anchorX: 0.5,
      anchorY: 0.5,
      maxWidth: 500,
      updateTexture: vi.fn(function(this: any) {
        this.width = Math.min(this.text.length * this.fontSize * 0.6, this.maxWidth);
        this.height = this.fontSize * 1.5;
      }),
      addChild: vi.fn(),
      destroy: vi.fn(),
    })),
    addTick: vi.fn((callback: (delta: number) => void) => {
      callback(16.67);
    }),
    removeTick: vi.fn(),
    setAutoRender: vi.fn(),
    getAutoRender: vi.fn(() => false),
  } as unknown as TinyUI;
}

describe("ShowToast", () => {
  let mockApp: TinyUI;

  beforeEach(() => {
    mockApp = createMockTinyUI();
    vi.clearAllMocks();
  });

  describe("showToast", () => {
    it("should create toast with required title", () => {
      showToast(mockApp, {
        title: "Test message",
      });

      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts).toHaveLength(1);
      expect(mockApp.root.addChild).toHaveBeenCalled();
    });

    it("should fail when title is empty", () => {
      const failMock = vi.fn();
      showToast(mockApp, {
        title: "",
        fail: failMock,
      });

      expect(failMock).toHaveBeenCalledWith(new Error("title is required"));
      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts).toHaveLength(0);
    });

    it("should fail when title is undefined", () => {
      const failMock = vi.fn();
      showToast(mockApp, {
        fail: failMock,
      } as any);

      expect(failMock).toHaveBeenCalledWith(new Error("title is required"));
      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts).toHaveLength(0);
    });

    it("should use custom duration", () => {
      showToast(mockApp, {
        title: "Test message",
        duration: 3000,
      });

      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts[0].holdDuration).toBe(3000);
    });

    it("should use default duration when not specified", () => {
      showToast(mockApp, {
        title: "Test message",
      });

      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts[0].holdDuration).toBe(_testInternals.ANIMATION_CONFIG.holdDuration);
    });

    it("should call success callback", async () => {
      const successMock = vi.fn();
      showToast(mockApp, {
        title: "Test message",
        success: successMock,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(successMock).toHaveBeenCalled();
    });

    it("should position toast at 75% of viewport height", () => {
      showToast(mockApp, {
        title: "Test message",
      });

      const state = _testInternals.getToastState(mockApp);
      const expectedTargetY = mockApp.viewportHeight * 0.75;
      expect(state.toasts[0].targetY).toBe(expectedTargetY);
    });

    it("should center toast horizontally", () => {
      showToast(mockApp, {
        title: "Test message",
      });

      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts[0].container.x).toBe(mockApp.viewportWidth / 2);
    });

    it("should isolate toasts between different apps", () => {
      const mockApp2 = createMockTinyUI();
      
      showToast(mockApp, {
        title: "Toast 1",
      });

      showToast(mockApp2, {
        title: "Toast 2",
      });

      const state1 = _testInternals.getToastState(mockApp);
      const state2 = _testInternals.getToastState(mockApp2);
      
      expect(state1.toasts).toHaveLength(1);
      expect(state2.toasts).toHaveLength(1);
      expect(state1.toasts[0].app).toBe(mockApp);
      expect(state2.toasts[0].app).toBe(mockApp2);
    });
  });

  describe("multiple toasts", () => {
    it("should replace current toast when new one is shown", () => {
      showToast(mockApp, {
        title: "First message",
      });

      const state = _testInternals.getToastState(mockApp);
      const firstToast = state.toasts[0];
      expect(firstToast.state).toBe(ToastState.SHOW);

      showToast(mockApp, {
        title: "Second message",
      });

      expect(firstToast.state).toBe(ToastState.HIDE);
      expect(state.toasts).toHaveLength(2);

      const secondToast = state.toasts[1];
      expect(secondToast.state).toBe(ToastState.SHOW);
    });

    it("should only replace toast for the same app", () => {
      const mockApp2 = createMockTinyUI();
      
      showToast(mockApp, { title: "First app toast" });
      showToast(mockApp2, { title: "Second app toast" });

      const state1 = _testInternals.getToastState(mockApp);
      const state2 = _testInternals.getToastState(mockApp2);

      expect(state1.toasts[0].state).toBe(ToastState.SHOW);
      expect(state2.toasts[0].state).toBe(ToastState.SHOW);
    });
  });

  describe("hideAllToasts", () => {
    it("should hide all toasts for specified app", () => {
      showToast(mockApp, { title: "Toast 1" });
      showToast(mockApp, { title: "Toast 2" });
      showToast(mockApp, { title: "Toast 3" });

      hideAllToasts(mockApp);

      const state = _testInternals.getToastState(mockApp);
      state.toasts.forEach((toast) => {
        expect(toast.state).toBe(ToastState.HIDE);
      });
    });

    it("should only hide toasts for specified app", () => {
      const mockApp2 = createMockTinyUI();
      
      showToast(mockApp, { title: "Toast 1" });
      showToast(mockApp2, { title: "Toast 2" });

      hideAllToasts(mockApp);

      const state1 = _testInternals.getToastState(mockApp);
      const state2 = _testInternals.getToastState(mockApp2);
      
      expect(state1.toasts[0].state).toBe(ToastState.HIDE);
      expect(state2.toasts[0].state).toBe(ToastState.SHOW);
    });

    it("should not fail when no toasts exist", () => {
      expect(() => {
        hideAllToasts(mockApp);
      }).not.toThrow();
    });
  });

  describe("toast animation states", () => {
    it("should start in SHOW state", () => {
      showToast(mockApp, {
        title: "Test message",
      });

      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts[0].state).toBe(ToastState.SHOW);
      expect(state.toasts[0].progress).toBe(0);
    });

    it("should have correct initial alpha values", () => {
      showToast(mockApp, {
        title: "Test message",
      });

      const state = _testInternals.getToastState(mockApp);
      expect(state.toasts[0].bg.alpha).toBe(0);
      expect(state.toasts[0].text.alpha).toBe(0);
    });
  });

  describe("_testInternals", () => {
    it("should expose animation config", () => {
      expect(_testInternals.ANIMATION_CONFIG).toBeDefined();
      expect(_testInternals.ANIMATION_CONFIG.showDuration).toBe(200);
      expect(_testInternals.ANIMATION_CONFIG.holdDuration).toBe(1500);
      expect(_testInternals.ANIMATION_CONFIG.hideDuration).toBe(200);
    });

    it("should expose toast config", () => {
      expect(_testInternals.TOAST_CONFIG).toBeDefined();
      expect(_testInternals.TOAST_CONFIG.designWidth).toBe(540);
      expect(_testInternals.TOAST_CONFIG.fontSize).toBe(28);
    });
  });
});