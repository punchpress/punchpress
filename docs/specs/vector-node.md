# Vector And Path Nodes

Path and vector nodes let users create and edit custom vector artwork directly
on the canvas.

## Product Expectations

- A standalone path node is the primary editable curve object users draw and manipulate.
- A standalone path node remains a first-class canvas object with stable identity, layer behavior, visibility, and transform.
- A vector node stores editable vector source geometry through its child paths,
  not only a flattened export artifact.
- A vector node remains a first-class canvas object with stable identity, layer behavior, visibility, and transform.
- Fill and stroke colors may carry alpha directly in the stored color value, and that alpha should remain editable through the normal color picker workflow.
- A vector node is a container for one or more child path nodes when those paths need to act as one object, such as compound paths or imported grouped vector artwork.
- A child path node represents one editable path or contour.
- PunchPress should not create a vector container around a newly drawn path unless that path needs to behave as part of a multi-path object.
- A standalone path should appear as one ordinary layer row.
- A vector node should appear as one parent layer entry in the layers panel with its child path rows nested underneath it.
- Path and vector nodes should stay editable after save, load, copy, paste, duplicate, transform, and export workflows.
- Path and vector nodes should represent freeform path geometry and converted live shapes whose editing no longer maps cleanly to a live shape model.
- By default, vector object behavior should follow familiar Adobe Illustrator-style conventions unless PunchPress intentionally chooses to diverge for a clear product reason.

## Selection And Transform

- In the default selected state, a vector node should behave like any other node for move, resize, rotate, layer, and property workflows.
- In the default selected state, a standalone path node should behave like any other node for move, resize, rotate, layer, and property workflows.
- The editable frame for a vector node should stay visually aligned with the node's visible footprint.
- Selection and transform handles should remain screen-sized and visually consistent even when the node's durable data represents resize through transform scale.
- A vector node should not require path-edit mode for normal object transforms.
- Resizing or rotating a vector node in the default selected state should preserve editability of the underlying vector source.
- Resizing or rotating a multi-path vector should preserve the relative arrangement of its child paths instead of changing the compound relationship.
- Selecting a vector node should show one object-level selection frame for the whole vector object rather than separate frames for each child path.
- The object-level selection frame for a vector should stay aligned with the visible object before, during, and after transforms.

## Path Editing

- Path editing is a distinct secondary mode for editable path artwork.
- Vector path editing should enter through explicit intent, such as double-clicking the node or using an `Edit path` affordance.
- Entering path editing on a standalone path should keep that path as both the contour-edit owner and the visual owner.
- Entering path editing on a vector container should select the focused child path contour rather than leaving the parent vector row as the active selection.
- Vector path editing should remain durable while the user switches focus between child path contours.
- While vector path editing is active, one child path should be the focused contour for direct point editing at a time.
- While path editing one child contour inside a multi-contour vector, the focused child path should remain the contour-edit owner while the parent vector remains the visual owner for rendered artwork, hover suppression, and object-level overlay placement.
- Clicking another child path in the same vector while path editing is active should switch contour focus and active selection without requiring the user to exit and re-enter path editing.
- Clicking another editable vector while path editing is active should switch directly into path editing for that vector and select its focused contour rather than forcing a plain-selection intermediate step.
- Clicking empty canvas while vector path editing is active should first exit path editing while keeping the vector selected; the next empty-canvas click may clear object selection.
- While path editing is active, the normal object transform box should be replaced by path-editing affordances.
- While path editing is active, canvas marquee selection should stay suppressed so path manipulation does not surface unrelated selection UI.
- While path editing is active, users should still be able to move the vector object itself by dragging the vector body when they are not targeting an anchor or handle.
- While path editing is active, normal canvas navigation such as space-drag panning and trackpad scrolling should remain available.
- While temporary `Space`-pan is active during vector or pen editing, pen-specific hover and preview affordances should disappear until panning ends and the hand-pan cursor should take precedence.
- Path editing should expose anchors, bezier handles, and contour structure clearly enough that direct manipulation feels precise.
- Path-editing affordances should follow PunchPress's visual language rather than looking like a foreign embedded tool.
- While path editing is active, node hover feedback should use a blue contour-outline preview instead of the default gray object-bounds hover box.
- Anchor and handle controls should remain visually stable and screen-sized while the user edits the path.
- Entering path edit mode should add edit chrome without changing the visible fill, stroke, or compound result of the artwork itself.
- Path edits on a standalone path should update that same path node rather than creating a replacement node.
- Moving a child path inside a vector during path editing should update the rendered vector live rather than waiting until the drag commits.
- Path edits should update the same vector node rather than creating a replacement node.
- Path edits should update child path nodes inside the same vector node rather than replacing the parent vector object.

## Anchor Semantics

- Anchor editing should follow familiar Adobe Illustrator conventions by default.
- The primary anchor types should be `corner` and `smooth`.
- A `corner` anchor may have zero, one, or two direction handles, and each side may be edited independently.
- A `smooth` anchor should preserve tangent continuity across the point.
- A straight point is a point whose direction handles are both collapsed, not a separate anchor type.
- A one-sided curve point is a valid state, especially at open-path ends and partially converted corners, not a separate primary mode.
- Symmetric or mirrored handle behavior may exist as a convenience, but it should not be required as a first-class baseline mode if PunchPress is following Illustrator conventions.

## Point Editing

- Users should be able to move existing anchor points directly on the canvas.
- Users should be able to adjust bezier handles directly on the canvas.
- Users should be able to select one or multiple anchor points within path edit mode.
- Point selection should stay scoped to the currently focused child path contour rather than spanning every contour in the parent vector by default.
- Users should be able to select anchor points by click, additive selection, and marquee-style point selection.
- Dragging one selected anchor should move the full selected anchor set together.
- While path editing is active, marquee selection should target path points rather than whole nodes.
- Path-edit cursor behavior should feel coherent and stable during vector editing.
- PunchPress may use the shared general-purpose canvas cursor for both point editing and vector-body dragging during path edit mode.
- Point editing intent should remain clear through anchors, handles, hover halos, selection chrome, and related affordances even when the cursor itself does not change between point and body interactions.
- Open and closed contours should both be editable through the same interaction model.
- Open contours should remain visually open on canvas and export rather than being filled across an implied closing edge.
- Selecting a single anchor should expose point-specific actions without leaving path edit mode.
- Selecting multiple anchors should expose only actions that make sense for multi-point edits.

## Point Controls

- When one or more anchor points are selected, PunchPress should provide direct anchor conversion controls consistent with Illustrator-style editing.
- The baseline point controls should be `Corner` and `Smooth`.
- `Corner` should collapse the current point's handles immediately, producing a sharp corner that may gain independent handles through direct manipulation.
- `Smooth` should preserve continuous curvature through the anchor.
- `Delete point` should remove the selected anchor while preserving the remaining path when possible.
- A logical rounded-corner selection is not the same thing as an anchor conversion selection; it should stay focused on corner-radius editing rather than exposing anchor actions.
- A dedicated action to collapse both handles is not part of the baseline editor; one-sided or zero-handle states should primarily come from direct manipulation rather than dedicated mode buttons.
- While one or more anchors or logical corners are selected inside path edit mode, PunchPress should expose a separate deselect affordance rather than forcing users to leave edit mode just to clear that inner selection.

## Modifier Gestures

- While the Pen tool is active during editable path work, holding `Cmd` on macOS should temporarily hand interaction over to direct point editing without switching the active tool away from Pen.
- While the Pen tool is active during editable path work, `Alt/Option`-clicking an anchor should toggle that anchor between `corner` and `smooth` without forcing a separate convert-point mode.
- `Alt/Option`-dragging a direction handle should adjust only that side of the point instead of preserving smooth coupling.
- `Alt/Option`-dragging an anchor in path edit mode should convert that anchor to a smooth point and pull out mirrored direction handles from the anchor in the same gesture.
- Temporary modifier-based bezier editing should apply to handle drags without introducing separate anchor click or anchor drag gestures that conflict with standard node manipulation.
- `Shift` should constrain handle angle when precise alignment is intended, such as snapping to common editing angles.
- While the Pen tool exists, temporary modifier access to point editing should feel consistent with Illustrator-style pen workflows rather than forcing constant tool switching.

## Path Operations

- Path editing should support adding points on existing segments.
- PunchPress should expose object-level `Make Compound Path` and `Release Compound Path` commands for eligible vector path selections so non-destructive boolean compounds can be authored without destructively rewriting geometry.
- `Make Compound Path` should default the compound container to `Unite`.
- `Make Compound Path` should create a vector container around eligible standalone paths unless those paths already share an eligible vector parent.
- Hovering an insertable segment should communicate point insertion distinctly from point dragging or whole-object dragging.
- Hovering an insertable segment should use pen-style insertion cursor language rather than a generic crosshair when PunchPress exposes a pen cursor asset.
- Hovering an insertable segment with the Pen tool should treat the full visible segment as insertable rather than limiting insertion to a special midpoint hotspot.
- When the Pen tool exposes add-point intent on a segment, PunchPress should show a ghost anchor at the exact insertion location before the click.
- Clicking an insertable segment should add a point at that location and select it immediately.
- Press-dragging from an insertable segment with the Pen tool should insert the point first and then author its handles in the same gesture.
- Path editing should support deleting selected points without destroying the whole path.
- While path editing is active and one anchor is selected, `Delete` or `Backspace` should delete that anchor before falling back to whole-object deletion behavior.
- Path editing should support cutting or splitting a path at a selected point.
- Path editing should support joining compatible open endpoints.
- Dragging an open endpoint onto the opposite endpoint of the same contour in path edit mode should snap and close the contour.
- Dragging an open endpoint onto a compatible endpoint on another open contour should snap the dragged endpoint to that target without auto-joining the contours.
- Releasing after that cross-contour snap should leave those two endpoints selected so the explicit join action is immediately available.
- Path editing should support closing an open path through explicit intent with clear feedback when the user is targeting the starting anchor.
- Path editing should support reopening or breaking a closed contour at a chosen existing point.
- Joining endpoints should preserve the path as editable vector source geometry and should follow Illustrator-style expectations for corner joins by default.
- Joining explicitly after a snapped endpoint alignment should collapse coincident endpoints into one anchor instead of leaving a zero-length edge.

## Pen Workflow

- Path editing should support creating new paths with a pen-style workflow rather than only editing existing paths.
- Clicking should place straight points.
- While the Pen tool is active, the canvas placement cursor should use pen-style cursor language rather than a generic crosshair.
- Click-dragging should place a point and immediately author its direction handles.
- While the user is dragging to author a Pen point, holding `Space` should temporarily reposition that pending anchor without discarding the handles already being authored.
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
- While the user remains in path editing for a vector container, starting a new disconnected Pen path should create a new child path inside that same vector node.
- When the user is not actively editing a vector container, starting a new disconnected Pen path should create a new standalone path node.

## Complete Editor

- A complete point and bezier editor for PunchPress should include point selection, handle editing, point conversion, point insertion, point deletion, path splitting, path joining, and path closing.
- A complete editor should make it easy to distinguish object transforms from point-level path edits.
- A complete editor should support keyboard nudging of selected anchor points.
- A complete editor should support multi-point edits where the requested action has a clear shared meaning.
- A complete editor should preserve visual and behavioral consistency across direct selection, pen editing, and any path-following text workflows that reuse vector geometry.

## Relationship To Shape Nodes

- Shape nodes and vector nodes should feel like part of one coherent vector editing system even though they are distinct node families.
- A shape should convert into freeform path artwork when the user performs topology-changing edits or other operations that no longer fit that shape node's current live shape family.
- A shape should not convert into freeform path artwork for shared polygon corner-radius edits that still fit the live polygon model.
- A converted shape should preserve its visible geometry and styling as it becomes path artwork.
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
- Clicking an on-canvas vector corner-radius handle without dragging should select that logical corner and keep path editing active.
- When a logical vector corner is selected through its corner-radius handle, PunchPress should indicate that selection through the corner-radius handle itself rather than surfacing ordinary trim-point bezier-handle chrome.
- When a detected live rounded corner is selected through its corner-radius handle, PunchPress should immediately suppress anchor actions such as `Delete point`, `Corner`, `Smooth`, and `Split path`, leaving radius editing to the corner handle and properties panel.
- While path editing with one or more selected anchors or logical corners, `Esc` should clear that inner selection before a subsequent `Esc` exits path edit mode.
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

- Fill and stroke styling should remain attached to editable path content, not to temporary editing UI.
- A standalone path should render as one painted path object.
- Child path nodes should support the durable styling needed for editable SVG path artwork: fill color, stroke color, stroke width, fill-rule, stroke line cap, stroke line join, and miter limit.
- Child path order inside a vector is durable and should determine how overlapping path artwork composes.
- A vector may contain child paths that render as independent painted paths or as one compound filled result, depending on the vector's stored path composition semantics.
- A non-destructive boolean compound should store one boolean operation on the parent compound container rather than separate boolean op modes on each child path.
- A boolean-add compound should render one shared filled/stroked result rather than leaving overlapping child strokes visible through each other.
- When child paths participate in one compound filled result, holes and cutouts should render correctly according to the stored fill rule and contour arrangement instead of filling each child path independently.
- A path's `fillRule` should control that path's own winding-based fill behavior and should not by itself turn a multi-path compound into a boolean `Add` result.
- Changing fill color, stroke color, stroke width, fill rule, stroke line cap, stroke line join, or miter limit should not reduce editability of the path.
- PunchPress vector nodes use center-aligned strokes as the baseline stroke model for editable vector artwork.
- Newly created vector paths should default to a `3px` stroke width until the user changes it.
- Object resize should scale vector stroke visually with the rest of the object by default.
- This Illustrator-style default should be treated as the baseline vector behavior for PunchPress.
- A vector node should support curved segments, straight segments, and mixed child paths within the same node.

## Properties Panel

- Selecting a vector node should show object-level controls for the vector as a whole and aggregate appearance controls for its child paths.
- When a selected vector contains multiple child path colors, the properties panel should show a `Selection colors` section listing the distinct colors currently in use by those child paths.
- Editing one `Selection colors` swatch should update every selected child path fill or stroke paint that currently uses that exact color value.
- `Selection colors` should be color-based rather than fill-versus-stroke based, so the same color should appear only once even if it is currently used by both fills and strokes.
- Path-specific geometry and path-specific appearance controls should remain on direct child path selection rather than moving onto the parent vector node.

## Layers Panel

- A standalone path should appear as an ordinary single layer row.
- A vector container should appear as one parent layer row with its child path rows nested underneath it.
- While vector path editing is active, the focused child path row should be the selected layer row instead of the parent vector row.
- Clicking a child path row under a vector during path editing should switch active contour selection directly to that child path.

## Relationship To Other Features

- Vector editing may use a specialized editing subsystem, but PunchPress remains the durable owner of the node model and writes edits back into editable vector source geometry.

## SVG Import

- SVG import should insert editable path and vector nodes into the current PunchPress document rather than opening raw `.svg` files as if they were native document files.
- SVG import should target editable path artwork rather than treating raw SVG path strings as the durable model.
- Import should normalize supported SVG geometry such as `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, and compound paths into PunchPress path nodes and vector containers with editable child path nodes, segments, handles, and point types.
- Import should create standalone path nodes for independent imported path objects and vector containers only when multiple paths need to stay grouped or compounded together.
- Import should map one logical compound-filled SVG object into one PunchPress vector with the child paths needed to preserve that object's compound fill behavior.
- Import should preserve visible geometry, object transforms, path openness or closedness, and path grouping closely enough that an imported Illustrator-style path object still looks and edits like the same artwork.
- Import should preserve representable path styling on editable child path nodes, including `fill`, `stroke`, `stroke-width`, `fill-rule`, `stroke-linecap`, `stroke-linejoin`, and `stroke-miterlimit`.
- When imported SVG path artwork uses `fill-opacity` or `stroke-opacity`, PunchPress should preserve that transparency through alpha-capable stored fill or stroke colors rather than dropping the visual result.
- Import should preserve `fill="none"` and `stroke="none"` explicitly rather than synthesizing fallback paint.
- Import should preserve compound-path semantics through the combination of multiple child paths and the imported fill rule so holes and overlaps still render correctly in the editor and on export.
- Open imported paths should remain open and should not be filled across an implied closing edge.
- Imported vector objects should remain editable through the ordinary vector path editing workflow without requiring a destructive expand or flatten step first.
- The baseline editable SVG import target for vector nodes is solid-color path artwork. Features such as gradients, patterns, masks, filters, markers, blend modes, raster images, and SVG text are outside this vector-node contract unless PunchPress defines a separate import behavior for them.

## Export

- Export should produce clean vector output from the vector node without requiring the editing subsystem to become the saved document model.
- Export should preserve visible vector styling and geometry accurately enough for print-oriented workflows.
- Export may flatten temporary editing UI, guides, and handles, but it should not flatten the node's editable source inside the PunchPress document.
