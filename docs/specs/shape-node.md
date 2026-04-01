# Shape Node

Shape nodes let users create and edit live geometric shapes that remain easy to manipulate without immediately becoming freeform paths.

## Product Expectations

- A shape node remains a first-class canvas object with stable identity, layer behavior, visibility, styling, and transform.
- A shape node should preserve its live shape behavior after save, load, copy, paste, duplicate, transform, and export workflows.
- A shape node should render as vector artwork and remain editable source content inside PunchPress.
- A shape node may expose anchors, handles, and other path-like editing affordances without ceasing to be a shape node.
- A shape node should keep its shape-specific controls, such as corner radius, for as long as those controls still have a clear meaning.
- A shape node should keep one stable live shape family while it remains a shape node.

## Live Shape Editing

- Live shape editing is a distinct secondary mode for shape nodes.
- Entering live shape editing should keep the node selected.
- While live shape editing is active, the normal object transform box should be replaced by shape-editing affordances.
- While live shape editing is active, canvas marquee selection should stay suppressed so shape manipulation does not surface unrelated selection UI.
- While live shape editing is active, users should still be able to move the shape object itself by dragging the shape body when they are not targeting an anchor or handle.
- Live shape affordances should feel aligned with vector path editing without forcing every shape edit to become freeform path editing immediately.
- When a live shape family exposes anchor editing, users should be able to multi-select those anchors through additive clicks and marquee selection.
- Dragging one selected live-shape anchor should move the full selected anchor set together while the result still remains valid for that live shape family.

## Constrained Vector Behavior

- Shape nodes should behave like constrained vectors rather than like bitmap-like primitives.
- The baseline live shape families should be polygon, ellipse, and star.
- The rectangle tool should create a polygon shape with a four-corner default layout rather than introducing a separate durable rectangle family.
- Moving existing shape anchors should preserve live shape behavior only when that interaction still fits the current live shape family.
- Adjusting existing shape handles should preserve live shape behavior only when that interaction still fits the current live shape family.
- Shape editing may distort a live shape significantly while still preserving shape-specific controls if those controls remain meaningful.
- A polygon shape should remain a shape node while corner-based edits still preserve meaningful polygon controls, even after it is no longer a perfect square or rectangle.
- A polygon shape should support adding or removing points while it still remains a live polygon rather than a freeform vector.
- A polygon shape should expose a live `Corner radius` control that rounds eligible polygon corners from the same underlying polygon anchors used for shape editing.
- A polygon shape should convert to a vector node when the user introduces bezier-style point semantics such as smoothing a corner or dragging a new direction handle.
- An ellipse should preserve ellipse behavior only while the edits still describe an ellipse-like shape with meaningful ellipse controls.
- Moving an ellipse anchor or bezier handle should convert the ellipse into a vector node rather than preserving it as a live ellipse.
- A star should remain a shape node when existing star anchors are repositioned, as long as the result still behaves like a corner-based live star.
- A star should convert to a vector node when the user adds or removes points or introduces bezier-style point semantics.
- A shape node should not switch from one live shape family into another; once an edit breaks the current live shape family, the node should convert to a vector node instead.

## Conversion To Vector

- A shape node should convert to a vector node when the user performs edits that break the shape's current live shape family rather than merely deforming it.
- Adding a new point to a shape should convert that shape into a vector node only when that edit falls outside the shape's current live shape family.
- Removing a point from a shape should convert that shape into a vector node when the remaining result no longer fits the shape's current live shape family.
- Pen-style topology edits on a shape should convert that shape into a vector node.
- Converting a shape to a vector should preserve the visible geometry and styling of the object.
- Once a shape has become a vector node, PunchPress should no longer show shape-specific controls that no longer have a clear meaning.
