---
summary: Defines inline canvas text editing, caret behavior, edit commit/cancel semantics, new text placement, starter sizing, and editing-mode styling.
read_when:
  - changing text placement, inline editing, caret display, text commit, cancel, starter size, or editing preview behavior
  - debugging text edit mode that feels detached from the designed object
  - deciding whether editing mode may simplify rendering without changing text meaning
---

# Text Editing

Text editing happens directly on the canvas.

## Editing Mode

- Entering edit mode keeps the node visibly selected.
- Edit mode shows a caret and does not pre-highlight text by default.
- Opaque editing backgrounds appear only when the user is selecting text.
- The editing surface preserves material styling: fill, stroke, spacing, and
  centered stroke behavior.
- Editing may use a simplified straight preview for reliable caret and text
  selection behavior, as long as styling remains aligned with the designed text.

## Create Text

- Placing a text node immediately enters edit mode.
- After placement, canvas behavior returns to pointer behavior outside the
  active text field.
- Click-created text centers on the placement point.
- Font loading after placement must not change the intended center.
- New text starts at an ergonomic whole-number size and stroke width.
- New text starts with a balanced outline treatment and no warp.

## Commit And Cancel

- Commit updates the same text node.
- Cancel restores prior text content.
- Leaving edit mode without content changes is a no-op for history.
