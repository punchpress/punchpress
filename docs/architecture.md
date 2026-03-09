# Editor Architecture

Punchpress is a browser-based design editor. The architecture is inspired by [tldraw](https://github.com/tldraw/tldraw): a plain TypeScript editor class owns all state and logic, React components are thin views that reach into it.

## Layers

### Layer 1: Editor Core (`apps/web/src/editor/`)

The `Editor` class is the brain. It is not a React component — it's a plain TypeScript object with methods and getters. Components never own editor state; they read it from the Editor and call its methods.

```
editor/
├── editor.ts                    # Editor class
├── constants.ts                 # Editor-wide constants (zoom limits, fonts, accent)
├── state/
│   └── store.ts                 # Zustand vanilla store (nodes, selection, viewport, editing)
├── tools/
│   ├── tool.ts                  # Base Tool class + shortcut routing
│   ├── pointer-tool.ts          # Select, move, deselect
│   ├── hand-tool.ts             # Pan (no-op pointer events, just shortcuts)
│   └── text-tool.ts             # Create text nodes, start editing
├── managers/
│   ├── font-manager.ts          # Async font loading + opentype.js cache
│   └── geometry-manager.ts      # Signature-based geometry cache
├── primitives/
│   ├── math.ts                  # clamp, round, format, toNumber, toSafeHex
│   ├── dom.ts                   # isInputElement
│   └── path-geometry.ts         # Bezier flattening, contour operations, bounds
└── shapes/
    └── warp-text/
        ├── model.ts             # createDefaultNode, getDefaultWarp, createId
        ├── warp-engine.ts       # Glyph layout, arch/wave/circle warps, SVG export
        └── straight-text-metrics.ts  # Unwarped text bounds (for editing overlay)
```

**Editor class responsibilities:**
- Owns the Zustand store, FontManager, GeometryManager, and tool instances
- Provides getters for derived state (`selectedNode`, `editingGeometry`, `editingMetrics`, etc.)
- Dispatches pointer events to the active tool via `dispatchCanvasPointerDown` / `dispatchNodePointerDown`
- Handles global keyboard events (delete, tool shortcuts via tools)
- Manages DOM refs for viewport (InfiniteViewer) and node elements
- Manages space-press panning state

**Store shape:**
```
activeTool        — "pointer" | "hand" | "text"
editingNodeId     — string | null
editingOriginalText — string
editingText       — string
fontRevision      — number (bumped when fonts load)
nodes             — array of node objects
selectedNodeId    — string | null
viewport          — { zoom: number }
```

**Tool system:**
Each tool extends `Tool` and implements `onCanvasPointerDown`, `onNodePointerDown`, and `onKeyDown`. The Editor routes events to `this.currentTool`. Adding a new tool = adding a new file in `tools/`, registering it in the Editor constructor.

**Shape system:**
Shape-specific logic lives under `shapes/<shape-name>/`. Currently only `warp-text` exists. Each shape has:
- `model.ts` — Node creation and default values
- Engine file(s) — Geometry computation, rendering data, export

When adding a new node type (e.g., image, vector shape), create a new folder under `shapes/`.

### Layer 2: React Bindings

Three files bridge the Editor to React:

```
editor/
├── editor-provider.tsx    # Creates Editor, provides via context, calls mount/dispose
├── use-editor.ts          # useEditor() — returns the Editor instance from context
└── use-editor-value.ts    # useEditorValue(selector) — reactive subscription to store slices
```

`useEditorValue((editor, state) => ...)` subscribes to the Zustand store with shallow equality. The selector receives both the `editor` instance and the raw store `state`, so it can access getters and computed values.

### Layer 3: Components (`apps/web/src/components/`)

Components are flat siblings that call `useEditor()` directly. No prop drilling for editor state.

```
components/
├── canvas/
│   ├── canvas.tsx              # InfiniteViewer viewport, pointer dispatch, space-pan
│   ├── canvas-nodes.tsx        # Maps node IDs → CanvasNode components
│   ├── canvas-node.tsx         # Single node SVG renderer
│   ├── canvas-overlay.tsx      # Moveable (drag/resize) + Selecto (lasso select)
│   ├── canvas-text-editor.tsx  # Inline text input overlay during editing
│   └── canvas-toolbar.tsx      # Tool buttons + zoom controls
├── panels/
│   ├── layers-panel.tsx        # Node list sidebar
│   ├── properties-panel.tsx    # Selected node properties sidebar
│   ├── warp-text-fields.tsx    # Property fields for warp text nodes
│   ├── warp-text-warp-fields.tsx  # Warp-specific sub-fields (arch bend, wave amplitude, etc.)
│   └── field-primitives.tsx    # Reusable form layout (Section, FieldRow, ColorField)
├── editor/
│   └── editor-shell.tsx        # Layout shell (Designer wrapper + 3 panels)
├── designer/
│   └── designer.tsx            # Generic layout primitives (frame, panels, floating toolbar)
├── ui/                         # Design system primitives (button, input, dialog, etc.)
└── settings-dialog.tsx
```

**Component tree:**
```
App
└── ThemeProvider
    └── EditorProvider
        └── EditorShell (layout only)
              ├── Canvas
              │   ├── CanvasNodes → CanvasNode (per node)
              │   ├── CanvasTextEditor
              │   ├── CanvasToolbar
              │   └── CanvasOverlay
              ├── LayersPanel
              └── PropertiesPanel → WarpTextFields → WarpTextWarpFields
```

## Data Flow

1. **State changes** go through the Editor: `editor.selectNode(id)`, `editor.updateNode(id, changes)`, `editor.setActiveTool("text")`
2. **Store updates** trigger Zustand subscriptions
3. **Components re-render** via `useEditorValue` selectors with shallow equality
4. **Pointer events** flow through the tool state machine: Canvas calls `editor.dispatchCanvasPointerDown(info)` → Editor forwards to `currentTool.onCanvasPointerDown(info)`
5. **Keyboard events** are handled globally by the Editor: delete/backspace → `deleteSelected()`, other keys → `currentTool.onKeyDown()`

## Warp Text Node

The only node type currently implemented. A warp text node has:

```
id, kind, text, fontUrl, fontSize, tracking,
fill, stroke, strokeWidth, warp, x, y
```

The `warp` field is a discriminated union:
- `{ kind: "none" }`
- `{ kind: "arch", bend: number }`
- `{ kind: "wave", amplitude: number, cycles: number }`
- `{ kind: "circle", radius: number, sweepDeg: number }`

**Rendering pipeline:**
1. `FontManager` loads `.ttf` fonts via opentype.js
2. `warp-engine.ts` → `layoutGlyphs()` converts text + font → glyph contours
3. Warp functions (`applyArchWarp`, `applyWaveWarp`, `buildCircleGeometry`) distort contours
4. `contoursToPath()` converts contours → SVG path `d` strings
5. `GeometryManager` caches results keyed by a signature of (text, font, fontSize, tracking, warp, fontRevision)
6. `CanvasNode` renders the paths as `<svg>` elements

## Key Libraries

| Library | Purpose |
|---------|---------|
| `zustand` | State management (vanilla store, React bindings via `useStore`) |
| `opentype.js` | Font parsing and glyph extraction |
| `react-infinite-viewer` | Infinite canvas with zoom/pan |
| `react-moveable` | Drag and resize handles |
| `react-selecto` | Lasso/click selection |
