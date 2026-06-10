---
summary: Explains engine tool classes for pointer, node, pen, text, shape, brush, eraser, and hand behavior, including hover state, preview state, sessions, and shortcut selection.
read_when:
  - changing tool classes, adding a tool, or moving behavior between tools and interaction actions
  - debugging hover or preview state that persists after tool changes, history changes, or path editing exits
---

# Tools

Tools are engine-owned state machines for canvas intent.

## Tool Classes

- `PointerTool`
- `NodeTool`
- `PenTool`
- `TextTool`
- `ShapeTool`
- `BrushTool`
- `HandTool`

Tools own hover state, preview state, active sessions, activation cleanup, and
tool-specific key behavior. Shared behavior should move into editor commands or
interaction modules when more than one tool needs it.
