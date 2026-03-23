# Nodes

Nodes are the core building blocks of a PunchPress design.

## Product Expectations

- Every design element on the canvas is a node.
- Nodes have stable identity, layer order, visibility, and transform.
- Nodes can be copied and pasted without losing their editable source content, styling, or structure.
- Nodes can be selected individually and, where appropriate, moved, resized, rotated, and edited.
- Selected nodes may surface a shared node toolbar with actions that change based on the current selection and mode.
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
- Specialized editing affordances should prefer explicit secondary modes over overloading the default selected state when that keeps selection behavior clearer.
- A node should preserve its normal move, resize, and rotate behavior in the default selected state unless the user has clearly entered a more specific editing mode.

## Growth

- New node types should fit the same mental model: selectable object, clear bounds, direct manipulation, and editable source data where applicable.
- New container nodes should make their containment behavior explicit in the node contract rather than relying on ad hoc UI-only behavior.
- PunchPress should feel like one coherent canvas system even as more node types are added.
