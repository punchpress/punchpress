---
summary: Defines PunchPress selection behavior for click targeting, hover previews, marquee selection, focused groups, direct-edit scopes, and visibility.
read_when:
  - changing canvas hit testing, hover previews, marquee selection, selection sync, focused groups, or direct-edit targeting
  - debugging clicks that choose the wrong node, path, group, or hidden geometry
---

# Selection

Selection identifies the current canvas target for editing.

## Targeting

- Selection follows visible artwork under the pointer, not stale bounds.
- Hit testing respects transforms, visibility, layer order, focused groups, and
  active tool scope.
- When visible objects overlap, the topmost eligible object wins.
- Hover previews describe what a click would select or edit.
- Hidden or clipped-away content does not win ordinary canvas targeting.
- Already-selected hidden vector child geometry may show edit chrome without
  changing normal hit priority.
- PunchPress does not expose Auto-select modes or select-under cycling.

## Marquee

- Marquee selection selects fully enclosed canvas nodes in normal object mode.
- Partially intersected objects are not selected by default.
- During path or shape direct editing, marquee targets the editing domain, such
  as points, not unrelated canvas nodes.
- While path editing is active, object-level marquee selection stays suppressed.

## Groups

- Normal clicks select the useful outer group object.
- Drilled-in groups allow direct descendant targeting.
