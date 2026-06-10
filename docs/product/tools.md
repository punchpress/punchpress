---
summary: Defines the shared PunchPress tool model, cursor expectations, direct-edit entry, raster tools, temporary hand mode, and tool-specific intent boundaries.
read_when:
  - changing active tool behavior, tool shortcuts, canvas cursors, or tool handoff between pointer, node, pen, text, shape, brush, eraser, and hand tools
  - deciding whether a new interaction belongs in a tool, selection behavior, or node direct-edit mode
  - debugging a cursor, hover preview, or click result that disagrees with the active tool
---

# Tools

Tools define the user's current canvas intent.

## Shared Rules

- Cursor feedback matches what a click or drag will do.
- Cursor feedback pairs with visible chrome; it is not the only signal.
- Active panning takes precedence over every other cursor state.
- Active drags take precedence over hover-only cursor states.
- Tool behavior follows familiar vector-editor conventions unless PunchPress
  intentionally diverges.

## Tools

- Pointer selects and transforms whole objects.
- Node directly edits eligible shapes, paths, and vectors.
- Pen authors and edits vector points.
- Text places and edits text.
- Shape creates polygon, ellipse, and star nodes.
- Brush paints raster pixels into image layers.
- Eraser removes raster pixels from image layers.
- Hand pans the canvas.

## Direct Editing

- Direct vector editing belongs to the Node tool.
- Leaving Node exits direct path or shape editing unless the next tool
  intentionally continues vector editing, such as Pen.
- `Esc` clears inner point selection before returning from Node to Pointer.
- Holding Space temporarily uses the hand-pan cursor and suppresses editing or
  selection cursors until panning ends.
