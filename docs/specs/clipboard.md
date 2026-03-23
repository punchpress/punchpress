# Clipboard

Copy and paste let people duplicate and insert content without leaving the
canvas.

## Product Expectations

- Copy and paste are canvas-level editing actions.
- Copying selected canvas content makes it available for paste without changing
  the current document.
- Pasting creates new canvas content when PunchPress can interpret the current
  clipboard payload.
- PunchPress should interpret supported clipboard payloads into the appropriate
  node type instead of treating paste as a node-only feature.
- The clipboard model should support both PunchPress-owned content and
  supported external content such as images.
- Unsupported clipboard content should not change the document.

## Copy

- Any selectable node can be copied.
- Copying multiple selected nodes copies them as one payload.
- A copied payload preserves relative layout, layer order, and parent-child
  relationships.
- Copying a group copies the group and its descendants.
- Copied PunchPress content preserves editable source data and styling. Paste
  should not flatten it into export-only output.
- Copied PunchPress content should be pasteable into the same document or a
  different PunchPress document.

## Paste

- Pasting PunchPress content creates new node identities every time.
- The pasted result becomes the current selection.
- Pasting copied PunchPress nodes should feel like duplication, not import.
- Repeated paste from the same copied payload creates additional copies without
  requiring another copy action.
- Paste is a no-op when there is no supported clipboard payload.

## Clipboard Interpretation

- PunchPress should resolve clipboard content into the best supported canvas
  insertion for that payload.
- When multiple supported representations are available, PunchPress should use
  the highest-fidelity supported payload.
- Plain text from outside PunchPress should paste as a new text node.
- Supported external image payloads should paste as image nodes once image
  nodes exist in the product.
- If the clipboard payload type is not supported yet, paste is a no-op.
- When the clipboard contains both a PunchPress-owned payload and a generic
  representation of the same content, PunchPress should prefer the PunchPress
  payload so pasted content preserves full fidelity.
- Generic image or file payloads should win over plain text fallbacks when both
  are present for the same clipboard content.

## Placement

- Pasted content preserves the copied payload's internal geometry and relative
  arrangement.
- When pasted into the same document, the result should appear offset from the
  source so the new copy is immediately visible.
- Repeated paste of the same payload should continue stepping in a predictable
  direction instead of stacking perfectly on top of prior results.
- When the source position is unavailable or would land offscreen, pasted
  content should appear in a visible canvas region.

## Focus And Editing

- Copy and paste should act on the canvas selection when the canvas owns the
  interaction.
- PunchPress should not hijack normal text or form copy/paste behavior inside
  active text inputs or other editing fields.
- If a node-specific editing mode makes copy or paste ambiguous, PunchPress
  should resolve that ambiguity predictably rather than producing mixed editing
  and canvas side effects.
