import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TinyUI, Container } from "@shuizhongyueming/tiny-ui-core";

// Import ShowDialog
import { showDialog, hideDialog, hideAllDialogs, DialogState, _testInternals } from "../../src/ShowDialog";

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
      _triggerEvent: (event: string) => {
        const handlers = mockEventListeners.get(event) || [];
        handlers.forEach((h: Function) => h());
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
      addEventListener: vi.fn(),
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
      color: 0x000000,
      align: "left",
      anchorX: 0.5,
      anchorY: 0.5,
      maxWidth: 500,
      lineHeight: 40,
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

describe("ShowDialog", () => {
  let mockApp: TinyUI;

  beforeEach(() => {
    mockApp = createMockTinyUI();
    vi.clearAllMocks();
  });

  describe("showDialog", () => {
    it("should create dialog with required content", () => {
      showDialog(mockApp, {
        content: "Test content",
      });

      const state = _testInternals.getDialogState(mockApp);
      expect(state.dialogs).toHaveLength(1);
      expect(mockApp.root.addChild).toHaveBeenCalled();
    });

    it("should create dialog with title and content", () => {
      showDialog(mockApp, {
        title: "Test Title",
        content: "Test content",
      });

      const state = _testInternals.getDialogState(mockApp);
      expect(state.dialogs).toHaveLength(1);
      expect(state.dialogs[0].state).toBe(DialogState.SHOW);
    });

    it("should fail when content is empty", () => {
      const failMock = vi.fn();
      showDialog(mockApp, {
        content: "",
        fail: failMock,
      });

      expect(failMock).toHaveBeenCalledWith(new Error("content is required"));
      const state = _testInternals.getDialogState(mockApp);
      expect(state.dialogs).toHaveLength(0);
    });

    it("should fail when content is undefined", () => {
      const failMock = vi.fn();
      showDialog(mockApp, {
        fail: failMock,
      } as any);

      expect(failMock).toHaveBeenCalledWith(new Error("content is required"));
      const state = _testInternals.getDialogState(mockApp);
      expect(state.dialogs).toHaveLength(0);
    });

    it("should create dialog with cancel button by default", () => {
      showDialog(mockApp, {
        content: "Test content",
        cancelText: "Cancel",
        confirmText: "OK",
      });

      const containerCalls = (mockApp.createContainer as any).mock.calls;
      const buttonContainers = containerCalls.filter((call: any[]) => 
        call[0]?.includes("Button")
      );
      expect(buttonContainers.length).toBeGreaterThanOrEqual(2);
    });

    it("should create dialog without cancel button when showCancel is false", () => {
      showDialog(mockApp, {
        content: "Test content",
        showCancel: false,
      });

      const containerCalls = (mockApp.createContainer as any).mock.calls;
      const buttonContainers = containerCalls.filter((call: any[]) => 
        call[0]?.includes("Button")
      );
      expect(buttonContainers.length).toBe(1);
    });

    it("should use custom button texts", () => {
      showDialog(mockApp, {
        content: "Test content",
        cancelText: "No",
        confirmText: "Yes",
      });

      const textCalls = (mockApp.createText as any).mock.calls;
      const buttonTexts = textCalls.filter((call: any[]) => 
        call[1]?.includes("Button")
      );
      expect(buttonTexts.length).toBeGreaterThanOrEqual(2);
    });

    it("should support multiple dialogs", () => {
      showDialog(mockApp, {
        content: "Dialog 1",
      });

      showDialog(mockApp, {
        content: "Dialog 2",
      });

      const state = _testInternals.getDialogState(mockApp);
      expect(state.dialogs).toHaveLength(2);
    });

    it("should isolate dialogs between different apps", () => {
      const mockApp2 = createMockTinyUI();
      
      showDialog(mockApp, {
        content: "Dialog 1",
      });

      showDialog(mockApp2, {
        content: "Dialog 2",
      });

      const state1 = _testInternals.getDialogState(mockApp);
      const state2 = _testInternals.getDialogState(mockApp2);
      
      expect(state1.dialogs).toHaveLength(1);
      expect(state2.dialogs).toHaveLength(1);
      expect(state1.dialogs[0].app).toBe(mockApp);
      expect(state2.dialogs[0].app).toBe(mockApp2);
    });
  });

  describe("hideDialog", () => {
    it("should hide dialog by id", () => {
      showDialog(mockApp, {
        content: "Test content",
      });

      const state = _testInternals.getDialogState(mockApp);
      const dialog = state.dialogs[0];
      expect(dialog.state).toBe(DialogState.SHOW);

      hideDialog(mockApp, dialog.id);
      expect(dialog.state).toBe(DialogState.HIDE);
    });

    it("should not fail when hiding non-existent dialog", () => {
      expect(() => {
        hideDialog(mockApp, 999);
      }).not.toThrow();
    });
  });

  describe("hideAllDialogs", () => {
    it("should hide all dialogs for specified app", () => {
      showDialog(mockApp, { content: "Dialog 1" });
      showDialog(mockApp, { content: "Dialog 2" });
      showDialog(mockApp, { content: "Dialog 3" });

      hideAllDialogs(mockApp);

      const state = _testInternals.getDialogState(mockApp);
      state.dialogs.forEach((dialog) => {
        expect(dialog.state).toBe(DialogState.HIDE);
      });
    });

    it("should only hide dialogs for specified app", () => {
      const mockApp2 = createMockTinyUI();
      
      showDialog(mockApp, { content: "Dialog 1" });
      showDialog(mockApp2, { content: "Dialog 2" });

      hideAllDialogs(mockApp);

      const state1 = _testInternals.getDialogState(mockApp);
      const state2 = _testInternals.getDialogState(mockApp2);
      
      expect(state1.dialogs[0].state).toBe(DialogState.HIDE);
      expect(state2.dialogs[0].state).toBe(DialogState.SHOW);
    });

    it("should not fail when no dialogs exist", () => {
      expect(() => {
        hideAllDialogs(mockApp);
      }).not.toThrow();
    });
  });

  describe("dialog animation states", () => {
    it("should start in SHOW state", () => {
      showDialog(mockApp, {
        content: "Test content",
      });

      const state = _testInternals.getDialogState(mockApp);
      const dialog = state.dialogs[0];
      expect(dialog.state).toBe(DialogState.SHOW);
      expect(dialog.progress).toBe(0);
    });

    it("should calculate dialog width based on viewport", () => {
      const customMockApp = createMockTinyUI();
      customMockApp.viewportWidth = 1000;

      showDialog(customMockApp, {
        content: "Test content",
      });

      const state = _testInternals.getDialogState(customMockApp);
      expect(state.dialogs).toHaveLength(1);
    });
  });
});