# TinyUI

我需要一个通用的基于 WebGL 的游戏 UI，用来给很多的游戏提供一个通用的 UI，比如加载页之类的。使用场景是一些基于 OpenGL 实现 WebGL 的小游戏平台，比如微信小游戏。这些平台是只有一个 canvas 用来渲染游戏内容。

因此这个通用的游戏 UI，需要相对比较底层，这样在渲染完毕之后，可以比较好控制相关 gl state 的清理和重置。避免干扰后续游戏的渲染。

这个 UI 需要能够渲染图片和文本。同时支持 touch 事件（单点触控即可）

## 坐标系

坐标系是跟网页的一样，原点在左上角，x 轴向右，y 轴向下。

## DisplayObject

显示对象，是所有 UI 元素的基类。它提供了基本的属性和方法，如位置、尺寸、可见性等。

DisplayObject 的尺寸只在内部自行设定，外部无法设置。

如果需要改变 DisplayObject 的显示尺寸，可以通过 scale 属性调整

### Anchor

显示对象的锚点（anchor）用来调整自身的位置，旋转，缩放。

## Container

容器，是实现嵌套关系的基类。

容器可以由外部设置尺寸。容器不会根据子元素自动调整尺寸，需要手动设置。

### Anchor

容器的锚点（anchor）只是用来调整自身的位置，旋转，缩放。

容器的锚点不会干扰容器内的坐标系。（容器自身的位置，旋转，缩放会影响子元素的位置）

对于容器内的子元素，可以将容器当做是一个画布。原点是容器的左上角。

## 与游戏引擎共用 canvas

TinyUI 可以和 three.js / Phaser 等引擎共用同一个 WebGL canvas。两条硬约束：

```js
// 1. 不要让 TinyUI 改写 canvas.width/height —— 引擎已经按自己的 dpr 策略设过了
const app = new TinyUI(canvas, { manageCanvasSize: false });

// 2. 一个 GL context 只允许一个 TinyUI 实例（构造函数会包装 GL 方法）。
//    preloader / 隐私弹窗等宿主也会创建实例，所以要先复用：
const app = window.tinyuiApp ?? (window.tinyuiApp = new TinyUI(canvas, { manageCanvasSize: false }));
```

每帧的绘制顺序固定：**先引擎渲染，再 `app.draw()`**。

### 两种渲染模式

| 模式 | 入口 | 何时用 |
|---|---|---|
| 独占渲染 | `app.render()` | TinyUI 是这一帧唯一的绘制者 |
| 叠加渲染 | `app.patchRender()` | 引擎先画完，TinyUI 叠加在上面（等价于 `render(true)`） |

`render()` 的**清屏**是有条件的：只有 `patch = false` **且** context attributes 的 `alpha` 为真时
才会 `gl.clear(COLOR_BUFFER_BIT)`。`alpha` 为假时不清屏、直接覆盖绘制。

`patchRender()` 一律不清屏。

## 开发诊断

这一层拦住的是**静默失败**：画面错了，但尺寸、`getBounds()`、`hitTest()` 全部正常，
没有任何异常。典型的触发场景：

- 绘制命令收到 `NaN`（常见于布局还没算完就取 `width`）
- 视口尺寸为 `0` 时仍在绘制
- 对 `Text` 调 `setSize()`（它是 no-op）

```js
TinyUI.debug = false; // 生产构建建议显式关闭（默认 NODE_ENV=production 时自动关闭）
```

两条规则：

1. **校验与拒绝始终执行**，`debug` 只控制「说不说」。关掉诊断后 `NaN` 依然会被丢弃，
   边界不会被污染。
2. **去重按节点实例**，不按名字 —— 多个 `Graphics` 默认都叫 `"Graphics"`，
   按名字去重会让第一个报错节点吞掉其他节点的同类问题。

零视口这类**状态性**诊断按状态周期去重：进入零尺寸提示一次，恢复后清标记，
再次归零允许重新提示。
