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
| **A** | 开发诊断骨架 | P1 | 无 | #3 第一批 — ✅ `87c9555` |
| **B** | Graphics 边界正确性 | P1 | 无（可与 A 并行） | #2 |
| **C** | 尺寸冲突诊断 | P1 | **B4 的决策** + A + B | #3 第二批 |
| **D** | 坐标契约 | P2 | B + C | #1 |

A 和 B 可并行。**C 的内容取决于 B4 选哪个方案**（见 B4）—— 必须先定 B4，
否则 C 可能诊断一个已经不存在的现象。

---

## 里程碑 A：开发诊断骨架（P1，独立可发）

目标：**让框架自己说出哪里错了**。本轮 5 个 bug 全是静默失败，这一层收益最直接。

### A1 诊断基础设施

- 开关：`TinyUI.debug`（开发构建默认开，生产构建默认关）
- **去重键 = 节点实例身份 + 诊断码**，不使用 name
  - ⚠️ 多个 `Graphics` 默认都叫 `"Graphics"`（`constructor(app, name = "Graphics")`）。
    按 name 去重会让第一个报错节点吞掉其他节点的同类诊断。
  - name **只用于消息展示**
- **零视口诊断按「零尺寸状态周期」去重**：进入零尺寸时报一次；恢复到有效尺寸后清标记；
  再次归零允许重新提示。（不是永久一次性）
- 消息格式：`[TinyUI] <name>.<API>: <发生了什么> → <怎么改>`
  必须带**可执行的修正建议**

验收：
- [ ] 同节点同诊断码一次会话只报一次
- [ ] 不同节点的同类问题**各自**能报出来
- [ ] 零视口：归零→恢复→再归零，能再次提示
- [ ] 生产构建零输出

### A2 Graphics 参数校验 —— 校验与诊断必须分离

🚨 **拒绝始终执行，`debug` 只控制诊断输出。**

不要写成 `if (debug) { validate(...) }` —— 那样生产构建仍然接受 `NaN` 并污染 bounds，
只是"没人看见"。这是本次最容易被实现错的一条。

```ts
// 正确形状：拒绝无条件，提示按需
function assertFinite(v, code, node, hint) {
  if (Number.isFinite(v)) return true;
  warnOnce(node, code, hint);   // 内部判 debug，关闭时直接 return
  return false;                 // 调用方据此丢弃这条命令
}
```

三类区分对待：

| 输入 | 处理 |
|---|---|
| `NaN` / `Infinity` / `null` / `undefined` | **丢弃命令** + 诊断 |
| 负的宽高或半径 | 保留命令 + 诊断（可能是调用方算错，但不武断拒绝） |
| 零尺寸 | **合法**（初始化、隐藏态），不报 |

`drawRoundedRect` 的 `radius` 可能是对象，要**逐字段**校验 `tl` / `tr` / `br` / `bl`。

验收（**两种构建都要过**）—— 已于 `87c9555` 完成：
- [x] 注入 `drawRect(0, 0, NaN, 10)` 后，后续**有效**绘制的边界未被污染
- [x] 开发构建：有诊断输出
- [x] **生产构建：同样不污染**（只是没有输出）
- [x] `drawRoundedRect` 的 radius 对象单字段非法时能拦住

实测（游戏侧生产构建）：`TinyUI.debug === false`、NaN 被拒绝、边界未被污染、
零尺寸合法、HUD 无视觉回归。变异测试四组全部能打中：
`validateGeometry` 恒 true（9 失败）、校验包进 `isDiagnosticsEnabled`（2 失败）、
去重键改用 name（1 失败）、零视口不 reset（1 失败）。

**尚未覆盖**：A4 的零视口检查目前只在 `Graphics.render` 里。
`Text` / `Container` 的绘制路径没有对应检查点 —— 若要补，等 B 阶段的
`contentBounds` 落地后一起做，那时才有可靠依据判断「这批内容是否可见」。

### A3 `Text.setSize` 一次性提示

指向替代方案：改 `fontSize`（字号）/ 改整体 `scale`（视觉大小）/ 改外层布局容器（占位）。

### A4 零视口的绘制时提示

`stageWidth/Height` 为 0 时**仅在尝试绘制可见内容**时提示。
去重规则见 A1（按零尺寸状态周期，不是永久一次）。

不提供 `isReady()` —— "ready" 指有效视口、字体就绪、资源加载还是纹理上传，
一个布尔值说不清。

### A5 文档：两种渲染模式

- 独占渲染 → `render()`
- 与引擎叠加 → `patchRender()`
- 清屏条件：`patch=false` **且** `contextAttributes.alpha` 为真时才 `gl.clear`
- 共用 canvas：`manageCanvasSize: false`

---

## 里程碑 B：Graphics 边界正确性（P1）

目标：**让边界数值可信**。这是 C 和 D 的地基。

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

保持现有 `getBounds()`（全局语义）不变，新增局部只读，避免命名混淆。

### B4 尺寸模式 —— 先定契约，C 的形状取决于这里

现状是**隐性行为**：后续 `draw` 覆盖显式 `setSize`。

两个方案，必须选一个：

#### 方案 X：保持现状（draw 总是接管）

- 零行为变更，零风险
- `setSize` 的效果会被下一次 draw 抹掉 —— 需要文档化
- **C 的诊断对象** = 「显式 `setSize` 之后又被 `draw` 覆盖」（只在这种交错发生时触发）

#### 方案 Y：显式锁定（`setSize` 进入 explicit 模式）

- 语义清晰，契合「布局盒 / 内容盒分离」
- **改变现有行为**，必须过一遍 `packages/components/src` 的调用点
- 必须同时定义：`clear()` 是否解除锁定、如何恢复 auto 模式、`layoutRow/layoutColumn` 是否受影响
- **C 的诊断对象** = 「explicit 模式下 `contentBounds` 超出布局盒」

#### 建议：本轮做 X，Y 留到有明确需求时

理由：本轮目标是「边界可信」，不是「尺寸语义重构」。Y 会改变所有既有调用方的行为，
风险与收益不匹配。

**⚠️ 定了 B4 之后，C 才能写。** 如果选 X，C 只诊断「setSize 被覆盖」这一种交错；
如果将来走 Y，C 要改成「内容超出布局盒」。两者不能同时成立。

### B5 命中盒：本轮不改，只文档化现状

现状：`hitTest()`（`DisplayObject.ts:318`）只有 `0 <= localPoint <= width/height` 判断，
**没有独立配置入口**。

因此要明确写下来：

- 对 `drawRect(50, 60, 10, 20)`，**新增 `contentBounds` 不会修复点击错位** ——
  点击仍按 `0..10 × 0..20` 判定。
- 本轮**不新增**命中区域 API。

三个盒的**当前**关系：

| 盒 | 现在 |
|---|---|
| 内容盒 | 本轮新增：只读 `contentBounds`（真实 min/max） |
| 布局盒 | `width/height`（`layoutRow`/`layoutColumn` 读它） |
| 命中盒 | **就是布局盒**，无独立 API |

不要把「布局盒 ≠ 内容盒」一律当错误 —— 透明按钮热区是合法的偏离。
命中区域 API 需要先定义坐标空间、祖先可见性、裁剪、透明节点、遮挡规则，单独开 issue。

### B6 回归项

- [ ] `4 × drawRect(0,0,100,100)` 尺寸保持 100×100（幂等）
- [ ] 绘制顺序不改变 union 结果
- [ ] 非零起点、负坐标
- [ ] `drawCircle` / `drawRoundedRect` 同类缺陷
- [ ] `clear()` 后重画
- [ ] `setSize` 与 `draw` 的交错顺序（按 B4 选定的方案断言）

---

## 里程碑 C：尺寸冲突诊断（P1，依赖 A + B4 + B）

**先读 B4。** 这条的内容由 B4 的方案决定：

| B4 = X（保持现状） | B4 = Y（显式锁定） |
|---|---|
| 诊断「显式 `setSize` 后被后续 `draw` 覆盖」 | 诊断「explicit 模式下 `contentBounds` 超出布局盒」 |
| 只在检测到 setSize → draw 的交错时触发 | 每次 explicit 模式下的 draw 后比较 |

共同要求：

- 一旦接入 `contentBounds`（B3）就可以实现
- 消息带：节点名、内容边界、布局尺寸、下一步建议
- **可关闭** —— 因为布局盒 ≠ 内容盒也可能合法
- 可选：内容盒 / 布局盒可视化开关，用于定位「数值看似正确」的问题

---

## 里程碑 D：坐标契约（P2，依赖 B + C）

### D1 先定契约类型 —— 两个选项代价差一个量级

#### 选项 A：便捷入口（本质是自动设 `anchor = 0`）

```ts
app.createGraphics({ origin: 'topLeft' })   // 内部 anchorX = anchorY = 0
```

- `layoutRow` / `layoutColumn` **无需改动** —— 它们本来就按 `anchorX` 算位置
- `getBounds` / `hitTest` / 裁剪 **无需改动**
- 风险最低
- 局限：只是语法糖，调用方本来就能写 `anchorX = 0`

#### 选项 B：独立坐标模式（`pivot` 与 `anchor` 分离）

- 矩阵改用 `pivot`，`alignment` 管定位
- **必须同步 layout**：`src/utils/layout.ts` 里有 8 处按 anchor 补偿的写法
  （`it.x = cursor + it.anchorX * w`、`it.y = cursor - inkTop + it.anchorY * it.height` 等）。
  只改矩阵不改这些，"绕过了 anchor"的节点会再次偏移。
- **必须同步** `getBounds` / `hitTest` / 裁剪 / 旋转缩放中心
- 风险高，验收面大

#### 建议：本轮只做 A

B 单独做里程碑，动手前先写清 `pivot` 与 `alignment` 的定义：

- 单位与参考盒
- 变换顺序（translate → pivot → rotate/scale → alignment？）
- 默认值
- 与 `anchor` 的兼容策略

**⚠️ 如果将来做 B，`layout.ts` 的 8 处补偿必须列入验收范围**，
否则「矩阵改了、布局没改」会产生新的一批偏移，而且比现在更难查。

### D2 若走选项 A，改动范围

- `createGraphics` 增加 `origin` 选项
- 内部把 `anchorX/anchorY` 设为 0（与手动设等价，因此不需要动 layout）
- 文档 + 示例（`example/layout.html` 的 `anchorTopLeft` 包装可以删掉）

### D3 验收

- [ ] `anchor` = 0 / 0.5 两种取值下都能正确绘制
- [ ] 非零与负坐标绘制
- [ ] 父级有变换（scale / rotate）时仍正确
- [ ] 旋转缩放中心符合契约
- [ ] **命中结果符合「命中盒契约」**，不是「绘制范围 == 命中范围」
      （后者与透明热区设计冲突）
- [ ] 真实迁移的三个场景截图比对：全屏遮罩、面板背景、按钮底色

---

## 明确不做的

| 项 | 原因 |
|---|---|
| `Graphics.width/height` 派生只读 | 推翻 `3a2055c` 刚确立的布局契约 |
| 命中区域 API（`hitTestUI` / 显式热区） | 需先定义坐标空间、祖先可见性、裁剪、透明节点、遮挡规则；起点应是「显式交互节点」 |
| `render` 签名替换 | 兼容性；用新增别名替代 |
| text setter 自动重置样式 | 会改变现有行为（保留 `letterSpacing` 属样式持久化，不是泄漏） |
| 尺寸模式从 X 改到 Y | 本轮不动既有调用方行为 |

## 已具备防护、不重复做

- 字距归零：`applyLetterSpacing` 在 spacing=0 时写 `"0px"`（`3a2055c`）
- 文字首次布局零尺寸：`f006433` 已修

---

## 执行顺序

1. ~~**A**：一个 PR。~~ 已完成 `87c9555`（core 单测 84 → 123）。
2. **B1–B3**：一个 PR（union 幂等 + 真实 min/max + `contentBounds`）。
   **B4 的尺寸模式决策单独评估**，不和治疗确定性 bug 混在一个 PR。
3. **C**：跟在 B 后面，形状按 B4 的结论定。
4. **D**：单独里程碑，默认走选项 A。

A 和 B 可以并行开发，但 A 合入更快、成本更低，先落地能让 B 的实现过程本身受益。
