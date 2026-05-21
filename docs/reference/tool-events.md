---
summary: Defines the Tool lifecycle hooks, pointer entry points, hover and preview state, shortcut selection, and active-session expectations.
read_when:
  - changing a tool class, adding a tool, or modifying canvas pointer dispatch
  - debugging hover state, placement preview, active sessions, or tool deactivation behavior
  - deciding whether a key or pointer event belongs in tool code or shared editor input code
---

# Tool Events

Tools receive normalized editor inputs and express tool intent.

## Tool Hooks

| Hook | Purpose |
| --- | --- |
| `getPreviewState()` | Transient placement or authoring preview. |
| `getHoverState()` | Tool-specific hover result. |
| `hasActiveSession()` | Whether the tool owns an in-progress gesture. |
| `onCanvasPointerDown()` | Canvas press entry. |
| `onNodePointerDown()` | Node press entry, normalized into canvas target data. |
| `onCanvasPointerMove()` | Hover or active gesture movement. |
| `onCanvasPointerLeave()` | Clear hover or temporary state. |
| `onActivate()` / `onDeactivate()` | Tool lifecycle. |
| `onPathEditingStopped()` | Cleanup when path editing exits. |
| `onHistoryChanged()` | Reconcile sessions after undo/redo. |
| `onKeyDown()` | Tool-specific keys. |

## Tool Shortcuts

| Key | Tool |
| --- | --- |
| `v` | Pointer |
| `a` | Node |
| `p` | Pen |
| `t` | Text |
| `h` | Hand |
| `r` | Shape, polygon |
| `o` | Shape, ellipse |
| `s` | Shape, star |

Tool shortcuts are ignored when Meta, Ctrl, or Alt is held.
