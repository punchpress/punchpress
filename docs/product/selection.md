---
summary: Defines PunchPress selection behavior for click targeting, hover previews, marquee selection, focused groups, direct-edit scopes, and visibility.
read_when:
  - changing canvas hit testing, hover previews, marquee selection, selection sync, focused groups, or direct-edit targeting
  - debugging clicks that choose the wrong node, path, group, or hidden geometry
---

# Selection

Selection identifies the current canvas target for transform chrome and direct
editing. It is separate from the persistent active layer used by layer-targeted
tools.

## Active Layer

- Every non-empty document keeps one active layer.
- Clearing canvas selection removes transform handles while the active layer
  remains highlighted in Layers.
- Selecting a canvas object or layer row also makes that node active.
- Hidden or locked nodes may remain active, but incompatible tools stay
  disabled instead of retargeting.
- Deleting the active layer chooses the nearest surviving sibling, then its
  parent Frame.

## Targeting

- Selection follows visible artwork under the pointer, not stale bounds,
  except inside an existing selection (see below).
- Hit testing respects transforms, visibility, layer order, focused groups, and
  active tool scope.
- When visible objects overlap, the topmost eligible object wins.
- Hover previews describe what a click would select or edit.
- Hidden or clipped-away content does not win ordinary canvas targeting.
- Already-selected hidden vector child geometry may show edit chrome without
  changing normal hit priority.
- PunchPress does not expose Auto-select modes or select-under cycling.

## Pressing Inside a Selection

Already-selected objects use their selection bounds as a hit area, as in
Figma. Unselected objects keep visible-artwork hit testing.

- Pressing anywhere inside the selection bounds and dragging moves the whole
  selection, even from empty space (such as the middle of circle text) or from a
  smaller unselected object drawn on top.
- A press released without moving acts as a click on the visible artwork under
  the pointer: an unselected object on top becomes the selection, a member of a
  multi-selection becomes the only selection, and empty space keeps the current
  selection.
- Shift-click inside the bounds toggles the clicked object; Shift-click on empty
  space keeps the selection. Shift-drag still moves the selection.
- A selected group drags from anywhere inside its bounds; clicking a child keeps
  the group selected until the group is drilled into.
- Path editing stays a direct-edit mode: only the edited artwork drags, and a
  press on empty space leaves path editing.

## Marquee

- Marquee selection selects fully enclosed canvas nodes in normal object mode.
- Partially intersected objects are not selected by default.
- During path or shape direct editing, marquee targets the editing domain, such
  as points, not unrelated canvas nodes.
- While path editing is active, object-level marquee selection stays suppressed.

## Groups

- Normal clicks select the useful outer group object.
- Drilled-in groups allow direct descendant targeting.
