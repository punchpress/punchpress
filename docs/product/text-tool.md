---
summary: Defines Text tool behavior for placing new text, entering edit mode, cursor intent, and returning to pointer behavior outside active text editing.
read_when:
  - changing Text tool placement, text cursor feedback, starter text defaults, or edit-mode entry
  - debugging new text that lands at the wrong size, center, or active tool state
---

# Text Tool

The Text tool places live text on the canvas.

- Empty canvas click places a new text node.
- The new text node enters edit mode immediately.
- Placement uses ergonomic starter size and default styling.
- Existing text under the cursor shows text-edit intent.
- Leaving the active text field returns canvas behavior to Pointer interaction.
