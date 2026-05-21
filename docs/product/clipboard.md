---
summary: Defines copy and paste behavior for PunchPress-owned nodes, external payload interpretation, placement offsets, identity creation, and editing focus.
read_when:
  - changing copy, paste, duplicate, clipboard payload parsing, paste placement, or text-field copy behavior
  - adding support for a new external clipboard type
  - debugging pasted content that loses editability, lands offscreen, or reuses old node ids
---

# Clipboard

Copy and paste duplicate or insert content without leaving the canvas.

## Copy

- Copy acts on canvas selection when the canvas owns interaction.
- Any selectable node can be copied.
- Multi-selection copies as one payload.
- Groups copy with descendants.
- Copied content preserves editable source data, styling, relative layout, layer
  order, and parent-child relationships.
- PunchPress-owned content is pasteable into the same document or another
  PunchPress document.

## Paste

- Pasting PunchPress content creates new node identities every time.
- The pasted result becomes selected.
- Repeated paste from the same payload creates additional copies.
- Same-document paste offsets from the source so the copy is visible.
- Repeated paste steps predictably rather than stacking perfectly.
- If source position is unavailable or offscreen, paste lands in a visible
  canvas region.

## Payload Interpretation

- PunchPress chooses the highest-fidelity supported payload.
- PunchPress-owned payloads beat generic representations of the same content.
- Plain text from outside PunchPress becomes a new text node.
- Supported external images should become image nodes when image nodes exist.
- Unsupported payloads are no-ops.

## Focus

- Text inputs and active editing fields keep normal text copy and paste.
- Ambiguous edit modes must resolve predictably rather than mixing node-level and
  text-field side effects.
