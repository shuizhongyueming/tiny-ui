# Tiny UI - Agent Development Guide

## Build Commands

This is a pnpm monorepo using `just` as the task runner. Commands must be run from within a package directory (e.g., `packages/core/`).

### Essential Commands
- `pnpm install` - Install dependencies
- `just build` - Production build with esbuild (outputs to `dist/`)
- `just dev` - Development mode + type generation
- `just tsc` - Generate TypeScript declarations to `types/`
- `just commit msg="<message>"` - Commit with package name prefix

### Testing
Three-tier test architecture is now in place:

**1. Unit Tests** (`pnpm run test:unit`)
- Location: `packages/core/tests/unit/`
- Tools: Vitest + jsdom
- Purpose: Pure logic tests (Matrix, Container, DisplayObject)

**2. Integration Tests** (`pnpm run test:integration`)
- Location: `packages/core/tests/integration/`
- Tools: Vitest Browser mode + Playwright
- Purpose: Component interaction, lifecycle, patch mode

**3. Visual Regression Tests** (`pnpm run test:visual`)
- Location: `packages/core/tests/visual/`
- Tools: Playwright with screenshot comparison
- Purpose: Example HTML screenshot regression testing
- Commands:
  - `just test-visual` - Run visual tests
  - `just test-visual-update` - Update baseline screenshots
  - `just test-visual-report` - View test report
- Notes:
  - Screenshots stored in `tests/visual/__snapshots__/` (gitignored)
  - Threshold: 100 pixel difference, 10% color tolerance
  - Requires `dist/` to be built first

**Manual Testing**: Open `packages/core/example/*.html` files in browser
- Use `TinyUI.testRender()` for quick visual verification
- Each package has its own `justfile` with commands

## Code Style & Conventions

### TypeScript
- All source in TypeScript (`.ts`)
- Target: ES2018, CommonJS output
- Strict mode: Not enabled, but use types extensively
- Explicit return types preferred (e.g., `: Promise<Bitmap>`)

### Formatting
- **Indent**: 2 spaces
- **Quotes**: Double `"`
- **Semicolons**: Required
- **Line width**: ~80-100 chars

### Naming
- **Classes**: PascalCase (`TinyUI`, `DisplayObject`)
- **Interfaces/Types**: PascalCase (`TinyUIOption`)
- **Methods/Functions**: camelCase (`updateViewport`)
- **Variables**: camelCase
- **Private**: `_` prefix or `private` keyword
- **Constants**: UPPER_SNAKE_CASE (`VERTEX_SHADER_SOURCE`)

### Imports & Exports
- Core package: `export = TinyUI` (CommonJS compatibility)
- Components: Standard ES exports (`export * from ...`)
- Import order: 1) External libs 2) Internal types 3) Internal modules

### Error Handling
- Throw errors for unrecoverable states (e.g., `throw new Error("WebGL not supported")`)
- Shader failures should be logged or thrown by `ShaderManager`

## Architecture Overview

### Core Concepts
- **WebGL Engine**: Custom rendering system
  - Key: `ShaderManager`, `TextureManager`, `EventManager`
  - Display tree: `Container` + `DisplayObject`
- **GL State**: `stashGlState` / `restoreGlState` for coexistence
  - Track VAO state: `!this.hasVAO() || snapshot.vao === null`
  - Never call `readFromGL()` in hot paths (~10ms on some platforms)
- **Coordinates**: Screen pixel space (origin top-left, y down)
  - DPR handled automatically
  - Anchor system: `anchorX/Y` normalized (0-1)
- **Events**: Touch + Mouse support with propagation control
  - `stopPropagation()` - stop bubbling
  - `stopImmediatePropagation()` - stop same-level listeners

## Development Workflow

1. **Verify**: Check `packages/core/example/*.html` for expected behavior
2. **Type Check**: `just tsc` (must pass before commit)
3. **Build**: `just build` (verify dist/ output)
4. **Document**: Update `llvm.txt` for API changes

### API Documentation (llvm.txt)
Each package has an `llvm.txt` describing public APIs:
- Update when adding/modifying exports
- Mark breaking changes with "⚠️ Breaking Change"
- Keep version in sync with package.json

## Event System Notes

Touch events mapped to mouse events with 300ms window:
```typescript
// If touchstart.stopPropagation() called,
// corresponding mousedown will also be stopped
touchEventRecords: Map<EventName, { stopTypes: StopType[], time: number }>
```

### Event Propagation

**Propagation control:**
- `stopPropagation()` - stop bubbling to parent nodes
- `stopImmediatePropagation()` - stop other listeners on same node
- `stop()` - convenience method for both

**Dispatch logic:**
```typescript
// Before traversing children, record event state
const handledBefore = event.handled;

// ... traverse children recursively ...

// After children traversal, check if THIS branch handled the event
// (not some other branch in the tree)
const handledByChildren = !handledBefore && event.handled;
const needsHitTest = !handledByChildren;
```

**Event target:**
- `event.target` - set only once (first triggered node), never overwritten during bubbling
- `event.currentTarget` - use `this` inside listener to get current node

## Quick Reference

### Common Tasks
```bash
# Type check single package
cd packages/core && pnpm exec tsc --noEmit

# Build and type check
cd packages/core && just build && just tsc

# Check exports match documentation
grep -r "^export" src/ | wc -l  # compare with llvm.txt
```

### File Structure
```
packages/core/
  src/           - TypeScript source
  dist/          - Built output (IIFE, global TinyUI)
  types/         - Type declarations
  example/       - Manual test HTMLs
  llvm.txt       - API documentation
```

## BBCode Rich Text System

### Architecture Overview

BBCode 解析和渲染分为三个阶段：

```
Text.text (BBCode string)
    │
    ▼
BBCodeParser.parse()              // 解析为 ParsedSegment[]
    │
    ├── Tag stack tracking        // 最多 50 层嵌套
    ├── Escape handling           // [[ 转义为 [
    └── Unclosed tag recovery     // 未闭合标签回退为纯文本
    │
    ▼
BBCodeTypes.applyTagToStyle()     // 应用标签到样式状态
    │
    ├── b/i/u/s                   // 粗体/斜体/下划线/删除线
    ├── size/font/color           // 大小/字体/颜色
    ├── opacity/hide              // 透明度/隐藏
    ├── background                // 背景色
    ├── stroke/outline            // 描边/轮廓
    └── offsetx/offsety           // 偏移
    │
    ▼
Text.updateTextureBBCode()        // 布局渲染
    │
    ├── Line breaking             // 自动换行
    ├── RenderUnit generation     // 生成渲染单元
    ├── Line alignment            // 行对齐
    └── Canvas 2D rendering       // 绘制到离屏 Canvas
```

### Key Features

**1. 嵌套标签支持**
- 使用栈结构跟踪标签状态
- 最多 50 层嵌套深度限制
- 后闭合的标签优先匹配

**2. 百分比偏移**
```typescript
// offsety 支持百分比，相对于行高
[offsety=-30%]W[/offsety][offsety=30%]e[/offsety]
```

**3. 未闭合标签处理**
- 检测到未闭合标签时，回退到最早未闭合标签位置
- 将该位置之后的所有内容作为纯文本渲染

### Performance Notes

- BBCode 解析发生在 `updateTexture()` 时
- 解析结果不缓存，每次文本变更重新解析
- 对于静态文本，建议启用后手动调用 `updateTexture()` 预渲染

## Safe Section Texture Upload Pattern

### Problem Context
When tiny-ui coexists with other WebGL engines (e.g., Phaser), runtime texture uploads outside the safe section can pollute shared GL state, causing rendering artifacts (e.g., black squares for Canvas Text).

### Solution Architecture

**Core Principle**: All GL operations that modify state must happen within the "safe section" - between `GLState.snapshot()` and `GLState.restore()`.

```
TinyUI.patchRender()
    ├── stashGlState()          // snapshot current GL state
    ├── render()
    │   ├── _flushGLTasks()     // execute queued GL operations
    │   └── _renderTree()       // normal rendering
    └── restoreGlState()        // restore original GL state
```

### Implementation Details

**1. GL Task Queue (`TinyUI.enqueueGLTask`)**
- If already in safe section: execute immediately
- Otherwise: queue for next `patchRender()`

**2. Deferred Texture Loading (`TextureManager.loadTexture`)**
```typescript
async loadTexture(url: string): Promise<WebGLTexture> {
  // 1. Check cache
  // 2. Check inflight (merge concurrent requests)
  // 3. Load image (CPU only, no GL)
  // 4. Enqueue GL upload task
  // 5. Return deferred.promise (resolves in safe section)
}
```

**3. GLState PixelStorei Tracking**
- Track `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, `UNPACK_ALIGNMENT`, `UNPACK_FLIP_Y_WEBGL`, `UNPACK_COLORSPACE_CONVERSION_WEBGL`
- Restore all pixelStorei states in single `restore()` call
- TextureManager only sets values, doesn't stash/restore per-texture

**4. Bitmap/Text Updates**
- Canvas 2D drawing: immediate
- GL texture creation/upload: enqueued via `enqueueGLTask()`
- Use `textureUpdateGen` to skip stale tasks

### Key Classes

| Class | Responsibility |
|-------|---------------|
| `TinyUI` | GL task queue, safe section management |
| `TextureManager` | Deferred loading, inflight tracking |
| `GLState` | GL state snapshot/restore, pixelStorei tracking |
| `Deferred<T>` | Promise wrapper for async resolution |

### Performance Benefits

- **Before**: N textures × 4 `getParameter` + 4 `pixelStorei` per texture
- **After**: 1 `GLState.restore()` for all pixelStorei states
- Concurrent requests to same URL automatically merged

### Code Patterns

**Enqueue GL Task:**
```typescript
this.app.enqueueGLTask(() => {
  if (this.destroyed) return;
  if (gen !== this.textureUpdateGen) return; // skip stale
  this.texture = this.app.textureManager.createImageTexture(image);
});
```

**Deferred Usage:**
```typescript
const deferred = new Deferred<WebGLTexture>();
// ... async work ...
deferred.resolve(texture);
return deferred.promise;
```

### Migration Notes

- `TextureManager` constructor now requires `TinyUI` instance: `new TextureManager(gl, app)`
- `loadTexture()` returns Promise that may not resolve until next `patchRender()`
- All texture operations (create/upload/delete) must go through safe section

---
**Note**: No Cursor rules or Copilot instructions exist in this repo.
