# Text Node

Text nodes let users place and edit stylized text directly on the canvas.

## Product Expectations

- A text node stores editable text, not baked outlines.
- A text node preserves its visual styling as part of the design, including font, size, fill, stroke, and spacing controls.
- The default text stroke behavior is centered on the text shape.
- A text node can be transformed like any other node while remaining editable.

## Editing

- Plain text editing happens directly on the canvas.
- Entering text edit mode keeps the node visibly selected.
- Text edit mode should present a caret, not make the text appear pre-highlighted by default.
- Text edit mode should not introduce an opaque editing background unless the user is actually selecting text.
- While editing, the text should retain the styling that materially affects design decisions, including fill color, stroke, and spacing.
- Edit mode should respect the same default centered stroke model as the committed node render.
- Editing should feel connected to the designed object even when PunchPress uses a simplified editing surface for readability.
- Edit mode may use a simplified straight preview when that provides more reliable caret and text-selection behavior, as long as the styling stays aligned with the designed text.
- Edit mode should keep a visible caret so text entry still feels precise and direct.
- Placing a new text node should enter text edit mode immediately and return the canvas to pointer behavior outside the active text field.
- Placing a new text node from the canvas should center the text on the placement click and start at the default starter size.
- A newly placed text node should start with a balanced default outline treatment that remains readable at 100% canvas zoom, rather than a heavy poster-style stroke.
- A newly placed text node should start with no warp applied until the user explicitly chooses one.

## Behavior

- Committing an edit updates the same text node.
- Cancelling an edit restores the prior text content.
- Text remains text throughout editing, transformation, save/load, and normal document workflows.
- Bounded text style controls such as font size, tracking, stroke width, and circle path settings should support drag scrubbing with direct numeric entry as a fallback.
- Future typography controls, including finer spacing controls, should carry through to editing mode once they are supported in the product.

## Path-Guided Text

- A warped text node remains a text node with normal node selection behavior unless the user explicitly enters path editing.
- In the default selected state, a path-guided text node should still use the text node's normal selection and transform behavior.
- A selected path-guided text node may show a subtle preview of its underlying path so the relationship between the text and the path stays legible.
- That path preview should stay visually aligned with the text while the node is rotated or otherwise transformed.
- That path preview may be temporarily hidden during an active transform such as rotation when keeping it visible makes the interaction read less clearly.
- Path editing is a distinct mode from text editing.
- Path editing should expose path-specific controls without replacing the normal text-editing model.
- Entering path editing should clear normal hover-only canvas previews that no longer match the path-editing state.
- When circle warp is first applied to a selected text node, PunchPress should enter path edit mode automatically.
- A selected path-guided text node should offer a clear `Edit path` affordance and keyboard shortcut to enter or leave path edit mode.
- While path editing, dragging the text should still move the node on the canvas.
- While path editing, a dedicated path-position handle should move the text along the path without moving the node itself.
- Moving text along a path should not make the underlying path itself appear to drift or jitter.
- Circle warp panel scrub controls should stay within their defined UI ranges while dragging, even if the underlying path values were pushed beyond those ranges by another interaction.
- When a circle warp value starts outside a scrub control's range, dragging back toward the valid range should recover to the nearest bound quickly before continuing with normal linear scrubbing.
- While path editing, the visible transform/selection box should match the path-editing surface rather than a larger enclosing text bounds box.
- While path editing, that transform/selection box should stay aligned with the path-editing surface during rotate, move, and resize interactions.
- While the user is actively dragging a path-position handle, PunchPress may temporarily hide normal selection bounds if those bounds would otherwise jitter distractingly as the text reflows.
- Simpler direct-manipulation warps, such as arch bend, wave-style flag adjustments, and slant, may stay inline on selection instead of requiring a separate path-edit mode.
- Inline arch, wave, and slant warp guides should be centered through the text rather than anchored to the text's top edge.
- Applying wave warp from the default preset should start from a restrained amplitude that preserves legibility and keeps the inline handles in a sensible place before any manual adjustment.
- Inline warp adjustment controls should still support the full intended expressive range of that warp in both directions.
- Wave warp cycle adjustments should clamp to a maximum of three cycles.
- Inline warp handle icons should inherit node rotation so they stay aligned in node space; the circle path position handle remains a special case that also follows the path tangent.
- Warp handle icons should show a subtle physical spring effect (slight movement in the drag direction) to reinforce that they are being interacted with.
- The spring effect should only be enabled on handles whose screen position remains static during the adjustment. Handles that move with the node as it changes (e.g., circle path position, wave amplitude, arch bend) should not use the spring effect because the node's own movement already provides sufficient interaction feedback.
