import { EventName } from "../type";
import type TinyUI from "../TinyUI";
import { DisplayObject } from "../DisplayObject";
import { UIEvent, type StopType } from "../utils/UIEvent";
import { Container } from "../Container";

export type TouchEventName = "touchstart" | "touchmove" | "touchend" | "touchcancel";
export type MouseEventName = "mousedown" | "mousemove" | "mouseup";
export type TouchEventHandler = (event: TouchEvent) => void;
export type TouchEventListeningHandler = (
  eventName: TouchEventName,
  handler: TouchEventHandler,
) => void;

type TouchRecord = {
  stopTypes: StopType[];
  time: number;
  /** 触摸是否已被 UI 消费（markHandled）。合成 mouse 事件是同一手势的重复，
      被消费过的触摸对应的 mouse 直接跳过，否则按钮会一次点击触发两次。 */
  handled: boolean;
};

export interface EventManagerOptions {
  handleTouchEventListening?: TouchEventListeningHandler;
}

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

    /* 触摸取消（系统手势打断、来电等）。宿主不一定会派发，但派发了就必须送达 UI 树 ——
       否则按钮拿不到取消通知，「按下」状态会残留到下一次触摸（滑出/双指残留偏移的根因之一）。
       注意 changedTouches 在 touchcancel 里通常包含被取消了的那根手指。 */
    const touchCancelListener = this.createTouchListener("touchcancel");
    if (options.handleTouchEventListening) {
      options.handleTouchEventListening(
        "touchcancel",
        touchCancelListener as TouchEventHandler,
      );
    } else {
      this.canvas.addEventListener("touchcancel", touchCancelListener);
    }
    this.eventListeners.set("touchcancel", touchCancelListener);

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

      if (typeof TouchEvent !== "undefined" && !(event instanceof TouchEvent)) {
        return;
      }

      const touchEvent = event as TouchEvent;

      // 多指：每个发生变化的触点单独分发一次。
      // changedTouches 为空时（部分宿主实现）回退到全量 touches。
      // 这样「一指按住游戏 + 另一指点按钮」的两个触点都能命中各自的节点。
      const changed = touchEvent.changedTouches;
      const touchList: ArrayLike<Touch> =
        changed && changed.length > 0 ? changed : touchEvent.touches;

      if (!touchList || touchList.length === 0) {
        return;
      }

      // 转换事件坐标到canvas坐标系
      const canvasRect = this.canvas.getBoundingClientRect();
      // 缩放坐标以适应canvas的实际尺寸
      const scaleX = this.canvas.width / canvasRect.width;
      const scaleY = this.canvas.height / canvasRect.height;

      const stoppedTypes: StopType[] = [];
      /* 跨全部触点累计。uiEvent 是 for 块内的 const，块外引用会 ReferenceError
         （且因 || 短路只在无 stopPropagation 时爆发，表现"偶发"）；
         多指时任何一指被消费，对应的合成 mouse 就要抑制。 */
      let anyHandled = false;

      for (let i = 0; i < touchList.length; i++) {
        const touch = touchList[i];

        // 创建自定义事件对象
        const uiEvent = new UIEvent({
          type: eventName,
          x: (touch.clientX - canvasRect.left) * scaleX,
          y: (touch.clientY - canvasRect.top) * scaleY,
          originalEvent: event,
          target: null,
          identifier: touch.identifier,
        });

        // 将事件传递给UI树
        this.dispatchEventToNode(this.app.root, uiEvent);

        if (uiEvent.handled) anyHandled = true;

        // 汇总被拦截的类型，供 mouse 桥接使用
        for (const stopType of uiEvent.getStopTypes()) {
          if (stoppedTypes.indexOf(stopType) === -1) {
            stoppedTypes.push(stopType);
          }
        }
      }

      // 分发完成后按事件聚合记录：被拦截或有任一触点被消费都要记 ——
      // 对应名字的合成 mouse 事件（浏览器兼容层派发）据此跳过或补拦。
      if (stoppedTypes.length > 0 || anyHandled) {
        this.touchEventRecords.set(eventName, {
          stopTypes: stoppedTypes,
          time: Date.now(),
          handled: anyHandled,
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
          // 触摸已被 UI 消费 —— 合成 mouse 是同一手势的重复，整条跳过，
          // 否则 pressable 会把它当一次独立的桌面点击再触发一遍回调。
          if (record.handled) return;
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
