# Tiny UI 开发指南

## 1. 构建与开发命令

这是一个由 **pnpm** 管理的 monorepo，并使用 **just** 作为任务运行器。

### 全局命令（仓库根目录）
- **安装依赖**：`pnpm install`
- **构建全部包**：`just build`
  - 使用 `esbuild` 以 production 模式构建。
  - Core 构建产物：`dist/tiny-ui-core.js`（IIFE，全局变量 `TinyUI`）。
  - Components 构建产物：`dist/tiny-ui-components.js`。
- **开发 watch 模式**：`just dev`
  - 使用 `esbuild` 以 development 模式构建。
  - 同时运行 `tsc` 生成类型声明。
- **生成类型声明**：`just tsc`
  - 使用 `tsc` 开启 declaration emission，输出到各包的 `types/` 目录。
- **提交**：`just commit msg="<message>"`
  - 会根据当前目录名自动添加提交信息前缀。
  - **注意**：如果你不使用 `just`，也需要手动遵循同样的提交信息前缀约定。
- **发布**：`just publish [versionType]`（默认：`patch`）
  - 会构建、升级版本号、提交并发布到 registry。

### 项目结构
- `packages/core`：核心 WebGL 渲染引擎。
- `packages/components`：UI 组件库（依赖 core）。
- `justfile`：所有构建/工作流脚本的集中定义。

### 测试
- **当前状态**：无自动化测试套件（`test` 脚本会直接 echo error）。
- **手动测试**：
  - `packages/core/example/` 下的 HTML 用于手动验证。
  - 使用 `TinyUI.testRender()` 可以快速目测验证渲染管线。

---

## 2. 代码风格与约定

### 格式化与 lint
- 全部源码使用 **TypeScript**（`.ts`）。
- 未发现显式的 Prettier/ESLint 配置（以现有代码风格为准）：
  - **缩进**：2 spaces
  - **引号**：双引号 `""`
  - **分号**：必须
  - **行宽**：约 80-100 字符

### 命名约定
- **类**：PascalCase（例如 `TinyUI`, `DisplayObject`）
- **接口/类型**：PascalCase（例如 `TinyUIOption`, `StashGlStateParam`）
- **方法/函数**：camelCase（例如 `updateViewport`, `createBitmapFromUrl`）
- **变量**：camelCase
- **私有属性**：常见 `_` 前缀（例如 `_renderTree`, `_imageLocation`），也会使用 `private`
- **常量**：UPPER_SNAKE_CASE（例如 shader 源码常量 `VERTEX_SHADER_SOURCE`）

### TypeScript 实践
- `tsconfig.json` 未显式启用 `strict`，但项目整体类型使用较多。
- 编译输出：CommonJS，target ES2018。
- 导出风格：
  - Core：入口使用 `export = TinyUI`（兼容 legacy CommonJS）。
  - Components：标准 ES 导出（`export * from ...`）。
- 常见做法：显式返回类型（例如 `: Promise<Bitmap>`）。

### 架构与模式
- **渲染**：自研 WebGL 引擎。
  - 关键模块：`ShaderManager`、`TextureManager`、`EventManager`。
  - 显示树：`Container` + `DisplayObject`。
- **GL 状态管理**：
  - `stashGlState` / `restoreGlState` 用于与其他 WebGL 渲染共存（保持“礼貌”）。
  - **重要实现要点**（来自现有实现约束）：
    - **VAO 处理**：当 VAO 扩展可用但当前没有绑定 VAO（`vao === null`）时，vertex attributes 仍必须被跟踪与恢复。条件应为 `!this.hasVAO() || snapshot.vao === null`。
    - **平台差异**：某些平台（例如部分小游戏平台）可能在 `GLState.install()` 包装 GL 方法之前就调用了 GL。确保初始化序列中在合适时机调用 `install()`。
    - **状态跟踪开关**：通过 `trackingEnabled` 控制是否记录状态变化；在 `snapshot()` 与 `restore()` 期间会关闭跟踪。
    - **性能**：避免在热路径（例如 `snapshot()`）中调用 `readFromGL()`，它会查询真实 GL 状态，某些平台上可能很慢（~10ms）。应依赖被包装函数的状态跟踪。
- **依赖注入**：`TinyUI` 实例会传递给子对象（例如 `new Bitmap(this)`）。
- **异步加载**：资源加载使用 Promise（例如 `loadTexture`）。

### 错误处理
- 初始化阶段：若 WebGL 不可用会抛错（`throw new Error("WebGL not supported")`）。
- Shader：编译/链接失败应被记录或抛出（当前由 `ShaderManager` 负责）。

### 面向 Agent 的开发流程
1. **验证**：修改 core 逻辑前，先查看 `packages/core/example/*.html`，理解期望行为。
2. **构建**：修改后运行 `just build` 或 `just tsc`，确保能编译通过。
3. **提交**：提交信息要清晰；使用 `just commit` 时前缀会自动处理。

---

## 3. 坐标系与变换（必读）

本库采用“**屏幕像素坐标系**”作为 UI 世界坐标，并在顶点着色器中将其映射到 WebGL 裁剪空间（clip space）。

### 3.1 坐标空间总览
- **Stage/UI 世界坐标（像素）**：
  - 单位为像素，坐标原点在 **左上角**。
  - `x` 向右为正，`y` 向下为正。
  - 传入 shader 的 `a_position`（顶点位置）即为该坐标系下的像素值。
- **WebGL 裁剪空间（clip space / NDC）**：
  - `x/y` 范围为 `[-1, +1]`，原点在中心。
  - WebGL 约定 `y` 向上为正。

### 3.2 像素坐标到裁剪空间的映射（渲染时真实发生的事）
顶点着色器逻辑（概念）：
1. 应用模型矩阵 `u_matrix`：把局部顶点变换到世界（像素）坐标。
2. 除以 `u_resolution = (canvas.width, canvas.height)`：把像素归一化到 `[0, 1]`。
3. 线性变换到 `[-1, +1]`。
4. **翻转 Y**：因为 UI `y` 向下，而 WebGL `y` 向上。

结论：
- 你在业务代码里使用的 `(0, 0)` 代表左上角。
- `y` 增大表示向屏幕下方移动。
- 不需要你在业务层额外做 Y 翻转；库在 shader 里已经处理了。

### 3.3 DPR 与“像素”的含义（很关键）
- `TinyUI` 初始化时会把 `canvas.width/height` 设置为 `canvas.clientWidth/height * devicePixelRatio`。
- 因此：
  - `TinyUI.stageWidth / stageHeight / stageSize` 对应的是 **绘制缓冲区像素**（包含 DPR），不是 CSS 像素。
  - 你设置 `node.x/y/width/height` 等属性时，默认就是以该绘制像素为单位。

### 3.4 锚点（anchor）与 `x/y` 的语义
- `anchorX/anchorY` 为归一化值（常用 `0`、`0.5`、`1`）。
- 本库的变换在本地矩阵中会考虑锚点：
  - 会先将对象以 `(x - width*anchorX, y - height*anchorY)` 平移（把锚点“落到” `(x, y)`）。
  - 若存在旋转/缩放，则围绕锚点进行（先把锚点平移到原点，再旋转/缩放，再移回）。
- 直观理解：
  - `anchorX = 0, anchorY = 0`：`x/y` 表示对象左上角。
  - `anchorX = 0.5, anchorY = 0.5`：`x/y` 表示对象中心点。

### 3.5 父子节点矩阵合成
- 渲染时会把父矩阵与子矩阵相乘得到组合矩阵，并作为 `u_matrix` 上传。
- 因此父节点的平移/旋转/缩放会影响所有子节点（标准显示树行为）。

### 3.6 事件坐标与命中检测（hit test）
- 命中检测会使用对象的**全局变换矩阵**求逆，把全局坐标转换回本地坐标再判断是否落在边界内。
- 因此事件系统传入命中检测的坐标必须是同一套 **stage 像素坐标系**（左上原点、y 向下）。

---

## 4. 快速上手（最小可用路径）

下面的用法以 `packages/core/example/*.html` 中实际存在的 API 为准。

### 4.1 初始化
- 页面准备一个全屏 canvas（CSS `width/height: 100%`，禁用默认 touch 行为）。
- 创建实例：
  - `const tinyUI = new TinyUI(canvas);`

### 4.2 创建节点并挂到显示树
- 所有内容都挂在 `tinyUI.root` 下：
  - `tinyUI.root.addChild(node);`

常用创建 API：
- `tinyUI.createText(text)`
- `tinyUI.createGraphics()`
  - `graphics.drawRect(x, y, width, height, color)`
  - `graphics.drawCircle(x, y, radius, color)`
- `tinyUI.createBitmapFromUrl(url)`（异步，返回 Promise）
- `tinyUI.createBitmapFromImage(image)`（同步）
- `tinyUI.createContainer()`

### 4.3 渲染
- 首次或全量渲染：`tinyUI.render()`
- 需要与外部 WebGL 共存或做“补丁式”渲染时：`tinyUI.patchRender()`
  - 内部会 `snapshot` 当前 GL 状态，渲染 UI，再 `restore`，减少对宿主的污染。

### 4.4 交互事件
- 节点支持事件监听（示例中出现的事件包括）：
  - `touchstart`
  - `touchmove`
  - `touchend`

用法：
- `node.addEventListener("touchstart", () => { ... })`

### 4.5 尺寸与布局的常用技巧
- 通过 `tinyUI.stageSize` 获取舞台尺寸（绘制缓冲区像素）。
- 典型用法（例如做一个全屏容器）：
  - `container.setSize(tinyUI.stageSize)`
  - `container.moveTo(container.width / 2, container.height / 2)`（若容器以中心锚点/定位方式实现）

---

## 5. 环境与工程信息
- 包管理器：pnpm（v10+）。
- 构建工具：esbuild + tsc（用于类型）。
- monorepo：启用 workspace（`pnpm-workspace.yaml`）。
- Git：`justfile` 内含 git 辅助命令（`git add`、`git commit` 等）。

---

## 6. 其他规则
- **ast-grep**：当你需要做语法/结构级搜索时，默认使用：
  - `sg --lang typescript -p'<pattern>'`
