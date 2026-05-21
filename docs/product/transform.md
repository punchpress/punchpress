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
- Selection frames stay aligned with visible artwork.
- Corner handles resize.
- Rotation starts from the corner perimeter.
- Rotated resize anchors to the opposite corner.
- Multi-selection and group transforms follow the same model as single objects.
- Artboards can resize but do not rotate.

## Feedback

- Live transform chrome remains visible during active gestures.
- Handles stay screen-sized.
- Active transform cursors take precedence only over transform-specific
  affordances.
- Path-edit or shape-edit modes may replace normal transform chrome with editing
  affordances.
