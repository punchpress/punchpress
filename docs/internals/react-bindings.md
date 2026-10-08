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
- Per-node canvas art keys on `editor.getNodeArtRevision(nodeId)`, which changes
  only when that node, its subtree, or an ancestor changes. Never key node art
  on `state.nodes`.
- Tree queries such as `getSelectionTargetNodeId` use the cached node-tree
  index; selectors must not rebuild node maps.
- Menu content subscribes inside its popup so closed menus do no work.
- Providers above the editor shell must not re-render on every store update;
  subscribe to the narrow signal they need, such as `subscribeDirtyState`.
