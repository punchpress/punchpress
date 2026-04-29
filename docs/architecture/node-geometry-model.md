# Node Geometry Model

Node geometry is the engine-owned contract for how artwork is rendered, selected,
transformed, and hit tested. It should be the only geometry surface new canvas
behavior reaches for before adding a specialized path.

## Contract

Each node capability exposes render geometry for its current document state. That
geometry may include:

- `bbox`: the node-local bounds used for broad phase checks and transform mapping.
- `selectionBounds`: the bounds used for object selection chrome when it differs
  from the painted footprint.
- `guide`: the visible guide geometry used by overlays.
- `hitRegions`: filled or stroked contour regions that describe the painted
  surface.
- `hitTestPoint(point, options)`: a non-serializable behavior method attached to
  the geometry object for node-local hit testing.

Editor callers should prefer `editor.hitTestNodePoint(nodeId, canvasPoint,
options)` over calling geometry methods directly. The editor method handles node
lookup, render geometry lookup, and conversion from canvas space into node-local
space.

## Rules

- Node-specific capability code owns the geometry for that node type.
- Hit testing should use the same render geometry that drives overlays and
  selection, not a parallel hit-only geometry model.
- Geometry behavior belongs in the engine. React canvas code may choose the
  interaction target, but it should not reconstruct node-local geometry for
  durable editor behavior.
- Specialized hit semantics should be expressed as options on the shared
  geometry hit test instead of new surfaces like `getHitBounds` or
  `getHitGeometry`.
- Geometry behavior methods are runtime helpers only. Persistent documents and
  debug dumps should keep serializable data separate from attached behavior.

## Current Scope

Paths and imported vector child paths now provide contour-backed hit regions, so
direct vector path selection can hit transformed artwork through engine geometry.
Shapes and text are attached to the same behavior surface, but their precise hit
regions are still incremental work; callers can use bounds-based inside hits only
when that interaction explicitly wants them.

