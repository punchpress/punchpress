---
summary: Defines point, handle, contour, topology, and Pen workflows for PunchPress path editing.
read_when:
  - changing anchor selection, handle editing, point conversion, point insertion, deletion, split, join, close, or Pen authoring
  - debugging path editing that confuses object transforms with point-level edits
  - deciding whether a gesture should edit the focused path, a child path, or the whole vector object
---

# Path Editing

Path editing manipulates editable curve geometry while preserving node identity.

## Anchors And Handles

- Anchor editing follows familiar Illustrator conventions by default.
- Primary anchor types are `corner` and `smooth`.
- A corner may have zero, one, or two independently edited handles.
- A smooth point preserves tangent continuity.
- Straight and one-sided curve points are valid states, not separate primary
  modes.
- Users can select one or multiple anchors by click, additive click, or marquee.
- Dragging one selected anchor moves the full selected set.

## Point Controls

- `Corner` collapses handles and produces a sharp point.
- `Smooth` preserves continuous curvature.
- `Delete point` removes selected anchors while preserving the remaining path
  when possible.
- Inner point selection has a deselect affordance without forcing exit from path
  edit mode.
- `Esc` clears inner point or corner selection before exiting path editing.

## Topology

- Users can add points on existing segments.
- Users can delete selected points.
- Users can split a path at a selected point.
- Users can join compatible open endpoints.
- Users can close eligible open contours.
- Users can merge compatible curves into a multi-contour path and separate
  multi-contour paths back into separate path nodes.
- Drawing disconnected paths creates separate path nodes by default unless the
  user is editing a vector container.

## Named Commands

| Command | Product meaning |
| --- | --- |
| `Merge Curves` | Combine compatible selected curves into one multi-contour path or vector-owned path set without baking unrelated styling. |
| `Separate Curves` | Split a multi-contour path into separate editable path nodes or child paths while preserving visual order. |
| `Join Curves` | Connect eligible open endpoints into one continuous contour. |
| `Close Curve` | Close an eligible open contour by connecting its endpoints. |

Commands act on the focused path-editing scope when one exists; otherwise they
act on the selected path or vector-capable objects.

## Pen Workflow

- Click places straight points.
- Click-drag places a point and authors handles.
- Holding Space while authoring repositions the pending anchor without
  discarding handles.
- Small unintended screen-space jitter still places a straight point until
  handle length is meaningful.
- Pen hover feedback is action-specific: close path, continue path, add point,
  or delete point.
- Closing a contour keeps the vector in path edit mode with the closing anchor
  selected.
- `Esc` ends the current drawing gesture without unexpectedly leaving broader
  vector editing.

## Modifiers

- While Pen is active, `Cmd` temporarily hands interaction to direct point
  editing without switching active tools.
- `Alt/Option` clicking an anchor toggles corner and smooth.
- `Alt/Option` dragging a handle adjusts only that handle side.
- `Shift` constrains handle angle when precise alignment is intended.
