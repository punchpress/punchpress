---
summary: Defines PunchPress undo and redo semantics for logical editor changes, committed gestures, no-op edits, and canceled interactions.
read_when:
  - changing history grouping, undo, redo, dirty state, gesture commits, or no-op detection
  - deciding whether an interaction should create a history entry
  - debugging undo steps that feel too granular, too broad, or include canceled work
---

# History

History tracks logical document edits, not raw pointer events.

## Logical Steps

- One user action creates one undoable step.
- Pointer-driven gestures commit at the end of the gesture.
- Intermediate drag, resize, rotate, point, or handle motion is preview state
  until commit.
- Programmatic editor actions should create history steps at the same semantic
  boundary a user action would.
- A first Brush Stroke includes Raster creation or empty-layer materialization
  and committed pixels in one logical step.
- A changed Crop commit is one logical step; Crop preview and cancellation are
  not history.

## Undo And Redo

- Undo restores the previous document state and relevant editor mode state.
- Redo reapplies the undone document change.
- New document edits after undo clear the redo stack.

## Tracked State

History tracks durable document changes: nodes, transforms, visibility,
ordering, text, styling, vector geometry, artboards, and grouping.

History does not track hover, viewport pan, viewport zoom, transient drag
previews, open dialogs, or cursor state.

## No-Ops

- Canceled interactions do not create history entries.
- Edits that leave the document unchanged do not create history entries.
- Entering and leaving an edit mode without changing durable content is a no-op.
