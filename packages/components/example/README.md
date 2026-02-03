# Tiny UI Components Examples

Interactive examples demonstrating the usage of Tiny UI Components library.

## Getting Started

### Prerequisites

Make sure both core and components packages are built:

```bash
# From project root
cd packages/core && just build
cd ../components && just build
```

### Running Examples

Simply open any HTML file in your browser:

```bash
# Open the main index
open packages/components/example/index.html

# Or open specific examples
open packages/components/example/adjustTo.html
```

Alternatively, use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Then navigate to:
# http://localhost:8000/packages/components/example/
```

## Available Examples

### adjustTo.html

Demonstrates the `adjustTo` utility for positioning display objects relative to each other.

**Features shown:**
- `willContain=false`: Positioning siblings (considers parent's scale)
- `willContain=true`: Positioning children (ignores parent's scale in local coordinates)
- All 9 alignment combinations (left/center/right × top/center/bottom)
- Offset positioning with `move` parameter
- Scale-aware layout calculations

**Key concepts:**
```javascript
const { adjustTo } = TinyUIComponents.utils;

// Position siblings (scale-aware)
adjustTo(checker, false)(target, { h: 'center', v: 'top' });

// Position children (local coordinates)
adjustTo(container, true)(child, { h: 'left', v: 'bottom' }, { x: 10, y: -10 });

// IMPORTANT: For Text objects, call updateTexture() before adjustTo
const text = tinyUI.createText('Hello');
text.fontSize = 24;
text.updateTexture(); // Must call this to get correct width/height
adjustTo(container, true)(text, { h: 'center', v: 'center' });
```

**Important Note:**
- Text objects must call `updateTexture()` before using `adjustTo` to ensure correct dimensions
- Without `updateTexture()`, width/height may be initial or stale values, causing incorrect positioning

## Adding New Examples

1. Create a new HTML file in this directory
2. Follow the structure of existing examples
3. Include core and components scripts:
   ```html
   <script src="../../core/dist/tiny-ui-core.js"></script>
   <script src="../dist/tiny-ui-components.js"></script>
   ```
4. Add a link to `index.html`

## Notes

- All examples use the IIFE (browser globals) build
- The core library is available as `window.TinyUI`
- The components library is available as `window.TinyUIComponents`
- Examples are designed for manual testing and visual verification