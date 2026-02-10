import type {
  TinyUI,
  Container,
  DisplayObject,
  Graphics,
  UIEvent,
} from "@shuizhongyueming/tiny-ui-core";
import TinyUICore from "@shuizhongyueming/tiny-ui-core";
import { ShapeRect } from "./ShapeRect";

export type Direction = "vertical" | "horizontal" | "both";

export interface ScrollbarConfig {
  width?: number;
  radius?: number;
  color?: string;
  autoHide?: boolean;
  hideDelay?: number;
  minLength?: number;
}

export interface ScrollProps {
  app: TinyUI;
  width: number;
  height: number;
  direction?: Direction;
  bounce?: boolean;
  momentum?: boolean;
  scrollbar?: ScrollbarConfig;
  autoUpdate?: boolean;
  onScroll?: (pos: {
    x: number;
    y: number;
    progressX: number;
    progressY: number;
  }) => void;
}

export interface ScrollResult {
  container: Container;
  content: Container;
  scrollTo(pos: { x?: number; y?: number }, animated?: boolean): void;
  scrollToTop(animated?: boolean): void;
  scrollToBottom(animated?: boolean): void;
  scrollToLeft(animated?: boolean): void;
  scrollToRight(animated?: boolean): void;
  refresh(): void;
  destroy(): void;
}

interface ScrollPosition {
  x: number;
  y: number;
}

const DEFAULT_SCROLLBAR: Required<ScrollbarConfig> = {
  width: 6,
  radius: 3,
  color: "rgba(0,0,0,0.3)",
  autoHide: true,
  hideDelay: 1000,
  minLength: 30,
};

export function Scroll({
  app,
  width,
  height,
  direction = "vertical",
  bounce = true,
  momentum = true,
  scrollbar: scrollbarConfig = {},
  autoUpdate = true,
  onScroll,
}: ScrollProps): ScrollResult {
  const scrollbar = { ...DEFAULT_SCROLLBAR, ...scrollbarConfig };

  // 主容器
  const container = app.createContainer("Scroll/Root");
  container.width = width;
  container.height = height;

  // 遮罩层（拦截事件，定义可视区域）
  const maskLayer = ShapeRect(app, { width, height }, "#ffffff");
  maskLayer.anchorX = 0;
  maskLayer.anchorY = 0;
  maskLayer.alpha = 0;
  container.addChild(maskLayer);

  // 内容容器
  const content = app.createContainer("Scroll/Content");
  content.anchorX = 0;
  content.anchorY = 0;
  container.addChild(content);

  // 设置裁剪区域在 container 上，使内容只在可视区域内显示
  // clipRect 使用物理像素，与 TinyUI 内部坐标系一致
  container.setClipRect(0, 0, width, height);

  // 滚动条容器
  const scrollbarContainer = app.createContainer("Scroll/Scrollbar");
  container.addChild(scrollbarContainer);

  // 垂直滚动条
  let scrollbarY: Graphics | null = null;
  if (direction === "vertical" || direction === "both") {
    scrollbarY = app.createGraphics("Scroll/ScrollbarY");
    scrollbarContainer.addChild(scrollbarY);
  }

  // 水平滚动条
  let scrollbarX: Graphics | null = null;
  if (direction === "horizontal" || direction === "both") {
    scrollbarX = app.createGraphics("Scroll/ScrollbarX");
    scrollbarContainer.addChild(scrollbarX);
  }

  // 滚动状态
  let contentBounds = { width: 0, height: 0 };
  let scrollPos: ScrollPosition = { x: 0, y: 0 };
  let isDragging = false;
  let startTouch: ScrollPosition = { x: 0, y: 0 };
  let startScroll: ScrollPosition = { x: 0, y: 0 };
  let velocity: ScrollPosition = { x: 0, y: 0 };
  let lastTouch: ScrollPosition = { x: 0, y: 0 };
  let lastTime = 0;
  let rafId: number | null = null;
  let hideScrollbarTimer: number | null = null;

  // 计算内容边界
  function updateContentBounds(): void {
    let maxX = 0;
    let maxY = 0;

    for (const child of content.children) {
      const bounds = child.getBounds();
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    contentBounds = {
      width: Math.max(maxX, width),
      height: Math.max(maxY, height),
    };

    // 确保 scroll position 在有效范围内
    clampScroll();
    updateScrollbars();
  }

  // 限制滚动位置
  function clampScroll(): void {
    const maxX = Math.max(0, contentBounds.width - width);
    const maxY = Math.max(0, contentBounds.height - height);

    scrollPos.x = Math.max(-maxX, Math.min(0, scrollPos.x));
    scrollPos.y = Math.max(-maxY, Math.min(0, scrollPos.y));

    content.x = scrollPos.x;
    content.y = scrollPos.y;
  }

  // 更新滚动条
  function updateScrollbars(): void {
    if (scrollbarY) {
      const contentHeight = contentBounds.height;
      const ratio = height / contentHeight;

      if (ratio >= 1) {
        scrollbarY.visible = false;
      } else {
        scrollbarY.visible = true;
        const thumbHeight = Math.max(scrollbar.minLength, height * ratio);
        const trackY =
          (-scrollPos.y / (contentHeight - height)) * (height - thumbHeight);

        scrollbarY.clear();
        scrollbarY.drawRoundedRect(
          width - scrollbar.width - 2,
          trackY,
          scrollbar.width,
          thumbHeight,
          scrollbar.radius,
          scrollbar.color,
        );
      }
    }

    if (scrollbarX) {
      const contentWidth = contentBounds.width;
      const ratio = width / contentWidth;

      if (ratio >= 1) {
        scrollbarX.visible = false;
      } else {
        scrollbarX.visible = true;
        const thumbWidth = Math.max(scrollbar.minLength, width * ratio);
        const trackX =
          (-scrollPos.x / (contentWidth - width)) * (width - thumbWidth);

        scrollbarX.clear();
        scrollbarX.drawRoundedRect(
          trackX,
          height - scrollbar.width - 2,
          thumbWidth,
          scrollbar.width,
          scrollbar.radius,
          scrollbar.color,
        );
      }
    }

    // 触发 onScroll 回调
    if (onScroll) {
      const maxX = Math.max(0, contentBounds.width - width);
      const maxY = Math.max(0, contentBounds.height - height);
      onScroll({
        x: scrollPos.x,
        y: scrollPos.y,
        progressX: maxX > 0 ? -scrollPos.x / maxX : 0,
        progressY: maxY > 0 ? -scrollPos.y / maxY : 0,
      });
    }
  }

  // 显示滚动条
  function showScrollbars(): void {
    if (scrollbarY) scrollbarY.alpha = 1;
    if (scrollbarX) scrollbarX.alpha = 1;

    if (hideScrollbarTimer) {
      clearTimeout(hideScrollbarTimer);
    }

    if (scrollbar.autoHide) {
      hideScrollbarTimer = window.setTimeout(() => {
        hideScrollbars();
      }, scrollbar.hideDelay);
    }
  }

  // 隐藏滚动条
  function hideScrollbars(): void {
    const fade = () => {
      if (scrollbarY && scrollbarY.alpha > 0) {
        scrollbarY.alpha -= 0.1;
      }
      if (scrollbarX && scrollbarX.alpha > 0) {
        scrollbarX.alpha -= 0.1;
      }
      if (
        (scrollbarY && scrollbarY.alpha > 0) ||
        (scrollbarX && scrollbarX.alpha > 0)
      ) {
        requestAnimationFrame(fade);
      }
    };
    fade();
  }

  // 惯性滚动动画
  function startMomentum(): void {
    if (!momentum) return;

    const friction = 0.9;
    const minVelocity = 0.5;

    function animate(): void {
      const shouldAnimateX =
        (direction === "horizontal" || direction === "both") &&
        Math.abs(velocity.x) >= minVelocity;
      const shouldAnimateY =
        (direction === "vertical" || direction === "both") &&
        Math.abs(velocity.y) >= minVelocity;

      if (!shouldAnimateX && !shouldAnimateY) {
        if (bounce) {
          springBack();
        }
        return;
      }

      // 边界回弹阻力
      const maxX = Math.max(0, contentBounds.width - width);
      const maxY = Math.max(0, contentBounds.height - height);

      if (shouldAnimateX) {
        scrollPos.x += velocity.x;
        velocity.x *= friction;

        if (scrollPos.x > 0) {
          velocity.x *= 0.5;
        } else if (scrollPos.x < -maxX) {
          velocity.x *= 0.5;
        }
      }

      if (shouldAnimateY) {
        scrollPos.y += velocity.y;
        velocity.y *= friction;

        if (scrollPos.y > 0) {
          velocity.y *= 0.5;
        } else if (scrollPos.y < -maxY) {
          velocity.y *= 0.5;
        }
      }

      content.x = scrollPos.x;
      content.y = scrollPos.y;
      updateScrollbars();

      rafId = requestAnimationFrame(animate);
    }

    animate();
  }

  // 弹簧回弹
  function springBack(): void {
    if (!bounce) {
      clampScroll();
      return;
    }

    const maxX = Math.max(0, contentBounds.width - width);
    const maxY = Math.max(0, contentBounds.height - height);

    let targetX = scrollPos.x;
    let targetY = scrollPos.y;

    if (scrollPos.x > 0) targetX = 0;
    else if (scrollPos.x < -maxX) targetX = -maxX;

    if (scrollPos.y > 0) targetY = 0;
    else if (scrollPos.y < -maxY) targetY = -maxY;

    if (targetX === scrollPos.x && targetY === scrollPos.y) return;

    const spring = 0.1;

    function animate(): void {
      const dx = targetX - scrollPos.x;
      const dy = targetY - scrollPos.y;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        scrollPos.x = targetX;
        scrollPos.y = targetY;
        content.x = scrollPos.x;
        content.y = scrollPos.y;
        updateScrollbars();
        return;
      }

      scrollPos.x += dx * spring;
      scrollPos.y += dy * spring;
      content.x = scrollPos.x;
      content.y = scrollPos.y;
      updateScrollbars();

      rafId = requestAnimationFrame(animate);
    }

    animate();
  }

  // 全局事件处理器引用（用于解绑）
  let globalTouchMoveHandler: ((e: UIEvent) => void) | null = null;
  let globalTouchEndHandler: ((e: UIEvent) => void) | null = null;

  // 事件处理
  function onTouchStart(e: UIEvent): void {
    if (isDragging) return;

    isDragging = true;
    startTouch = { x: e.x, y: e.y };
    startScroll = { ...scrollPos };
    lastTouch = { x: e.x, y: e.y };
    lastTime = Date.now();
    velocity = { x: 0, y: 0 };

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    showScrollbars();

    // 阻止事件穿透到下层
    e.stopPropagation();

    // 绑定全局事件，确保移出 maskLayer 后仍能处理
    bindGlobalEvents();
  }

  function onTouchMove(e: UIEvent): void {
    if (!isDragging) return;

    const deltaX = e.x - startTouch.x;
    const deltaY = e.y - startTouch.y;

    // 根据方向限制移动
    if (direction === "vertical" || direction === "both") {
      scrollPos.y = startScroll.y + deltaY;
    }
    if (direction === "horizontal" || direction === "both") {
      scrollPos.x = startScroll.x + deltaX;
    }

    // 边界回弹效果
    const maxX = Math.max(0, contentBounds.width - width);
    const maxY = Math.max(0, contentBounds.height - height);

    if (bounce) {
      if (scrollPos.x > 0) scrollPos.x *= 0.5;
      else if (scrollPos.x < -maxX && maxX > 0) {
        scrollPos.x = -maxX + (scrollPos.x + maxX) * 0.5;
      }

      if (scrollPos.y > 0) scrollPos.y *= 0.5;
      else if (scrollPos.y < -maxY && maxY > 0) {
        scrollPos.y = -maxY + (scrollPos.y + maxY) * 0.5;
      }
    } else {
      clampScroll();
    }

    content.x = scrollPos.x;
    content.y = scrollPos.y;

    // 计算速度（根据方向限制）
    const now = Date.now();
    const dt = now - lastTime;
    if (dt > 0) {
      if (direction === "horizontal" || direction === "both") {
        velocity.x = ((e.x - lastTouch.x) / dt) * 16;
      }
      if (direction === "vertical" || direction === "both") {
        velocity.y = ((e.y - lastTouch.y) / dt) * 16;
      }
    }
    lastTouch = { x: e.x, y: e.y };
    lastTime = now;

    updateScrollbars();

    // 阻止事件穿透到下层
    e.stopPropagation();
  }

  function onTouchEnd(e: UIEvent): void {
    if (!isDragging) return;
    isDragging = false;
    startMomentum();

    // 解绑全局事件
    unbindGlobalEvents();

    // 阻止事件穿透到下层
    e.stopPropagation();
  }

  // 绑定全局事件
  function bindGlobalEvents(): void {
    globalTouchMoveHandler = onTouchMove;
    globalTouchEndHandler = onTouchEnd;

    app.root.addEventListener(
      TinyUICore.EventName.TouchMove,
      globalTouchMoveHandler,
    );
    app.root.addEventListener(
      TinyUICore.EventName.TouchEnd,
      globalTouchEndHandler,
    );
  }

  // 解绑全局事件
  function unbindGlobalEvents(): void {
    if (globalTouchMoveHandler) {
      app.root.removeEventListener(
        TinyUICore.EventName.TouchMove,
        globalTouchMoveHandler,
      );
      globalTouchMoveHandler = null;
    }
    if (globalTouchEndHandler) {
      app.root.removeEventListener(
        TinyUICore.EventName.TouchEnd,
        globalTouchEndHandler,
      );
      globalTouchEndHandler = null;
    }
  }

  // 绑定初始事件（只在 maskLayer 上监听 touchstart）
  maskLayer.addEventListener(TinyUICore.EventName.TouchStart, onTouchStart);

  // 自动更新
  let unsubscribeChildren: (() => void) | null = null;
  let unsubscribeResize: (() => void) | null = null;
  let rafUpdateId: number | null = null;

  if (autoUpdate) {
    const scheduleUpdate = () => {
      if (rafUpdateId) return;
      rafUpdateId = requestAnimationFrame(() => {
        rafUpdateId = null;
        updateContentBounds();
      });
    };

    unsubscribeChildren = content.on("childrenChanged", scheduleUpdate);
    unsubscribeResize = content.on("resize", scheduleUpdate);
  }

  // 动画滚动
  function animateScroll(targetX: number, targetY: number): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    const duration = 300;
    const startX = scrollPos.x;
    const startY = scrollPos.y;
    const startTime = Date.now();

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(): void {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);

      scrollPos.x = startX + (targetX - startX) * eased;
      scrollPos.y = startY + (targetY - startY) * eased;
      content.x = scrollPos.x;
      content.y = scrollPos.y;
      updateScrollbars();

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    showScrollbars();
    animate();
  }

  return {
    container,
    content,

    scrollTo(pos: { x?: number; y?: number }, animated = false): void {
      const maxX = Math.max(0, contentBounds.width - width);
      const maxY = Math.max(0, contentBounds.height - height);

      const targetX =
        pos.x !== undefined
          ? Math.max(-maxX, Math.min(0, -pos.x))
          : scrollPos.x;
      const targetY =
        pos.y !== undefined
          ? Math.max(-maxY, Math.min(0, -pos.y))
          : scrollPos.y;

      if (animated) {
        animateScroll(targetX, targetY);
      } else {
        scrollPos.x = targetX;
        scrollPos.y = targetY;
        content.x = scrollPos.x;
        content.y = scrollPos.y;
        updateScrollbars();
      }
    },

    scrollToTop(animated = false): void {
      this.scrollTo({ y: 0 }, animated);
    },

    scrollToBottom(animated = false): void {
      this.scrollTo({ y: contentBounds.height }, animated);
    },

    scrollToLeft(animated = false): void {
      this.scrollTo({ x: 0 }, animated);
    },

    scrollToRight(animated = false): void {
      this.scrollTo({ x: contentBounds.width }, animated);
    },

    refresh(): void {
      updateContentBounds();
    },

    destroy(): void {
      if (rafId) cancelAnimationFrame(rafId);
      if (rafUpdateId) cancelAnimationFrame(rafUpdateId);
      if (hideScrollbarTimer) clearTimeout(hideScrollbarTimer);

      unsubscribeChildren?.();
      unsubscribeResize?.();

      // 清理全局事件绑定
      unbindGlobalEvents();

      container.destroy();
    },
  };
}
