import { EventName } from "../type";
import type TinyUI from "../TinyUI";

export class EventManager {
  private canvas: HTMLCanvasElement;
  private app: TinyUI;
  private eventListeners: Map<string, EventListener> = new Map();

  constructor(app: TinyUI) {
    this.app = app;
    this.canvas = app.canvas;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 触摸开始事件
    const touchStartListener = this.createTouchListener(EventName.TouchStart);
    this.canvas.addEventListener('touchstart', touchStartListener);
    this.eventListeners.set('touchstart', touchStartListener);
    this.canvas.addEventListener('mousedown', touchStartListener);
    this.eventListeners.set('mousedown', touchStartListener);

    // 触摸移动事件
    const touchMoveListener = this.createTouchListener(EventName.TouchMove);
    this.canvas.addEventListener('touchmove', touchMoveListener);
    this.eventListeners.set('touchmove', touchMoveListener);
    this.canvas.addEventListener('mousemove', touchMoveListener);
    this.eventListeners.set('mousemove', touchMoveListener);

    // 触摸结束事件
    const touchEndListener = this.createTouchListener(EventName.TouchEnd);
    this.canvas.addEventListener('touchend', touchEndListener);
    this.eventListeners.set('touchend', touchEndListener);
    this.canvas.addEventListener('mouseup', touchEndListener);
    this.eventListeners.set('mouseup', touchEndListener);
  }

  private createTouchListener(eventName: EventName): EventListener {
    return (event: Event) => {
      // 阻止默认行为
      event.preventDefault();

      // 转换事件坐标到canvas坐标系
      const canvasRect = this.canvas.getBoundingClientRect();
      let x: number, y: number;

      if (event instanceof MouseEvent) {
        x = event.clientX - canvasRect.left;
        y = event.clientY - canvasRect.top;
      } else if (event instanceof TouchEvent) {
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
      const uiEvent = {
        type: eventName,
        x,
        y,
        originalEvent: event,
        target: null,
        stopPropagation: false
      };

      // 将事件传递给UI树，直接使用app.root
      this.dispatchEventToNode(this.app.root, uiEvent);
    };
  }

  private dispatchEventToNode(node: any, event: any): void {
    if (!node.visible) return;

    // 事件已阻止传播
    if (event.stopPropagation) return;

    // 首先传递给子节点 (从前到后，以便最上层的节点先接收到事件)
    if (node.children && node.children.length > 0) {
      // 从后向前遍历，这样最上层的元素先接收到事件
      for (let i = node.children.length - 1; i >= 0; i--) {
        this.dispatchEventToNode(node.children[i], event);
        if (event.stopPropagation) return;
      }
    }

    // 检查点是否在节点内
    if (node.hasEventListener(event.type) && node.hitTest && node.hitTest(event.x, event.y)) {
      // 设置事件目标
      event.target = node;

      // 调用节点的事件处理方法
      node.dispatchEvent(event.type, event);
    }
  }

  destroy(): void {
    // 移除所有事件监听器
    for (const [eventType, listener] of this.eventListeners.entries()) {
      this.canvas.removeEventListener(eventType, listener);
    }

    this.eventListeners.clear();
  }
}
