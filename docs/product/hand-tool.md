---
summary: Defines explicit and temporary Hand tool behavior for canvas panning, cursor precedence, and non-document viewport movement.
read_when:
  - changing hand mode, spacebar panning, panning cursor state, or viewport pan history behavior
  - debugging panning that interferes with active editing, selection, or tool cursors
---

# Hand Tool

The Hand tool pans the viewport.

- Panning changes viewport position, not document content.
- Panning does not create history steps.
- Holding Space temporarily enters hand-pan behavior from other tools.
- Active panning takes precedence over editing, selection, hover, and transform
  cursors.
