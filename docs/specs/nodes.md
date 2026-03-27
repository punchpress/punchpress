# Nodes

Nodes are the core building blocks of a PunchPress design.

## Product Expectations

- Every design element on the canvas is a node.
- Nodes have stable identity, layer order, visibility, and transform.
- Nodes can be copied and pasted without losing their editable source content, styling, or structure.
- Nodes can be selected individually and, where appropriate, moved, resized, rotated, and edited.
- Selected nodes may surface a shared node toolbar with actions that change based on the current selection and mode.
- When multiple nodes are selected, the properties panel should show only settings shared by the full selection and should represent differing values as mixed rather than guessing.
- Nodes remain editable source content inside PunchPress. They should not be prematurely baked into static output.
- Hiding a node should remove it from view without losing its content or settings.
- Nodes may be either leaf nodes or container nodes.
- Container nodes own child layers while still behaving like first-class canvas objects with clear selection, bounds, and transform behavior.

## Editable Nodes

- Editable nodes enter a dedicated editing mode without losing their node-level selection context.
- Editable nodes share a common editable frame or bounds concept.
- That frame defines where selection, editing affordances, hover states, and related canvas feedback attach to the node.
- The editable frame should feel consistent across editable node types.
- The editable frame should stay aligned with the node's visible footprint closely enough that editing never feels detached from the object.
- Selection and transform handles should remain screen-sized and visually consistent even when a node's durable data represents resize through transform scale.
- Specialized editing affordances should prefer explicit secondary modes over overloading the default selected state when that keeps selection behavior clearer.
- Vector path editing should enter through an explicit secondary mode such as double-click or an `Edit path` action rather than replacing normal object selection by default.
- While a vector node is in path edit mode, PunchPress should hide the normal node transform box so the vector anchors become the primary editing affordance.
- While path editing is active, canvas marquee selection should stay suppressed so path manipulation does not surface unrelated selection UI.
- A node should preserve its normal move, resize, and rotate behavior in the default selected state unless the user has clearly entered a more specific editing mode.
- Parametric shape nodes should resize directly from their selection bounds, with edge drags changing one dimension and corner drags changing width and height together.
- Holding `Shift` during a corner resize should preserve the current aspect ratio instead of forcing aspect-ratio lock all the time.
- Holding `Shift` during shape drag placement should lock the placement box to a 1:1 aspect ratio.

## Growth

- New node types should fit the same mental model: selectable object, clear bounds, direct manipulation, and editable source data where applicable.
- Parametric basic shapes should stay one node family with a shape-kind field rather than splintering into separate node types when their interaction model is the same.
- Vector nodes should preserve editable source geometry rather than treating SVG path strings as the only durable source of truth.
- Vector editing may use a specialized editing subsystem, but PunchPress remains the durable owner of the node model and writes edits back into editable vector source geometry rather than flattening them into one-off UI state.
- New container nodes should make their containment behavior explicit in the node contract rather than relying on ad hoc UI-only behavior.
- PunchPress should feel like one coherent canvas system even as more node types are added.
