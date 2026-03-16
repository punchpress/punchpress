# Nodes

Nodes are the core building blocks of a PunchPress design.

## Product Expectations

- Every design element on the canvas is a node.
- Nodes have stable identity, layer order, visibility, and transform.
- Nodes can be selected individually and, where appropriate, moved, resized, rotated, and edited.
- Nodes remain editable source content inside PunchPress. They should not be prematurely baked into static output.
- Hiding a node should remove it from view without losing its content or settings.

## Editable Nodes

- Editable nodes enter a dedicated editing mode without losing their node-level selection context.
- Editable nodes share a common editable frame or bounds concept.
- That frame defines where selection, editing affordances, hover states, and related canvas feedback attach to the node.
- The editable frame should feel consistent across editable node types.
- The editable frame should stay aligned with the node's visible footprint closely enough that editing never feels detached from the object.

## Growth

- New node types should fit the same mental model: selectable object, clear bounds, direct manipulation, and editable source data where applicable.
- PunchPress should feel like one coherent canvas system even as more node types are added.
