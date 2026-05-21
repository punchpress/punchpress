---
summary: Defines Pointer tool behavior for object selection, grouped-content targeting, double-click edit entry, and drilled-in group selection.
read_when:
  - changing default object selection, pointer hover, double-click edit entry, or grouped-content targeting
  - debugging clicks that select a child instead of an outer object, or fail to enter direct editing
---

# Pointer Tool

The Pointer tool is the default whole-object selection tool.

- Clicking visible artwork selects the useful outer object by default.
- Clicking inside a drilled-in group may target visible descendants.
- Double-clicking editable vector or shape artwork switches to the Node tool and
  focuses the clicked editable target.
- Double-clicking grouped content drills into a selected group when there is no
  more specific editable target.
- Pointer hover previews should describe the object a click would select.
