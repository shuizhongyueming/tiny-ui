# 设计反馈：anchor / 尺寸 / 绘制范围的语义重叠

> 来源：一个 three.js 小游戏的 DOM→Canvas UI 迁移，390×844 @dpr3，
> 迁了局内 HUD（约 45 个节点）和两个模态浮层。
> Web（Chromium）完整验证，Native 未验证。
> 下文每个问题都附「本轮实际踩到几次」和「改动代价」，方便排优先级。

## 摘要

| # | 问题 | 本轮踩到 | 改动代价 | 破坏性 |
|---|---|---|---|---|
| 1 | `anchor` 同时是「定位参考点」和「绘制原点」 | 3 次 | 中 | 是（可渐进） |
| 2 | `width/height` 有多个互相矛盾的来源 | 2 次 | 中 | 否（可加派生 getter） |
| 3 | 文字度量与渲染耦合 | 1 次 | 已修（见附录 A） | 是，已提交 |
| 4 | `render()` 默认清屏，命名不体现 | 读代码才发现 | 小 | 是 |
| 5 | 静默失败：非法参数/未就绪状态不报 | 5 次 | 小 | 否 |

问题 3 已经在本地分支修掉了（把度量从 `updateTexture` 里拆出来）。其余四条是设计决策，
我只陈述现象与建议，改法由维护者定。

---

## 1 `anchor` 同时编码了两件事

### 现状

`anchor` 通过**变换矩阵**生效（`DisplayObject.getGlobalTransformMatrix()`：
`matrix.translate(this.x - width * anchorX, this.y - height * anchorY)`），
所以它对所有 `DisplayObject` 一致，包括 `Graphics`。

默认值 `0.5` 是 `3376397 "config default anchor to 0.5"` 有意选的。

但它同时承担了两个不同概念：

- **定位参考点**：`x/y` 指的是节点的哪个位置
- **绘制原点**：本地坐标 `(0, 0)` 落在节点的哪个位置

`Graphics` 的绘制 API 语义却是"从原点铺开"：

```js
const g = app.createGraphics();
g.drawRect(0, 0, app.stageWidth, app.stageHeight, color);  // 想铺满画布
```

`anchorX/Y = 0.5` 时，矩阵把整块平移 `(-w/2, -h/2)`，实际从 `(-390, -844)`
画到 `(390, 844)` —— 只有屏幕**右下四分之一**被填到。

### 本轮踩到三次，全是静默的

1. 全屏遮罩（PAUSED 背景）：只有右下 1/4 变暗
2. 面板背景（`capsule` 内部三个 Graphics）
3. 按钮底色

第 2 条尤其说明设计的脆弱：那个组件**从写下就没设过 anchor**，一直没暴露，
因为没有任何界面用到它，直到这次迁移才第一次被调用。

三次的共同点：**尺寸全对、`getBounds()` 全对、hitTest 全对，只有画面错。**

`da85d72 "draw rect and circle based on graphic top left point"` 说明作者曾经
处理过这件事，但那次的改动只是把尺寸 union 公式换成 `min/max` 形式，
`anchor` 仍被卷在里面（`Math.min(left, -this.width * this.anchorX)`）。

### 建议

把两个概念拆开。CSS 和 Flutter 都是这么做的 ——
CSS 用 `left/top` 定位、`transform-origin` 管变换原点、盒模型管布局；
Flutter 用 `Alignment`（布局）和 `Transform.alignment`（变换）。

```ts
// 定位参考点：x/y 指节点自身哪个位置（对齐用）
alignmentX = 0;
alignmentY = 0;

// 绘制原点：本地坐标 0,0 落在节点哪个位置（画图用）
pivotX = 0;
pivotY = 0;
```

两者默认都是 0（左上角），因为 UI 里"左上角 + 宽高"是压倒性常见，
居中可以用 `x = (parentW - w) / 2` 表达一次，不需要改锚点。

### 渐进路径（不要求大重构）

分三步，每步都能独立发版：

1. **只给 `Graphics` 加 `pivotX/Y`，默认 0**，绘制命令相对它。
   `Graphics` 的 `anchor` 保持原样（继续参与矩阵）。影响面最小 ——
   上游 components 里没有任何一处**有意**设置 Graphics 的 anchor。
2. `Container` / `Text` 加 `pivot`，默认等于 `anchor`（行为不变）。
3. `anchor` 标记 deprecated，文档指向 `alignment` + `pivot`。

第 1 步就能消掉本轮三个 bug 里最贵的两个。

---

## 2 `width/height` 有三个来源，没有权威的那个

一个 `Graphics` 的宽度可以来自：

1. `drawRect` / `drawRoundedRect` 的自动 union（第一次直接设值，后续算并集）
2. 手动 `setSize()`
3. `scale` 乘上去的视觉尺寸

本轮的坑：同一个 Graphics 上多次 `drawRect` 做 union，再叠加 `setSize`，
顶点范围和布局尺寸对不上 —— 画出一个横跨多个场景的巨框。

`width/height` 同时被当作：绘制范围、布局槽位、hitTest 边界。三者一旦不一致，
**hitTest 会点不中、裁剪会切错，而没有任何提示**。

### 建议

给绘制内容一个只读的派生边界，和布局尺寸分开：

```ts
// 只读：由绘制命令决定，render/hitTest 用这个
get bounds(): { x, y, width, height };

// 可写：布局槽位，layoutRow/layoutColumn 用这个
width / height;
```

`Pixi`/`Phaser` 的取舍是 `scale` 唯一真值、`width/bounds` 派生只读。
这里不必照搬，但至少要有一个是权威的。

低成本替代方案：`setSize` 与绘制内容的 union 不一致时，dev 模式打一条警告。

---

## 3 文字度量与渲染耦合（已修）

`Text.width/height` 以前只有在第一次 `render()` 之后才有值，因为度量代码写在
`updateTexture()` 里，和「建纹理」绑在一起。

后果不是"差几像素"：流式布局拿 0 高度做游标累加，多行内容全部叠在一个 y 上，
**且不报错**。单行、或容器里只有块状元素时一切正常。

修法（已提交）：把度量拆成 `measurePlain()` / `measureBBCode()`，
`textureNeedsUpdate` 的 setter 里同步调用，`updateTexture` 复用缓存。
详见附录 A 的 `f006433`。

这里仍留一个隐患：`textureWidth`（二次幂对齐）和 `width`（逻辑尺寸）
是两个字段并存，将来改 `setSize` 语义时容易再错。
`Text.setSize` 现在是 no-op（因为 UV 是 `width / textureWidth`），
建议至少 `throw` 或 dev 警告，静默忽略会让人以为设成功了。

---

## 4 `render()` 默认清屏，命名不体现

`render()` 会 `gl.clear` 整块画布；`patchRender()` 不会。

与引擎共存时，`render()` 是**破坏性操作**（会擦掉别人的画面）。
一个默认行为会擦掉别人内容的方法，不应该用最朴素的名字。

建议改名为 `renderClear()` / `renderOverlay()`，或 `render({ clear: true })`
把破坏性显式化。`patchRender` 的历史名字可以保留为别名。

---

## 5 静默失败清单

本轮 5 个 bug，没有一个是抛异常的，全部是"静默给出错误结果"：

| 输入 | 现状 | 建议 |
|---|---|---|
| `drawRect(0, 0, null, null, color)` | 画一个 0 尺寸图形 | 参数非法 → `throw` 或 warn |
| `stageWidth/Height` 为 0（canvas 未就绪）| 静默画不出来 | 提供 `isReady()`，或在渲染时 warn 一次 |
| 布局读到 `Text` 未度量的 0 尺寸 | 游标不前进，内容重叠 | 见问题 3，已修 |
| `Text.setSize(w, h)` | no-op，无任何反馈 | dev 模式 warn |
| `Graphics` 尺寸来源冲突（问题 2）| 画面错，无提示 | dev 模式 warn |

准则：**能检测出的无效状态，至少打一条 dev-only 警告。**
这一条比前四条都便宜，收益也最直接。

---

## 我认为不是问题的部分

| 设计 | 判断 |
|---|---|
| 一个 GL context 只允许一个实例 | 合理。GL 方法包装 + 状态快照需要独占，代价是必须复用 `window.tinyuiApp` |
| `Text.setSize` 是 no-op | 合理（UV 限制），但应报错而非静默 |
| `letterSpacing` 需在不想要时显式归零 | 合理（context 复用），可给 `resetTextStyle()` |
| 内部静态节点每帧重传几何 | 性能取舍，不是设计问题 |

---

## 附录 A：本分支已提交的补丁

分支 `feat/engine-coexistence`（基于 `d968160`），已通过 core 84 / components 91
单测、集成 7、视觉 15、共存 8：

- `e18ae25` 多指触摸按 `identifier` 逐个分发
- `673b1ef` 引擎共存 helpers（`getContext` 版本重试、`normalizeFontFamily`、`manageCanvasSize`）
- `3a2055c` 布局尺寸与视觉变换分离，新增 `layoutRow` / `layoutColumn`
- `44c1b6f` 设置顶点属性前先解绑 VAO（与引擎共用 context 时每局数百次 `INVALID_OPERATION`）
- `6923db8` components 尺寸改用 `setSize`
- `9502ecc` 补 `layoutRow`/`layoutColumn` 单测（31 个用例）
- `67102f2` 修 `gaps` 模式总宽算错
- `60a03ff` 修集成测试环境（`optimizeDeps.exclude`）+ 视觉基线入库
- `9fbd94d` 共存测试可运行，改为断言 GL 状态不变量
- `ac630f0` 布局视觉快照
- `f006433` 文字度量与渲染分离（本文问题 3）

另外 `tests/visual/__snapshots__/` 从 `.gitignore` 里移除了 —— 基线不入库时，
换机器第一次跑会自动生成基线、测试永远通过（本项目就出现过基线是纯白图）。
`AGENTS.md` 里对应的那句说明需要同步。

## 附录 B：复现脚本

```js
// 问题 1：全屏 Graphics 只画出右下 1/4
const app = new TinyUI(canvas);
const g = app.createGraphics();
g.drawRect(0, 0, app.stageWidth, app.stageHeight, 'rgba(255,0,0,0.85)');
g.setSize(app.stageWidth, app.stageHeight);
app.root.addChild(g);
app.patchRender();
// 加上 g.anchorX = g.anchorY = 0 后才是全屏
```

```js
// 问题 2：union 与 setSize 打架
const g = app.createGraphics();
g.drawRect(0, 0, 100, 1, '#f00');     // 尺寸变成 100×1
g.drawRect(0, 99, 100, 1, '#f00');    // union 成 100×100
g.setSize(100, 100);                  // 看上去一致
g.drawRect(0, 50, 100, 200, '#f00');  // 实际内容 100×250，尺寸仍是 100×100
```
