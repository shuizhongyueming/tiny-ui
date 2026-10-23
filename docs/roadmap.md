# 计划：坐标契约、Graphics 边界与开发诊断

> 依据 [#1](https://github.com/shuizhongyueming/tiny-ui/issues/1) /
> [#2](https://github.com/shuizhongyueming/tiny-ui/issues/2) /
> [#3](https://github.com/shuizhongyueming/tiny-ui/issues/3) 的评审结论排期。
> 排序原则：**先让框架能自己报错（A），再修确定性缺陷（B），最后动坐标契约（D）**。
> 坐标契约放最后，是因为它依赖 B 的边界定义；提前做会制造新的不一致。
>
> 基线：`feat/engine-coexistence`（相对 `origin/main` = 1.9.0，13 个 commit）。

## 总览

| 里程碑 | 内容 | 优先级 | 依赖 | 关闭 |
|---|---|---|---|---|
| **A** | 开发诊断骨架 | P1 | 无 | #3 第一批 |
| **B** | Graphics 边界正确性 | P1 | 无（可与 A 并行） | #2 |
| **C** | 尺寸冲突诊断 | P1 | A + B | #3 第二批 |
| **D** | 坐标契约（pivot/alignment） | P2 | B + C | #1 |

A 和 B 无依赖关系，可以并行。D 必须等 B 落地 —— 没有可靠的 `contentBounds`，
`pivot` 就没有可对齐的参考盒。

---

## 里程碑 A：开发诊断骨架（P1，独立可发）

目标：**让框架自己说出哪里错了**。本轮 5 个 bug 全是静默失败，这一层收益最直接。

### A1 诊断基础设施

- 统一开关：`TinyUI.debug = true`（默认：开发构建开、生产构建关）
- 每条诊断**一次性去重**（按 `节点名 + API + 原因` 的键），否则每帧布局会刷屏
- 消息格式统一：`[TinyUI] <节点名>.<API>: <发生了什么> → <怎么改>`
  必须带**可执行的修正建议**，不能只说"参数无效"

验收：同一条诊断在一次会话里只出现一次；生产构建零输出。

### A2 Graphics 参数校验

在**写入命令之前**校验，避免无效状态污染 bounds 与顶点。三类区分对待：

| 输入 | 处理 |
|---|---|
| `NaN` / `Infinity` / `null` | 拒绝命令 + 诊断 |
| 负的宽高或半径 | 诊断（可能是调用方算错），保守起见仍执行 |
| 零尺寸 | **合法**（初始化、隐藏态），不报 |

验收：注入 `drawRect(0,0,NaN,10)` 后，后续**有效**绘制不受影响（bounds 未被污染）。

### A3 `Text.setSize` 一次性提示

指向替代方案：改 `fontSize`（字号）/ 改整体 `scale`（视觉大小）/ 改外层布局容器（占位）。

### A4 零视口的绘制时提示

`stageWidth/Height` 为 0 时**仅在尝试绘制可见内容**时提示，并在零尺寸持续期间去重。
不提供 `isReady()` —— "ready" 指有效视口、字体就绪、资源加载还是纹理上传，一个布尔说不清。

### A5 文档：两种渲染模式

- 独占渲染 → `render()`
- 与引擎叠加 → `patchRender()`
- 清屏条件：`patch=false` **且** `contextAttributes.alpha` 为真时才 `gl.clear`
- 共用 canvas：`manageCanvasSize: false`

### 交付判定

- [ ] 每条诊断指向正确调用点（节点名 / API / 参数值 / 修正建议）
- [ ] 去重生效，重复布局不刷屏
- [ ] 生产构建关闭后零输出
- [ ] 无效参数不污染后续有效图形

---

## 里程碑 B：Graphics 边界正确性（P1）

目标：**让 `bounds` 可信**。这是 C 和 D 的地基。

### B1 修 union 幂等性（确定性 bug）

现状（实测）：

```
4 × drawRect(0,0,100,100) → 100×100 → 150×150 → 175×175 → 187.5×187.5
```

内容没变，尺寸一路放大。根因：`Graphics.ts:122` 用
`[-width*anchorX, width*(1-anchorX)]` **反推**已有内容范围，没有记录真实 min/max。

修法：为每条命令维护真实 `minX/minY/maxX/maxY`。`drawRect` / `drawRoundedRect` /
`drawCircle` 三处同源，一起改。

### B2 记录第一条命令的位置

```js
g.drawRect(50, 60, 10, 20);   // 现在只记 10×20，位置丢失
```

### B3 新增只读 `contentBounds`

```ts
get contentBounds(): { x, y, width, height };
```

语义：**由绘制命令决定的局部范围**（真实 min/max，不做 anchor 推算）。
`clear()` 时重置为 `{0,0,0,0}`。

保持现有 `getBounds()`（全局语义）不变，新增的是局部只读，避免命名混淆。

### B4 明确 `setSize` 与 `draw` 的交错语义

现在是「后续 draw 覆盖显式 setSize」。要定的是：

- 保持现状（draw 总是接管）→ 那么 `setSize` 的效果会被下一次 draw 悄悄抹掉，A/C 的诊断要覆盖它
- 或者「一旦显式 setSize 就锁定布局尺寸，draw 只更新 contentBounds」

**建议后者**，因为更符合「布局盒 / 内容盒分离」的目标。但这会改变现有行为，
需要先确认没有依赖方（components 里的调用点要过一遍）。

### B5 三个盒的文档

| 盒 | 来源 | 谁读 |
|---|---|---|
| 内容盒 `contentBounds`（只读） | 绘制命令真实 min/max | render / 诊断 |
| 布局盒 `width/height` | 显式设置或由内容推导 | `layoutRow` / `layoutColumn` |
| 命中盒 | 显式配置，默认跟随布局盒 | `hitTest` |

**三者不必相同** —— 不要把「布局盒 ≠ 内容盒」一律当错误。透明按钮热区就是合法的偏离。

### B6 回归项

- [ ] 重复命令不扩大边界
- [ ] 绘制顺序不改变 union 结果
- [ ] 非零起点、负坐标
- [ ] `drawCircle` / `drawRoundedRect` 同类缺陷
- [ ] `clear()` 后重画
- [ ] `setSize` 与 `draw` 的交错顺序

### 不做

**`Graphics.width/height` 变派生只读** —— 会推翻 `3a2055c` 刚确立的布局契约。

---

## 里程碑 C：尺寸冲突诊断（P1，依赖 A + B）

- 接入 B3 的 `contentBounds`，对「显式布局尺寸被后续绘制覆盖」给一次性诊断
- 消息带：节点名、内容边界、布局尺寸、下一步建议
- **允许关闭**（因为布局盒 ≠ 内容盒也可能合法）
- 可选：内容盒 / 布局盒可视化开关，用于定位「数值看似正确」的问题

这一条不能在 B 之前做 —— 「比较内容范围」本身就需要可靠的 contentBounds。

---

## 里程碑 D：坐标契约（P2，依赖 B + C）

### D1 先给 Graphics 显式左上入口

```ts
app.createGraphics({ origin: 'topLeft' })   // 矩阵用 pivot = 0
// 或 g.useTopLeftOrigin()
```

**旧创建方式行为完全不变。** 新入口保证 `drawRect(0, 0, w, h)` 对应预期的屏幕区域。

### D2 新契约要下沉到所有读坐标的地方

只改绘制会产生新的不一致。至少同步：

- `getBounds()`
- `hitTest()`
- 裁剪（`setClipRect` / `Scroll` 的 mask）
- 旋转 / 缩放中心

### D3 再谈 alignment / pivot 拆分

如果 D1 落地后发现还需要解耦「定位参考点」，再设计 `alignment` / `pivot`：

- 写清单位、参考盒、变换顺序
- 默认值变更与 `anchor` 废弃单独规划，**不进 1.x 补丁版本**

### 验收

- `anchor` = 0 / 0.5 两种取值
- 非零与负坐标绘制
- 父级变换
- 旋转缩放
- **绘制范围与命中范围的一致性**
- 真实迁移的三个场景截图比对：全屏遮罩、面板背景、按钮底色

---

## 明确不做的

| 项 | 原因 |
|---|---|
| `Graphics.width/height` 派生只读 | 推翻刚确立的布局契约 |
| `hitTestUI(x, y)` | 需先定义交互资格契约（坐标空间、祖先可见性、裁剪、透明节点、遮挡）。起点应是「显式交互节点」，不能遍历全树 |
| `render` 签名替换 | 兼容性；用新增别名替代 |
| text setter 自动重置样式 | 会改变现有行为（保留 `letterSpacing` 属样式持久化，不是泄漏） |

## 已具备防护、不重复做

- 字距归零：`applyLetterSpacing` 在 spacing=0 时写 `"0px"`（`3a2055c`）
- 文字首次布局零尺寸：`f006433` 已修

---

## 建议的执行顺序

1. **A**（1 个 PR，改动面小，立刻能拦住未来同类问题）
2. **B**（1 个 PR，先把 B1/B2/B3 做掉；B4 的语义变更单独评估）
3. **C**（跟在 B 后面接入）
4. **D**（单独的里程碑，动坐标前先补足验收）

A 和 B 可以并行开发，但 A 合入更快、成本更低，先落地能让 B 的实现过程本身受益。
