# Vector Node

Vector nodes let users create and edit custom vector artwork directly on the canvas.

## Product Expectations

- A vector node stores editable vector source geometry, not only a flattened export artifact.
- A vector node remains a first-class canvas object with stable identity, layer behavior, visibility, styling, and transform.
- A vector node supports fill, stroke, stroke width, and fill-rule behavior as durable node properties.
- A vector node may contain one or more contours, including open paths, closed paths, and compound path-like structures.
- A vector node should stay editable after save, load, copy, paste, duplicate, transform, and export workflows.
- A vector node should be able to represent both freeform pen-drawn paths and primitive-based vector shapes.
- By default, vector object behavior should follow familiar Adobe Illustrator-style conventions unless PunchPress intentionally chooses to diverge for a clear product reason.

## Selection And Transform

- In the default selected state, a vector node should behave like any other node for move, resize, rotate, layer, and property workflows.
- The editable frame for a vector node should stay visually aligned with the node's visible footprint.
- Selection and transform handles should remain screen-sized and visually consistent even when the node's durable data represents resize through transform scale.
- A vector node should not require path-edit mode for normal object transforms.
- Resizing or rotating a vector node in the default selected state should preserve editability of the underlying vector source.

## Path Editing

- Path editing is a distinct secondary mode for vector nodes.
- Vector path editing should enter through explicit intent, such as double-clicking the node or using an `Edit path` affordance.
- Entering path editing should keep the node selected.
- While path editing is active, the normal object transform box should be replaced by path-editing affordances.
- While path editing is active, canvas marquee selection should stay suppressed so path manipulation does not surface unrelated selection UI.
- While path editing is active, users should still be able to move the vector object itself by dragging the vector body when they are not targeting an anchor or handle.
- While path editing is active, normal canvas navigation such as space-drag panning and trackpad scrolling should remain available.
- Path editing should expose anchors, bezier handles, and contour structure clearly enough that direct manipulation feels precise.
- Path-editing affordances should follow PunchPress's visual language rather than looking like a foreign embedded tool.
- Anchor and handle controls should remain visually stable and screen-sized while the user edits the path.
- Path edits should update the same vector node rather than creating a replacement node.

## Anchor Semantics

- Anchor editing should follow familiar Adobe Illustrator conventions by default.
- The primary anchor types should be `corner` and `smooth`.
- A `corner` anchor may have zero, one, or two direction handles, and each side may be edited independently.
- A `smooth` anchor should preserve tangent continuity across the point.
- A straight point is a point whose direction handles are both collapsed, not a separate anchor type.
- A one-sided curve point is a valid state, especially at open-path ends and partially converted corners, not a separate primary mode.
- Symmetric or mirrored handle behavior may exist as a convenience later, but it should not be required as a first-class baseline mode if PunchPress is following Illustrator conventions.

## Point Editing

- Users should be able to move existing anchor points directly on the canvas.
- Users should be able to adjust bezier handles directly on the canvas.
- Users should be able to select one or multiple anchor points within path edit mode.
- Users should be able to select anchor points by click, additive selection, and lasso-style point selection.
- Path-edit cursors should distinguish point selection/editing from whole-object dragging.
- Hovering or dragging a point should use point-edit cursor language such as `pointer`, not object-move cursors.
- Hovering an anchor or bezier handle should communicate point editing, not object movement.
- Dragging the vector body should continue to use object-drag cursor language such as `grab` and `grabbing`.
- Open and closed contours should both be editable through the same interaction model.
- Selecting a single anchor should expose point-specific actions without leaving path edit mode.
- Selecting multiple anchors should expose only actions that make sense for multi-point edits.

## Point Controls

- When one or more anchor points are selected, PunchPress should provide direct anchor conversion controls consistent with Illustrator-style editing.
- The baseline point controls should be `Corner` and `Smooth`.
- `Corner` should collapse the current point's handles immediately, producing a sharp corner that may later gain independent handles through direct manipulation.
- `Smooth` should preserve continuous curvature through the anchor.
- `Delete point` should remove the selected anchor while preserving the remaining path when possible.
- A convenience action to collapse both handles on the selected point may exist later, but one-sided or zero-handle states should primarily come from direct manipulation rather than dedicated mode buttons.

## Modifier Gestures

- `Alt/Option`-dragging a direction handle should adjust only that side of the point instead of preserving smooth coupling.
- Temporary modifier-based bezier editing should apply to handle drags without introducing separate anchor click or anchor drag gestures that conflict with standard node manipulation.
- `Shift` should constrain handle angle when precise alignment is intended, such as snapping to common editing angles.
- While the Pen tool exists, temporary modifier access to point editing should feel consistent with Illustrator-style pen workflows rather than forcing constant tool switching.

## Path Operations

- Path editing should support adding points on existing segments.
- Hovering an insertable segment should communicate point insertion distinctly from point dragging or whole-object dragging.
- Clicking an insertable segment should add a point at that location and select it immediately.
- Path editing should support deleting selected points without destroying the whole path.
- Path editing should support cutting or splitting a path at a selected point or segment.
- Path editing should support joining compatible open endpoints.
- Path editing should support closing an open path through explicit intent with clear feedback when the user is targeting the starting anchor.
- Path editing should support reopening or breaking a closed contour at a chosen point later.
- Joining endpoints should preserve the path as editable vector source geometry and should follow Illustrator-style expectations for corner joins by default.

## Pen Workflow

- Path editing should eventually support creating new paths with a pen-style workflow rather than only editing existing paths.
- Clicking should place straight points.
- Click-dragging should place a point and immediately author its direction handles.
- Continuing from a smooth point should preserve expected tangent behavior.
- Esc should end the current drawing gesture without exiting the broader vector editing mode unexpectedly.
- Enter or an equivalent explicit confirm gesture may finish the current path.
- The Pen workflow should support continuing an open path from either valid endpoint.
- The Pen workflow should support starting a new contour inside the same vector node when that is the active authoring intent.

## Complete Editor

- A complete point and bezier editor for PunchPress should include point selection, handle editing, point conversion, point insertion, point deletion, path splitting, path joining, and path closing.
- A complete editor should make it easy to distinguish object transforms from point-level path edits.
- A complete editor should support keyboard nudging of selected anchor points.
- A complete editor should support multi-point edits where the requested action has a clear shared meaning.
- A complete editor should preserve visual and behavioral consistency across direct selection, pen editing, and future text-on-path workflows.

## Primitives

- PunchPress should support primitive vector starters such as rectangle, ellipse, line, polygon, and star.
- Primitive vector starters should remain vector nodes rather than a separate long-term node family.
- A primitive should be editable as ordinary vector geometry once the user enters path-edit mode.
- PunchPress may preserve primitive-friendly creation defaults even after the node becomes freely editable vector geometry.

## Styling And Geometry

- Fill and stroke styling should remain attached to the vector node, not to temporary editing UI.
- Changing fill, stroke, stroke width, or fill rule should not reduce editability of the path.
- Object resize should scale vector stroke visually with the rest of the object by default.
- This Illustrator-style default should be treated as the baseline vector behavior for PunchPress unless a future control explicitly opts a node into a different stroke-scaling mode.
- Future controls may allow users to opt into non-scaling stroke behavior when a design calls for it.
- A vector node should support curved segments, straight segments, and mixed contours within the same node.
- Future boolean, simplify, and path cleanup operations should preserve the node as editable vector source geometry.

## Relationship To Other Features

- A vector path should be able to act as a reusable path source for other canvas behaviors.
- Future text-on-path behavior should be able to follow an arbitrary vector path without turning the text node into a vector node.
- Path-following layout features should reuse vector path geometry without conflating path placement with geometry deformation.
- Vector editing may use a specialized editing subsystem, but PunchPress remains the durable owner of the node model and writes edits back into editable vector source geometry.

## Export

- Export should produce clean vector output from the vector node without requiring the editing subsystem to become the saved document model.
- Export should preserve visible vector styling and geometry accurately enough for print-oriented workflows.
- Export may flatten temporary editing UI, guides, and handles, but it should not flatten the node's editable source inside the PunchPress document.
