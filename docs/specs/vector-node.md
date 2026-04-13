# Vector Node

Vector nodes let users create and edit custom vector artwork directly on the canvas.

## Product Expectations

- A vector node stores editable vector source geometry, not only a flattened export artifact.
- A vector node remains a first-class canvas object with stable identity, layer behavior, visibility, styling, and transform.
- A vector node supports fill, stroke, stroke width, and fill-rule behavior as durable node properties.
- A vector node may contain one or more contours, including open paths, closed paths, and compound path-like structures.
- A vector node should stay editable after save, load, copy, paste, duplicate, transform, and export workflows.
- A vector node should represent freeform path geometry and converted live shapes whose editing no longer maps cleanly to a live shape model.
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
- Users should be able to select anchor points by click, additive selection, and marquee-style point selection.
- Dragging one selected anchor should move the full selected anchor set together.
- While path editing is active, marquee selection should target path points rather than whole nodes.
- Path-edit cursors should distinguish point selection/editing from whole-object dragging.
- Hovering or dragging a point should use point-edit cursor language such as `pointer`, not object-move cursors.
- Hovering an anchor or bezier handle should communicate point editing, not object movement.
- Dragging the vector body should continue to use object-drag cursor language such as `grab` and `grabbing`.
- Open and closed contours should both be editable through the same interaction model.
- Open contours should remain visually open on canvas and export rather than being filled across an implied closing edge.
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
- `Alt/Option`-dragging an anchor in path edit mode should convert that anchor to a smooth point and pull out mirrored direction handles from the anchor in the same gesture.
- Temporary modifier-based bezier editing should apply to handle drags without introducing separate anchor click or anchor drag gestures that conflict with standard node manipulation.
- `Shift` should constrain handle angle when precise alignment is intended, such as snapping to common editing angles.
- While the Pen tool exists, temporary modifier access to point editing should feel consistent with Illustrator-style pen workflows rather than forcing constant tool switching.

## Path Operations

- Path editing should support adding points on existing segments.
- Hovering an insertable segment should communicate point insertion distinctly from point dragging or whole-object dragging.
- Hovering an insertable segment should use pen-style insertion cursor language rather than a generic crosshair when PunchPress exposes a pen cursor asset.
- Hovering an insertable segment with the Pen tool should treat the full visible segment as insertable rather than limiting insertion to a special midpoint hotspot.
- When the Pen tool exposes add-point intent on a segment, PunchPress should show a ghost anchor at the exact insertion location before the click.
- Clicking an insertable segment should add a point at that location and select it immediately.
- Press-dragging from an insertable segment with the Pen tool should insert the point first and then author its handles in the same gesture.
- Path editing should support deleting selected points without destroying the whole path.
- While path editing is active and one anchor is selected, `Delete` or `Backspace` should delete that anchor before falling back to whole-object deletion behavior.
- Path editing should support cutting or splitting a path at a selected point or segment.
- Path editing should support joining compatible open endpoints.
- Dragging an open endpoint onto the opposite endpoint of the same contour in path edit mode should snap and close the contour.
- Path editing should support closing an open path through explicit intent with clear feedback when the user is targeting the starting anchor.
- Path editing should support reopening or breaking a closed contour at a chosen point later.
- Joining endpoints should preserve the path as editable vector source geometry and should follow Illustrator-style expectations for corner joins by default.

## Pen Workflow

- Path editing should eventually support creating new paths with a pen-style workflow rather than only editing existing paths.
- Clicking should place straight points.
- While the Pen tool is active, the canvas placement cursor should use pen-style cursor language rather than a generic crosshair.
- Click-dragging should place a point and immediately author its direction handles.
- Tiny unintended screen-space jitter, especially at higher zoom, should still place a straight point until the authored handle reaches a meaningful canvas-space length.
- Continuing from a smooth point should preserve expected tangent behavior.
- Pen hover affordances should be action-specific and should only appear when the click result is deterministic for the current target.
- The same hover treatment should not ambiguously stand for close-path, continue-path, delete-point, and add-point outcomes.
- When the Pen tool resolves a hover target to a concrete action such as `Close path`, `Continue path`, `Delete point`, or `Add point`, PunchPress should surface that action immediately near the target rather than leaving the click result implicit.
- While the Pen tool hovers a non-endpoint anchor on an editable path, it may expose delete-anchor behavior, but open endpoints should continue to prioritize continue-path and close-path intent.
- While the Pen tool hovers an insertable segment on an editable path, it should expose add-anchor behavior without forcing a switch back to the pointer tool.
- Closing a contour with the Pen tool should keep the vector in path edit mode with the closing anchor selected rather than dropping the user back to plain object selection.
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

## Relationship To Shape Nodes

- Shape nodes and vector nodes should feel like part of one coherent vector editing system even though they are distinct node families.
- A shape should convert into a vector node when the user performs topology-changing edits or other operations that no longer fit that shape node's current live shape family.
- A converted shape should preserve its visible geometry and styling as it becomes a vector node.
- Vector nodes should not promise shape-specific controls such as corner radius once the object no longer has a clear live shape meaning.
- Vector nodes should support corner-rounding controls on eligible corner anchors, but that is a vector-corner feature rather than a polygon-shape-wide live control.
- Vector corner-rounding should behave as live bezier geometry that remains editable when the path contains the canonical rounded-corner trim-point pattern, whether authored in PunchPress or imported.
- A sharp vector corner should round by materializing that same canonical trim-point pattern rather than by storing separate corner-radius metadata on the path.
- The trim points created by vector corner-rounding should remain corner points with independent handles, so users can still collapse them back to a sharp corner with the `Corner` action.
- Point conversion controls such as `Corner` and `Smooth` should read as conversion actions, not as persistent mutually-exclusive mode toggles.
- Open-path endpoints should remain ineligible for vector corner rounding until the contour is explicitly closed.
- While path editing a vector with no anchor selected, PunchPress should show on-canvas corner-radius handles for all eligible live corners.
- While the Pen tool is the active cursor mode, PunchPress should suppress vector corner-radius handles and favor point-authoring affordances instead.
- Once one or more anchors are selected, PunchPress should show on-canvas corner-radius handles only for the selected logical corners.
- While the user is actively dragging a corner-radius handle, PunchPress should keep only the dragged corner handle visible until the drag ends.
- Dragging a corner-radius handle with no anchor selection should adjust all eligible live corners together.
- Dragging a corner-radius handle with anchor selection should adjust only the selected logical corners.
- During an active corner-radius drag, the applied rounding should track the pointer direction monotonically rather than rebasing against the already-mutated path on each move.
- While path editing a vector with no anchor selected, the properties panel should expose one bulk corner-radius control for all eligible corners.
- If eligible vector corners do not all share the same radius, that bulk control should show a mixed state until the user applies a new value.
- Corner-radius edits should clamp to the largest stable editable radius for the affected closed shape rather than pushing the path into an uneditable corner state.
- While the user is actively dragging a corner-radius handle, corners that have reached the current drag limit may show a subdued red warning highlight on the rounded segment.
- If the dragged corner reaches its own local limit before the broader drag scope is exhausted, that dragged corner should still show the red warning highlight.
- When that warning is active, the dragged corner-radius handle should share the same red warning treatment so the limit state is obvious at the point of interaction.

## Styling And Geometry

- Fill and stroke styling should remain attached to the vector node, not to temporary editing UI.
- Changing fill, stroke, stroke width, or fill rule should not reduce editability of the path.
- A vector node should eventually support stroke alignment controls such as `Inner`, `Center`, and `Outer` where that behavior is meaningful.
- `Center` stroke alignment should remain the baseline default unless the user explicitly chooses a different alignment mode later.
- `Inner` and `Outer` stroke alignment should feel consistent with Illustrator-style expectations for closed vector shapes.
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
