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

## Behavior

- Committing an edit updates the same text node.
- Cancelling an edit restores the prior text content.
- Text remains text throughout editing, transformation, save/load, and normal document workflows.
- Future typography controls, including finer spacing controls, should carry through to editing mode once they are supported in the product.
