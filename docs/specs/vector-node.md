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

## Direct Manipulation

- Users should be able to move existing anchor points directly on the canvas.
- Users should be able to adjust bezier handles directly on the canvas.
- Open and closed contours should both be editable through the same interaction model.
- Path editing should eventually support adding points, removing points, splitting segments, and joining compatible path ends.
- Path editing should eventually support creating new paths with a pen-style workflow rather than only editing existing paths.
- Closing a path should be a deliberate action with clear feedback when the user is targeting the starting anchor.

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
