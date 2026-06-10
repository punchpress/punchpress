---
summary: Lists PunchPress tool, shape, document, history, edit-mode, and performance keyboard shortcuts.
read_when:
  - changing keyboard shortcut handling in engine input, document commands, tools, text editing, or performance HUD code
  - checking whether a shortcut conflict should be resolved at the tool, document, or browser boundary
---

# Keyboard Shortcuts

## Tools

| Shortcut | Action |
| --- | --- |
| `v` | Pointer tool |
| `a` | Node tool |
| `p` | Pen tool |
| `t` | Text tool |
| `h` | Hand tool |
| `b` | Brush tool |
| `e` | Eraser tool |
| `r` | Shape tool, polygon |
| `o` | Shape tool, ellipse |
| `s` | Shape tool, star |
| Space | Temporary hand-pan while held |

Tool shortcuts do not fire with Meta, Ctrl, or Alt.

## Document

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+N` | New |
| `Cmd/Ctrl+O` | Open |
| `Cmd/Ctrl+S` | Save |
| `Cmd/Ctrl+Shift+S` | Save As |
| `Cmd/Ctrl+E` | Export |

## Editing

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Y` or `Cmd/Ctrl+Shift+Z` | Redo |
| `Cmd/Ctrl+Shift+N` | New layer |
| `Cmd/Ctrl+G` | Group |
| `Cmd/Ctrl+Shift+G` | Ungroup |
| `Delete` / `Backspace` | Delete selection or selected path points, depending on active mode |
| `Esc` | Clear inner edit selection, exit tool/session, or return to Pointer depending on context |
| `Enter` | Commit supported editing sessions |

Performance HUD shortcuts live with the performance provider and should avoid
conflicting with editor text input.

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+Shift+P` | Toggle Performance HUD |
