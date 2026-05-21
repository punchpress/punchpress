---
summary: Defines Pen tool product behavior for placing points, authoring handles, continuing paths, closing contours, inserting points, deleting points, and modifier handoff.
read_when:
  - changing Pen hover actions, point placement, handle authoring, close/continue path behavior, segment insertion, or modifier gestures
  - debugging Pen feedback that is ambiguous between add, delete, close, continue, or convert actions
---

# Pen Tool

The Pen tool authors vector paths.

- Click places a straight point.
- Click-drag places a point and authors handles.
- Hover feedback distinguishes add point, delete point, continue path, and close
  path.
- Inserting on a segment previews the exact insertion point before click.
- Press-dragging from a segment inserts a point and authors handles in one
  gesture.
- Closing a contour keeps vector editing active.
- `Cmd` temporarily hands interaction to direct point editing while Pen remains
  active.
- `Alt/Option` toggles or breaks point smoothness depending on click or drag
  context.
- Space repositions a pending point while authoring handles.
