---
summary: Defines live shape and vector corner-radius controls, selected logical corners, clamping, warning states, and conversion-safe rounding behavior.
read_when:
  - changing polygon corner radius, star corner radius, vector corner handles, logical corner selection, or rounding limits
  - debugging radius drags that convert shapes too early, jump values, or show stale trim-point chrome
  - deciding whether a corner action edits live shape data or freeform vector geometry
---

# Corner Controls

Corner controls let users round eligible shape and vector corners without losing
editability.

## Shape Corners

- Polygon and star shapes expose live corner radius while the shape family
  remains meaningful.
- With no selected corners, bulk radius edits apply to all eligible corners.
- With selected corners, edits apply only to selected logical corners.
- Shape corner edits that remain representable do not convert the shape to path
  artwork.
- Shared radius values clamp to the stable shared maximum.

## Vector Corners

- Vector corner rounding is a vector feature, not a shape-wide live control.
- Eligible closed contour corners show on-canvas radius handles.
- Open-path endpoints are ineligible until the contour is closed.
- A sharp vector corner rounds by materializing the canonical rounded-corner
  trim-point pattern.
- Rounded trim points remain editable vector geometry.
- Selecting a logical rounded corner suppresses ordinary anchor actions that
  would not apply to radius editing.

## Dragging And Limits

- Dragging a corner handle with no anchor selection adjusts all eligible live
  corners.
- Dragging with selected corners adjusts only selected logical corners.
- During active drag, only the dragged handle may remain visible.
- Applied rounding tracks pointer direction monotonically instead of rebasing
  against already-mutated geometry.
- Radius edits clamp to the largest stable editable radius.
- Corners that reach limits may show subdued warning treatment on the segment
  and handle.
