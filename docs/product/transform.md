---
summary: Defines product behavior for moving, resizing, rotating, drag previews, selection frames, group transforms, and active transform feedback.
read_when:
  - changing move, resize, rotate, drag preview, transform handles, selection frames, or group/multi-selection transforms
  - debugging transform boxes that jump, resize from the wrong anchor, or diverge from visible artwork
---

# Transform

Transforms move, resize, and rotate selected objects.

## Contract

- Pointer-driven transforms preview during the gesture and commit once.
- Geometry transforms preserve document hierarchy. Moving a node into, within,
  or beyond a Frame changes only its geometry; Frame membership and clipping
  remain stable through preview, commit, Undo, and Redo.
- Frame clipping follows transient geometry during the held gesture: pixels are
  hidden or revealed immediately as they cross the Frame boundary.
- Selection frames stay aligned with visible artwork.
- Corner handles resize.
- Rotation starts from the corner perimeter.
- Rotated resize anchors to the opposite corner.
- Multi-selection and group transforms follow the same model as single objects.
- Resizing a selected group, imported SVG, or other container treats the
  selected container as the interactive object. Nested descendants stay
  editable, but they are not individually transformed on every pointer tick.
- Rotating a selected group, imported SVG, or other container follows the same
  preview-and-commit contract as resize. The selected root rotates as one live
  object during the gesture; nested descendants receive durable transform
  updates only when the gesture commits.
- Artboards can resize but do not rotate.
- Raster resize keeps its transformed preview after input ends until one
  asynchronous backing-plane resample publishes at integer dimensions.
- Holding Shift while dragging a Raster resize handle preserves its aspect
  ratio for that gesture, including when the Image dimensions lock is off.

## Feedback

- Live transform chrome remains visible during active gestures.
- Handles stay screen-sized.
- Active transform cursors take precedence only over transform-specific
  affordances.
- Path-edit or shape-edit modes may replace normal transform chrome with editing
  affordances.

## Performance

Active transforms use a preview surface first and update durable document nodes
at the gesture boundary. Complex selections and deeply nested groups must not
fan out through every descendant during pointer movement.
