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
**Note**: No automated test suite exists yet (the `test` script exits with error).
- Manual testing: Open `packages/core/example/*.html` files in browser
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
