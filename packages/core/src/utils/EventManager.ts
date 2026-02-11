import { EventName } from "../type";
import type TinyUI from "../TinyUI";
import { DisplayObject } from "../DisplayObject";
import { UIEvent, type StopType } from "../utils/UIEvent";
import { Container } from "../Container";

export type TouchEventName = "touchstart" | "touchmove" | "touchend";
export type MouseEventName = "mousedown" | "mousemove" | "mouseup";
export type TouchEventHandler = (event: TouchEvent) => void;
export type TouchEventListeningHandler = (
  eventName: TouchEventName,
  handler: TouchEventHandler,
) => void;

type TouchRecord = {
  stopTypes: StopType[];
  time: number;
};

export interface EventManagerOptions {
  handleTouchEventListening?: TouchEventListeningHandler;
}

// touch 到 mouse 的事件映射
const TOUCH_TO_MOUSE_MAP: Record<TouchEventName, MouseEventName> = {
  touchstart: "mousedown",
  touchmove: "mousemove",
  touchend: "mouseup",
};

// mouse 到 touch 的反向映射
const MOUSE_TO_TOUCH_MAP: Record<MouseEventName, TouchEventName> = {
  mousedown: "touchstart",
  mousemove: "touchmove",
  mouseup: "touchend",
};

export class EventManager {
  private canvas: HTMLCanvasElement;
  private app: TinyUI;
  private eventListeners: Map<string, EventListener> = new Map();

  // 记录被拦截的 touch 事件
  private touchEventRecords: Map<EventName, TouchRecord> = new Map();
  // 时间窗口（毫秒）
  private readonly TIME_WINDOW_MS: number = 300;

  constructor(app: TinyUI, options: EventManagerOptions = {}) {
    this.app = app;
    this.canvas = app.canvas;
    this.setupEventListeners(options);
  }

  private setupEventListeners(options: EventManagerOptions): void {
    // 触摸开始事件
    const touchStartListener = this.createTouchListener("touchstart");
    if (options.handleTouchEventListening) {
      options.handleTouchEventListening(
        "touchstart",
        touchStartListener as TouchEventHandler,
      );
    } else {
      this.canvas.addEventListener("touchstart", touchStartListener);
    }
    this.eventListeners.set("touchstart", touchStartListener);

    // 触摸移动事件
    const touchMoveListener = this.createTouchListener("touchmove");
    if (options.handleTouchEventListening) {
      options.handleTouchEventListening(
        "touchmove",
        touchMoveListener as TouchEventHandler,
      );
    } else {
      this.canvas.addEventListener("touchmove", touchMoveListener);
    }
    this.eventListeners.set("touchmove", touchMoveListener);

    // 触摸结束事件
    const touchEndListener = this.createTouchListener("touchend");
    if (options.handleTouchEventListening) {
      options.handleTouchEventListening(
        "touchend",
        touchEndListener as TouchEventHandler,
      );
    } else {
      this.canvas.addEventListener("touchend", touchEndListener);
    }
    this.eventListeners.set("touchend", touchEndListener);

    // Mouse 事件 - 不使用 handleTouchEventListening
    const mouseDownListener = this.createMouseListener("mousedown");
    this.canvas.addEventListener("mousedown", mouseDownListener);
    this.eventListeners.set("mousedown", mouseDownListener);

    const mouseMoveListener = this.createMouseListener("mousemove");
    this.canvas.addEventListener("mousemove", mouseMoveListener);
    this.eventListeners.set("mousemove", mouseMoveListener);

    const mouseUpListener = this.createMouseListener("mouseup");
    this.canvas.addEventListener("mouseup", mouseUpListener);
    this.eventListeners.set("mouseup", mouseUpListener);
  }

  private createTouchListener(eventName: EventName): EventListener {
    return (event: Event) => {
      // 阻止默认行为
      // 这个如果需要，还是在业务逻辑里面执行
      // 因为有些游戏逻辑里面，会判断事件是否已经执行了 preventDefault
      // 如果执行了，就不再执行。
      // 这个会导致游戏无法响应点击事件
      // event.preventDefault();

      // 转换事件坐标到canvas坐标系
      const canvasRect = this.canvas.getBoundingClientRect();
      let x: number, y: number;

      if (event instanceof TouchEvent) {
        const touch = event.touches[0] || event.changedTouches[0];
        x = touch.clientX - canvasRect.left;
        y = touch.clientY - canvasRect.top;
      } else {
        return;
      }

      // 缩放坐标以适应canvas的实际尺寸
      const scaleX = this.canvas.width / canvasRect.width;
      const scaleY = this.canvas.height / canvasRect.height;
      x *= scaleX;
      y *= scaleY;

      // 创建自定义事件对象
      const uiEvent = new UIEvent({
        type: eventName,
        x,
        y,
        originalEvent: event,
        target: null,
      });

      // 将事件传递给UI树
      this.dispatchEventToNode(this.app.root, uiEvent);

      // 分发完成后，如果被拦截，记录该事件
      const stopTypes = uiEvent.getStopTypes();
      if (stopTypes.length > 0) {
        this.touchEventRecords.set(eventName, {
          stopTypes,
          time: Date.now(),
        });
      }
    };
  }

  private createMouseListener(eventName: EventName): EventListener {
    return (event: Event) => {
      // 查找对应的 touch 事件记录
      const touchEventName = MOUSE_TO_TOUCH_MAP[eventName];
      const record = this.touchEventRecords.get(touchEventName);

      if (record) {
        // 先清理记录，避免潜在问题
        this.touchEventRecords.delete(touchEventName);
        // 检查时间窗口
        const timeDiff = Date.now() - record.time;
        if (timeDiff <= this.TIME_WINDOW_MS) {
          // 在有效期内，执行同样的 stop 操作
          for (const stopType of record.stopTypes) {
            if (stopType === "stopImmediatePropagation") {
              event.stopImmediatePropagation();
            } else if (stopType === "stopPropagation") {
              event.stopPropagation();
            }
          }
        } else {
          // 过期，继续处理 mouse 事件
          this.processMouseEvent(eventName, event);
        }
      } else {
        // 没有记录，正常处理 mouse 事件
        this.processMouseEvent(eventName, event);
      }
    };
  }

  private processMouseEvent(eventName: EventName, event: Event): void {
    // 转换事件坐标到canvas坐标系
    const canvasRect = this.canvas.getBoundingClientRect();
    let x: number, y: number;

    if (event instanceof MouseEvent) {
      x = event.clientX - canvasRect.left;
      y = event.clientY - canvasRect.top;
    } else {
      return;
    }

    // 缩放坐标以适应canvas的实际尺寸
    const scaleX = this.canvas.width / canvasRect.width;
    const scaleY = this.canvas.height / canvasRect.height;
    x *= scaleX;
    y *= scaleY;

    // 创建自定义事件对象
    const uiEvent = new UIEvent({
      type: eventName,
      x,
      y,
      originalEvent: event,
      target: null,
    });

    // 将事件传递给UI树
    this.dispatchEventToNode(this.app.root, uiEvent);
  }

  private dispatchEventToNode(
    node: DisplayObject | Container,
    event: UIEvent,
  ): void {
    if (!node || !node.visible) return;

    // 记录子节点遍历前的事件处理状态
    const handledBefore = event.handled;

    // 首先传递给子节点 (从前到后，以便最上层的节点先接收到事件)
    if (node.children && node.children.length > 0) {
      // 从后向前遍历，这样最上层的元素先接收到事件
      for (let i = node.children.length - 1; i >= 0; i--) {
        this.dispatchEventToNode(node.children[i], event);
        // 兄弟节点阻止事件冒泡，停止事件传播
        if (event.immediatePropagationStopped) return;
      }
    }

    // 子节点阻止事件冒泡，停止事件传播
    if (event.propagationStopped) {
      return;
    }

    // 如果没有监听器，直接跳过
    if (!node.hasEventListener(event.type)) return;

    // 性能优化：只有当前节点的子节点处理了事件，才跳过 hitTest
    // 通过比较子节点遍历前后的 handled 状态，排除其他树分支的干扰
    const handledByChildren = !handledBefore && event.handled;
    const needsHitTest = !handledByChildren;

    if (needsHitTest && node.hitTest && !node.hitTest(event.x, event.y)) {
      return; // hitTest 失败，不触发事件
    }

    // 设置事件目标（只有第一次触发时才设置，指向最深层的目标节点）
    if (!event.target) {
      event.target = node;
    }
    node.dispatchEvent(event.type, event);
  }

  destroy(): void {
    // 移除所有事件监听器
    for (const [eventType, listener] of this.eventListeners.entries()) {
      this.canvas.removeEventListener(eventType, listener);
    }

    this.eventListeners.clear();
    this.touchEventRecords.clear();
  }
}
