---
summary: Explains the React bridge that creates configured editors, provides editor context, subscribes to editor state, and connects clipboard events.
read_when:
  - changing `apps/web/src/editor-react` hooks, provider behavior, or editor subscription patterns
  - wiring a React component to editor state without prop drilling
  - debugging stale React renders after editor state changes
---

# React Bindings

React is a client of the editor.

## Owners

- `create-configured-editor.ts` creates app-configured editor instances.
- `EditorContext` and `EditorProvider` expose the active editor.
- `useEditor()` reads the current editor object.
- `useEditorValue()` subscribes to selected editor state.
- `useEditorViewportValue()` subscribes to the live camera.
- `useEditorClipboardEvents()` connects browser clipboard events to editor
  clipboard commands.

## Rules

- Components call `useEditor()` or `useEditorValue()` directly.
- Do not prop drill editor state through panel or canvas trees.
- Put durable behavior in engine methods, not React hooks.
- Use React bindings to render and dispatch, not to invent editor policy.

## Update Cost

Every store update runs every mounted selector, and `useEditorValue` compares
results with one-level `shallow` equality. A selector that returns fresh nested
objects or arrays re-renders its component on every edit anywhere in the
document.

- Return primitives, store references, or engine-cached values from selectors.
- An inline selector re-runs on every render. A component that re-renders on
  every preview frame passes a module-level or memoized selector when the
  selector walks many nodes; `useEditorValue` then runs it once per store
  state.
- Per-node canvas art keys on `editor.getNodeArtRevision(nodeId)`, which changes
  only when that node, its subtree, or an ancestor changes. Never key node art
  on `state.nodes`.
- `useEditorSurfaceValue` re-renders on every interaction preview; components
  that read live previews in their render body rely on that. Per-node art uses
  `useEditorSurfaceSelection`, which re-renders only when its selected preview
  value changes, so a drag re-renders only the moved nodes. Each mounted node
  shell subscribes only to values it renders; handlers read tool state when
  they run.
- Render layers memoize on the engine's layer object. The engine keeps an
  unchanged layer (and the placed-id array) across rebuilds, so a structural
  edit re-renders only the layers it changed.
- Tree queries such as `getSelectionTargetNodeId` use the cached node-tree
  index; selectors must not rebuild node maps.
- Menu content subscribes inside its popup so closed menus do no work.
- The properties panel root subscribes to its layout only (inspected node,
  section availability, path-editing mode, raster tool). Each section, row,
  and value control subscribes to its own primitives, so a scrub re-renders
  only the scrubbed control. Lists subscribe to ordered id arrays returned
  directly from the selector. Controls hold layer or effect ids and resolve
  the slot when they dispatch; lists remount when the selection changes,
  because different nodes can reuse the same ids. The
  `node-property-edit-render-path` performance spec gates these counts.
- Camera reads use `useEditorViewportValue(selector)`, which follows the live
  camera through the viewport presentation channel, including mid-gesture
  changes the store only receives when the gesture settles. Its selector
  returns a primitive, so a component re-renders only when that value
  changes (a threshold crossing, a new zoom). Never read `state.viewport` for
  presentation.
- Providers above the editor shell must not re-render on every store update;
  subscribe to the narrow signal they need, such as `subscribeDirtyState`.
