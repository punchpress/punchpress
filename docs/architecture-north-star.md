# Punchpress Architecture North Star

## Guiding Principle

Components should access the state they need directly, not receive it through props. The editor instance is the single source of truth — components reach into it, not the other way around.

This is the core lesson from tldraw: a single `useEditor()` hook replaces all prop drilling. Components are flat siblings, not deeply nested parent-child chains.

---

## Current Problems

| Problem | Where | Impact |
|---------|-------|--------|
| Prop drilling | Canvas (13 props), CanvasStage (21 props) | Every new feature adds more props to thread through |
| God component | Canvas.tsx handles viewport, selection, tools, keyboard, rendering | Can't change one concern without risking others |
| Scattered tool logic | Tool behavior is if/else chains inside event handlers | Adding a new tool means editing Canvas.tsx |
| Mixed state access | Some components use context, some receive props, some use refs | Inconsistent and hard to follow |
| Derived state in hooks | useEditorSession computes 8+ derived values on every render | Session hook is a bottleneck — all consumers re-render together |

---

## Target Architecture

### Layer 1: Editor Core (no React)

A plain TypeScript `Editor` class that owns all state and logic. This is the brain.

```
apps/web/src/editor/
├── editor.ts              # Editor class — the single source of truth
├── tools/
│   ├── tool.ts            # Base Tool class (state machine node)
│   ├── pointer-tool.ts    # Select/move/resize behavior
│   ├── hand-tool.ts       # Pan behavior
│   └── text-tool.ts       # Text creation/editing behavior
├── state/
│   └── store.ts           # Zustand store (nodes, selection, viewport)
├── managers/
│   ├── font-manager.ts    # Font loading + cache (replaces font-cache.js + use-font-preload.js)
│   └── geometry-manager.ts # Geometry computation + cache (replaces use-node-geometries.js)
├── primitives/
│   ├── math.ts            # Vec2, clamp, lerp (replaces math-utils.js)
│   ├── bounds.ts          # BBox operations (replaces scattered Math.max patterns)
│   └── path.ts            # Path geometry (replaces path-geometry.js)
├── warp-engine.ts         # Text warping (stays mostly as-is)
├── constants.ts
├── model.ts
└── dom-utils.ts
```

**Key decisions:**
- `Editor` class is not a React component. It's a plain object with methods.
- Tools are a state machine, not if/else chains. Each tool handles its own pointer/keyboard events.
- Managers handle cross-cutting concerns (fonts, geometry caching). They live on the Editor instance.
- Primitives are pure functions with no dependencies.

### Layer 2: React Bindings (thin bridge)

A small set of hooks and a provider that connect the Editor to React.

```
apps/web/src/editor/
├── editor-provider.tsx    # Creates Editor, provides via context
├── use-editor.ts          # useEditor() — returns the Editor instance
└── use-editor-value.ts    # useEditorValue(selector) — subscribes to specific state
```

**Key decisions:**
- `useEditor()` is the only way components access the editor. No prop drilling.
- `useEditorValue(fn)` subscribes to a specific slice of state (like Zustand's selector pattern, but accessing editor methods too).
- The provider creates the Editor instance and provides it. That's all it does.

### Layer 3: Components (flat, focused)

Components are flat siblings that each call `useEditor()` directly. No prop threading.

```
apps/web/src/components/
├── editor-shell.tsx       # Layout shell (sidebar + canvas area)
├── canvas/
│   ├── canvas.tsx         # Just the viewport container (InfiniteViewer)
│   ├── canvas-nodes.tsx   # Renders all nodes as SVG
│   ├── canvas-node.tsx    # Single node renderer
│   ├── canvas-overlay.tsx # Selection outlines, resize handles (Moveable)
│   ├── canvas-text-editor.tsx  # Inline text editing
│   └── canvas-toolbar.tsx # Floating tool buttons + zoom
├── panels/
│   ├── layers-panel.tsx
│   └── properties-panel.tsx
├── header/
│   └── editor-header.tsx
└── ui/                    # Design system primitives (stays as-is)
```

**Key decisions:**
- `canvas/` is a flat folder, not nested components. Canvas doesn't pass props to CanvasNodes — CanvasNodes calls `useEditor()` itself.
- No `CanvasStage` intermediary. The stage was a prop-forwarding middleman — delete it.
- `canvas-overlay.tsx` owns Moveable/Selecto integration. Canvas doesn't know about selection mechanics.
- Panels call `useEditor()` directly. No context extraction + prop forwarding through Designer.

---

## How Components Access State (Before → After)

### Before (prop drilling)
```
EditorSessionProvider
  └── EditorShell
        └── EditorCanvasPane (extracts 11 values from context)
              └── Canvas (receives 13 props)
                    └── CanvasStage (receives 21 props)
                          └── CanvasNode (receives 6 props)
```

### After (direct access)
```
EditorProvider
  ├── EditorShell (layout only)
  │     ├── Canvas (calls useEditor, manages viewport)
  │     │     ├── CanvasNodes (calls useEditor, renders nodes)
  │     │     ├── CanvasOverlay (calls useEditor, handles selection)
  │     │     ├── CanvasTextEditor (calls useEditor, handles editing)
  │     │     └── CanvasToolbar (calls useEditor, tool buttons)
  │     ├── LayersPanel (calls useEditor)
  │     └── PropertiesPanel (calls useEditor)
```

Every component is 0-1 levels deep from EditorProvider. No prop chains.

---

## Tool State Machine (Before → After)

### Before (if/else in Canvas.tsx)
```tsx
// Canvas.tsx — 40 lines of nested conditionals
const handlePointerDown = (event) => {
  if (activeTool === "text") {
    if (clickedNode) {
      onStartEditing(clickedNode);
    } else {
      onAddText(point);
    }
  } else if (activeTool === "pointer") {
    if (clickedNode) {
      onSelectNode(clickedNode.id);
    } else {
      onClearSelection();
    }
  }
};
```

### After (tool handles its own events)
```tsx
// tools/text-tool.ts
class TextTool extends Tool {
  onPointerDown(info) {
    if (info.target?.type === 'node') {
      this.editor.startEditing(info.target.node);
    } else {
      this.editor.addTextNode(info.point);
    }
  }
}

// tools/pointer-tool.ts
class PointerTool extends Tool {
  onPointerDown(info) {
    if (info.target?.type === 'node') {
      this.editor.selectNode(info.target.nodeId);
    } else {
      this.editor.clearSelection();
    }
  }
}

// Canvas just dispatches to the active tool
const handlePointerDown = (event) => {
  editor.currentTool.onPointerDown(getEventInfo(event));
};
```

Adding a new tool = adding a new file. No touching Canvas.

---

## Editor Class Shape

```ts
class Editor {
  // State (Zustand store under the hood)
  readonly store: EditorStore;

  // Managers
  readonly fonts: FontManager;
  readonly geometry: GeometryManager;

  // Tool state machine
  readonly tools: Map<string, Tool>;
  currentTool: Tool;

  // Convenience accessors (derived from store)
  get nodes(): Node[] { return this.store.getState().nodes; }
  get selectedNodeId(): string | null { return this.store.getState().selectedNodeId; }
  get selectedNode(): Node | null { ... }
  get editingNodeId(): string | null { ... }

  // Actions
  selectNode(nodeId: string): void;
  clearSelection(): void;
  startEditing(node: Node): void;
  commitEditing(): void;
  cancelEditing(): void;
  addTextNode(point?: Point): void;
  updateNode(nodeId: string, updater): void;
  deleteSelected(): void;
  setActiveTool(toolId: string): void;

  // Event dispatch
  dispatch(event: EditorEvent): void;
}
```

The Editor class is the API surface. Components call `editor.selectNode(id)` — not `onSelectNode` callback props.

---

## Migration Path

This is not a rewrite. It's a series of focused refactors, each leaving the app working.

### Phase 1: Editor class + useEditor hook
1. Create `Editor` class that wraps the existing Zustand store
2. Create `EditorProvider` + `useEditor()` hook
3. Swap `EditorSessionProvider` → `EditorProvider`
4. Components still use props for now, but the Editor exists

### Phase 2: Components access editor directly
1. Start with leaf components: `CanvasNode`, `CanvasTextEditor`, `LayersPanel`, `PropertiesPanel`
2. Each component replaces prop access with `useEditor()` calls
3. Remove props from parent as each child becomes self-sufficient
4. Delete `CanvasStage` once Canvas no longer needs the intermediary
5. Delete `useEditorSession` once no component depends on it

### Phase 3: Tool state machine
1. Create base `Tool` class with event handler interface
2. Extract `PointerTool`, `HandTool`, `TextTool` from Canvas.tsx if/else logic
3. Move keyboard shortcuts into tools (each tool registers its own shortcuts)
4. Canvas dispatches raw events → editor routes to active tool

### Phase 4: Managers
1. Extract `FontManager` from `font-cache.js` + `use-font-preload.js`
2. Extract `GeometryManager` from `use-node-geometries.js`
3. Both live on the Editor instance, not as React hooks
4. React hooks become thin subscriptions: `useEditorValue(() => editor.geometry.getById(nodeId))`

---

## Rules for New Code

1. **No new props for editor state.** If a component needs editor data, it calls `useEditor()`.
2. **No new tool logic in Canvas.** Tool behavior goes in a Tool class.
3. **No new derived state in React hooks.** Derived state is a getter on Editor or a manager.
4. **Components are flat.** Max 1 level of meaningful nesting inside `canvas/` or `panels/`.
5. **Pure logic has no React imports.** Geometry, math, warping, font parsing — none of these need React.
6. **One file, one concern.** If a component handles both rendering and interaction, split it.
