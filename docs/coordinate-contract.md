# 坐标契约：pivot 与 anchor

> 关联 [#1](https://github.com/shuizhongyueming/tiny-ui/issues/1)。
> 动这份契约之前先读完全文 —— 下面每个字段都同时影响绘制、布局、命中、旋转和裁剪。

## 为什么要拆

现在 `anchorX / anchorY` 一个字段同时决定三件事：

1. **`x / y` 指向节点上的哪个点**（矩阵平移）
2. **旋转与缩放的中心**（矩阵的 rotate / scale 原点）
3. **流式布局里的位置补偿**（`layoutRow` 用 `it.anchorX * w` 算 x）

这三件事在 CSS 里是分开的：`left/top`（定位）、`transform-origin`（旋转缩放中心）、
盒模型（布局）。混在一起导致两个方向的需求互相拉扯：

| 需求 | 希望「x/y 指哪个点」 | 希望「旋转中心」 |
|---|---|---|
| 全屏遮罩 `drawRect(0, 0, stageW, stageH)` | 左上角 | 无所谓 |
| 按钮上的图标，旋转出现 | 中心 | 中心 |
| 一行文字的基线对齐 | 左上角 | 无所谓 |

只调一个 `anchor` 没法同时满足。实测代价：DOM→Canvas 迁移里每处全屏遮罩、
面板背景、按钮底色都要手写两行 `anchorX = anchorY = 0`。
默认值改成 0 又会破坏「直接 `x = stageWidth / 2` 居中」这类用法
（`packages/components/example/adjustTo.html` 就是这么写的，改默认值后 4~5 个
视觉测试失败）。

## 两个字段

```ts
/** 旋转与缩放的中心。以节点盒为参考，0.5 = 盒中心。 */
anchorX = 0.5;
anchorY = 0.5;

/** x / y 指向节点上的哪个点。0 = 左上角，0.5 = 中心，1 = 右下角。 */
get pivotX() { return this._pivotX ?? this.anchorX; }   // 未显式设置时跟随 anchor
set pivotX(v) { this._pivotX = v; }
```

### pivot 未显式设置时跟随 anchor

这不是偷懒，是**让拆分零破坏**的关键。拆分前只有一个 `anchor`，历史代码用
`anchorX = 0` 表达「x/y 指左上角」。如果 `pivot` 固定默认 0.5，那些代码会集体错位。

试过两条路，都不行：

1. **pivot 默认 0.5** —— `packages/components` 的视觉测试 4~5 个失败，
   `example/adjustTo.html` 里 `checker1.x = stageWidth / 2` 这类直接定位依赖中心锚点
2. **批量把 `anchorX = 0` 改名成 `pivotX = 0`** —— 也不行：带 `rotation` 的节点，
   `anchor` 还是旋转中心，改名后旋转中心从左上角变成盒中心，同样错位

跟随之后：旧代码行为一个像素都不变，新代码设 `pivotX` 就能独立控制定位。
迁移可以逐步做，不要求一次性全改。

代价：读代码时「pivot 未设 = 跟随 anchor」需要知道。所以 `createGraphics({ origin })`
这种新入口一律**显式**设 `pivot`，不留隐式。

### 矩阵

```
translate(x - width * pivotX, y - height * pivotY)
translate(+width * anchorX, +height * anchorY)   // 移到旋转中心
rotate(rotation)
scale(scaleX, scaleY)
translate(-width * anchorX, -height * anchorY)   // 移回
```

注意 `pivot` 只出现在**第一句**，`anchor` 只出现在**后三句**。
当前实现把 `anchor` 同时用在第一句和后面，这就是问题的根源。

### 流式布局

`layoutRow` / `layoutColumn` 计算的是「节点的左上角该放在哪」。所以它们用 `pivot`：

```ts
it.x = cursor + it.pivotX * it.width;          // 原来用 anchorX
it.y = cursor - inkTop + it.pivotY * it.height;
```

⚠️ **只改矩阵不改这些会双重错位**：矩阵按 pivot 平移了，布局却还按 anchor 补偿，
偏移会叠加。`src/utils/layout.ts` 里有 8 处这样的补偿，必须一起改。

### 命中与裁剪

`hitTest` / `getBounds` / `setClipRect` 都通过 `getGlobalTransformMatrix()` 工作，
矩阵改对之后它们自动正确 —— **前提是它们真的走矩阵**，不要有第二套坐标换算。

### `adjustTo`

`packages/components/src/utils/adjustTo.ts` 用 `target.anchorX` 反算「左上角」：

```ts
const tX = target.x - targetWidth * target.anchorX;   // 应该用 pivotX
```

它想算的是左上角，所以改 `pivotX`。

## 迁移与验收

字段拆分本身零行为变化（实测：core 视觉 15 + components 视觉 27 基线一像素未动）。要拿到「全屏遮罩不写补偿」的收益，调用方把 `pivot` 设 0 即可：

```js
const mask = app.createGraphics({ origin: 'topLeft' });  // 内部就是 pivotX = pivotY = 0
mask.drawRect(0, 0, app.stageWidth, app.stageHeight, '#000');
```

`createGraphics({ origin })` 已经在 `0be3d9d` 实现，目前它设的是 anchor；契约落地后
改为设 `pivot`（`anchor` 保持 0.5，旋转中心仍在盒中心）。

### 验收

- [ ] 默认值（两个都是 0.5）下，core 视觉 15 + components 视觉 27 基线**一像素不变**
- [ ] `pivot = 0, anchor = 0.5`：`drawRect(0,0,w,h)` 从 `x/y` 铺开，**旋转仍绕盒中心**
- [ ] `layoutRow` 在 `pivot = 0` 的节点上位置正确（与手算一致）
- [ ] `hitTest` 在 `pivot = 0` 的节点上命中正确
- [ ] 负坐标、父级 scale/rotate 下仍正确
- [ ] 变异测试：把 layout 的 `pivotX` 改回 `anchorX`，必须有测试失败

### 尚未迁移的地方

`packages/core/example/*.html` 和 `packages/components/example/*.html` 里仍有
`anchorX = 0` 表达定位的写法。行为正确（pivot 跟随 anchor），但语义不精准。
部分节点带 `rotation`，改名前要逐个确认，不能批量替换 —— 已试过一次，5 个视觉用例失败。
