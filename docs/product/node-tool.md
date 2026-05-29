---
summary: Defines Node tool behavior for direct shape, path, and vector selection, path-edit chrome, child path targeting, and escape semantics.
read_when:
  - changing direct selection, path edit entry, shape edit entry, child path focus, or Node-tool cursor behavior
  - debugging Node tool clicks that target the wrong visible path, group descendant, or current path body
---

# Node Tool

The Node tool directly edits eligible shapes, paths, and vectors.

- Selecting Node with one eligible node selected immediately shows editing
  chrome.
- Clicking visible path artwork selects that path and enters path editing, even
  inside imported or nested groups.
- Dragging a marquee with no active path-edit session previews intersecting
  editable curve candidates, then selects them on release. This includes curves
  nested inside groups and vectors. Selected curves enter Node edit chrome with
  editable anchors visible on canvas.
- In path editing, another visible topmost path under the pointer wins over body
  interaction with the current path.
- Hidden, clipped, or invisible paths do not win ordinary cursor targeting.
- `Esc` clears inner point selection before exiting direct editing.
