# Cursors

Cursors communicate the user's current canvas intent. They should make tool
mode, selection target, and edit action predictable without becoming the only
signal for what will happen.

## Product Expectations

- Cursor behavior should follow familiar vector-editor conventions unless PunchPress intentionally diverges for a clear product reason.
- Cursor feedback should match the action a click or drag will perform at that moment.
- Cursor feedback should stay consistent with hover chrome, selection chrome, path previews, and action labels.
- Cursor visuals should not be the only indication of intent; visible canvas chrome should also show what is selectable, editable, or draggable.
- Cursor behavior should remain stable while zooming, panning, dragging, editing paths, and moving across grouped or imported artwork.

## Tool Cursors

- The Pointer tool is the default object-selection cursor.
- The Pointer tool should use the primary pointer icon treatment in both the toolbar and the in-canvas cursor.
- With the Pointer tool, clicking visible grouped content selects the outer useful object by default.
- With the Pointer tool, double-clicking grouped content drills into the group when the group is selected.
- With the Pointer tool inside a drilled-in group, clicking visible descendant artwork should target the descendant layer under the pointer.
- The Node tool is the direct path-selection cursor.
- The Node tool should use a distinct secondary pointer icon treatment from the same cursor family as the Pointer tool in both the toolbar and the in-canvas cursor.
- With the Node tool, clicking visible path artwork should select that path and enter path editing even when the path is inside imported or nested groups.
- The Pen tool is the point-authoring cursor.
- With the Pen tool, cursor feedback should distinguish placing a new point, continuing an open path, closing a path, adding a point to a segment, and deleting or converting an existing point.
- The Hand tool is the canvas navigation cursor.
- Holding `Space` should temporarily use the hand-pan cursor and take precedence over editing and selection cursors until panning ends.

## Path Editing

- Path editing should use cursor feedback that distinguishes anchors, handles, editable path bodies, insertable segments, and external path targets.
- Hovering an anchor should communicate point selection or point dragging.
- Hovering a bezier handle should communicate handle dragging.
- Hovering a path body in the currently edited path should communicate body dragging when body dragging is available.
- Hovering an insertable segment should communicate add-point intent.
- Hovering another visible path while path editing should communicate that clicking will switch direct selection to that path.
- Clicking another visible path while path editing should switch to that path instead of treating the click as body interaction with the current path.
- When the current path overlaps another visible path, the visible topmost path under the pointer should be the click target.

## Selection Targeting

- Hit targeting should follow the visible artwork under the pointer, not merely the bounding box of a selected or overlapping layer.
- Imported SVG artwork should behave like ordinary grouped vector artwork for cursor and selection purposes.
- When multiple paths overlap, cursor feedback and selection should prefer the visible frontmost path under the pointer.
- When a path is hidden, clipped away, or otherwise not visibly targetable, it should not win ordinary canvas cursor targeting.
- When a hidden or subtracted path is already directly selected, separate selection chrome may show its editable geometry without changing normal hit-target priority.

## Cursor Precedence

- Active panning takes precedence over every other cursor state.
- Active drags take precedence over hover-only cursor states.
- Active point or handle editing takes precedence over path body and object selection states.
- Explicit Pen actions such as close, continue, add point, and delete point take precedence over generic body dragging.
- External visible path targets take precedence over current-path body dragging when path editing is active.
- Object transform cursors take precedence only when the pointer is on transform handles or transform-specific affordances.
- Hover-only object selection cursors should not override active edit-mode cursor states.

## Feedback

- Cursor changes should pair with hover previews, anchor highlights, handle highlights, path previews, or similar visible affordances.
- If a cursor state would be ambiguous, PunchPress should prefer clearer canvas feedback over adding a new cursor variant.
- Cursor feedback should not flicker when moving across dense imported vector artwork.
- Cursor names, iconography, and keyboard shortcuts should stay aligned across toolbars, menus, and specs.
