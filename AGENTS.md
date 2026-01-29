# Tiny UI Development Guide

## 1. Build and Development Commands

This is a monorepo managed by **pnpm** using **just** as a task runner.

### Global Commands (Root)
- **Install Dependencies**: `pnpm install`
- **Build All Packages**: `just build`
  - Runs `esbuild` in production mode.
  - Core builds to `dist/tiny-ui-core.js` (IIFE, global `TinyUI`).
  - Components build to `dist/tiny-ui-components.js`.
- **Development Watch Mode**: `just dev`
  - Runs `esbuild` in development mode.
  - Runs `tsc` to generate types.
- **Type Generation**: `just tsc`
  - Runs `tsc` with declaration emission enabled, outputting to `types/` directories.
- **Commit**: `just commit msg="<message>"`
  - Commits changes with a prefix based on the current directory name.
  - **Note**: Always follow this convention manually if not using `just`.
- **Publish**: `just publish [versionType]` (default: `patch`)
  - Builds, bumps version, commits, and publishes to registry.

### Project Structure
- `packages/core`: Core WebGL rendering engine.
- `packages/components`: UI component library (depends on core).
- `justfile`: Central definition of all build/workflow scripts.

### Testing
- **Current Status**: No automated test suite (`test` script echoes error).
- **Manual Testing**:
  - `packages/core/example/` contains HTML files for manual verification.
  - Use `TinyUI.testRender()` for quick visual debugging of the rendering pipeline.

## 2. Code Style & Conventions

### Formatting & Linting
- **TypeScript**: Used for all source code (`.ts`).
- **Formatter**: No explicit Prettier/ESLint config found.
  - **Indent**: 2 spaces.
  - **Quotes**: Double quotes `""`.
  - **Semicolons**: Always use semicolons.
  - **Line Length**: approx 80-100 chars (inferred from existing code).

### Naming Conventions
- **Classes**: PascalCase (e.g., `TinyUI`, `DisplayObject`).
- **Interfaces/Types**: PascalCase (e.g., `TinyUIOption`, `StashGlStateParam`).
- **Methods/Functions**: camelCase (e.g., `updateViewport`, `createBitmapFromUrl`).
- **Variables**: camelCase.
- **Private Properties**: often prefixed with `_` for internal use (e.g., `_renderTree`, `_imageLocation`), though `private` keyword is also used.
- **Constants**: UPPER_SNAKE_CASE for shader sources and static configuration (e.g., `VERTEX_SHADER_SOURCE`).

### TypeScript Practices
- **Strictness**: `strict` mode is NOT explicitly enabled in `tsconfig.json`, but types are used extensively.
- **Modules**: CommonJS output, ES2018 target.
- **Exports**: 
  - Core: `export = TinyUI` pattern is used in the main entry point (legacy CommonJS compatibility).
  - Components: Standard ES exports (`export * from ...`).
- **Explicit Types**: Return types are frequently explicit (e.g., `: Promise<Bitmap>`).

### Architecture & Patterns
- **Rendering**: Custom WebGL engine.
  - Uses `ShaderManager`, `TextureManager`, `EventManager`.
  - Display tree structure with `Container` and `DisplayObject`.
- **GL State Management**:
  - `stashGlState` and `restoreGlState` are critical for playing nice with other WebGL contexts.
  - **Important**: The `GLState` class tracks WebGL state by wrapping GL functions. Key implementation details:
    - **VAO Handling**: When VAO extension is available but no VAO is currently bound (`vao === null`), vertex attributes must still be tracked and restored. The condition should be `!this.hasVAO() || snapshot.vao === null`.
    - **Platform Differences**: Some platforms (e.g., certain mini-game platforms) may call GL functions before `GLState.install()` wraps them. Ensure `install()` is called at the right time in the initialization sequence.
    - **State Tracking**: The class uses `trackingEnabled` flag to control whether state changes are recorded. This is disabled during `snapshot()` and `restore()` operations.
    - **Performance**: Avoid calling `readFromGL()` in hot paths (like `snapshot()`) as it queries the actual GL state which can be slow (~10ms on some platforms). Rely on the wrapped function tracking instead.
- **Dependency Injection**: `TinyUI` instance is passed to children (e.g., `new Bitmap(this)`).
- **Async Loading**: Asset loading returns Promises (e.g., `loadTexture`).

### Error Handling
- **Initialization**: Throw Errors if WebGL is not supported (`throw new Error("WebGL not supported")`).
- **Shaders**: Shader compilation failures should likely be logged or thrown (handled in `ShaderManager`).

### Development Workflow for Agents
1. **Verify**: Before changing core logic, check `packages/core/example/*.html` to understand expected behavior.
2. **Build**: After changes, run `just build` or `just tsc` to ensure compilation passes.
3. **Commit**: Use descriptive messages. If using `just commit`, the directory prefix is automatic.

## 3. Environment Specifics
- **Package Manager**: pnpm (v10+).
- **Build Tool**: esbuild + tsc (for types).
- **Monorepo**: Workspace enabled in `pnpm-workspace.yaml`.
- **Git**: `justfile` includes helpers for git operations (`git add`, `git commit`).

## 4. Other Rules
- **ast-grep**: When performing searches that require syntax-aware or structural matching, default to `sg --lang typescript -p'<pattern>'`.
