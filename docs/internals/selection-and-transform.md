---
summary: Explains selection state, focused groups, selection bounds, drag sessions, move/resize/rotate operations, and preview-vs-commit boundaries.
read_when:
  - changing selection actions, focused group behavior, selection bounds, drag preview, move, resize, or rotate sessions
  - debugging undo boundaries or visual movement during active transforms
---

# Selection And Transform

Selection and transform behavior lives in engine modules and is rendered by
React overlays.

## Selection

- Selection state stores selected node ids and focused group id.
- Effective selection may differ from raw selection for container behavior.
- Selection bounds are derived from node capability frames.

## Transform

- Move, resize, rotate, and selection drag use session objects.
- Active gestures preview without rewriting the document on every tick.
- Commit applies one document change at the gesture boundary.
- React supplies pointer input and renders preview surfaces.
