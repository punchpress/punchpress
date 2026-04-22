# Vector Path Editing Operating Model

This document describes how PunchPress should split responsibility between the
durable vector document model, compiled render surfaces, and the interactive
path-editing backend.

## Core Rule

PunchPress owns the durable meaning of editable vector artwork.

The path-editing backend may help render, hit-test, and manipulate that
meaning, but it does not become the saved document format or the durable source
of truth.

Today the web app's backend implementation for path editing is Paper. That is
an implementation detail, not the product abstraction.

## Three Surfaces

PunchPress should keep these three surfaces distinct:

- document surface: the saved node model and editor-owned geometry semantics
- render surface: compiled SVG-ready geometry derived from the document surface
- edit surface: transient path-edit chrome, hit testing, and gesture plumbing

Those surfaces may influence one another, but they should not collapse into one
mixed system.

## Vector Document Model

The durable vector model is:

- `path` nodes are the primary authored curve objects users draw and edit
- `path` nodes may live at the root or inside a `vector` container
- `vector` nodes are container nodes used when multiple paths need to behave as
  one object, such as compound artwork or imported grouped vector content
- child `path` nodes own their own geometry and path styling
- the parent `vector` owns the composition mode for its child paths

That means:

- path geometry belongs to child paths
- path-local fill behavior belongs to the path's `fillRule`
- multi-path composition belongs to the parent vector's `pathComposition`

`fillRule` and boolean composition are separate concepts.

## What Participates In The Subsystem

The vector path editing subsystem is not limited to freeform vector artwork.

It serves:

- standalone path nodes that expose ordinary freeform path editing
- vector container nodes that own compound or grouped path artwork
- shape nodes that expose constrained path-like editing while they remain live
  shapes
- future node types that need editable path affordances without owning a
  separate editing stack

Shapes, paths, and vectors are different node families, but they should feel
like part of one coherent path editing system.

## Ownership Split

### Engine Owns

- canonical geometry and durable shape meaning stored in the document schema
- compiled render surfaces derived from that geometry
- render-frame, selection-frame, and hit-geometry queries
- path editing mode, live shape editing mode, and selected point state
- edit policies such as whether a gesture preserves a live shape or converts it
  into a path or vector
- commands such as point conversion, point movement, insertion, deletion,
  boolean ops, and compound composition changes
- history boundaries and undo/redo meaning
- structured inspection used by tests, automation, and future CLI workflows

### Path-Editing Backend Owns

- path-edit rendering such as anchors, handles, guide lines, and similar
  affordances
- pointer-level hit testing for path-edit affordances
- transient interaction plumbing during an active edit gesture
- gesture-local geometric assistance that is immediately translated back into
  engine-owned edits

### React Owns

- mounting and tearing down the backend host
- browser event capture and canvas lifecycle
- painting engine-owned render surfaces as ordinary SVG
- mounting the fixed canvas overlay stack and forwarding backend gestures into
  editor commands

## Render Model

Outside path edit mode, vector artwork should render as ordinary SVG output
derived from engine-owned nodes.

That means:

- the durable document stays as `path` and `vector` nodes
- the engine compiles those nodes into SVG-ready render geometry
- React paints that compiled result
- the compiled result is derived state, not persisted document state

Compiled render surfaces may be cached, but the cache should represent the
current compiled surface for a node, not an append-only history of every past
mutation.

Ordinary render and query paths should not instantiate Paper scopes, temporary
canvases, or DOM measurement helpers just to answer node geometry questions.

## Overlay Model

The canvas should keep one fixed overlay model rather than inventing separate
mini-architectures for special node types.

The important layers are:

- normal node rendering
- hover and indicator treatment
- transform and selection chrome
- specialized edit overlays such as path editing

Special node types should plug into that shared overlay model through node
capabilities instead of re-implementing hover, bounds, or edit surfaces ad hoc.

## Ownership Model During Path Editing

Path editing has two different owners that must stay distinct:

- the editable contour owner: the specific path node whose points and segments
  are currently being manipulated
- the visual owner: the canvas object that owns the rendered artwork, object
  hover treatment, and object-level overlay surface for that edit session

For a standalone path or live shape, those two owners are usually the same
node.

For a child path inside a vector container, they are different:

- the child path remains the editable contour owner
- the parent vector remains the visual owner

That distinction is durable product behavior, not a Paper detail.

When compound paths or multi-contour vectors are involved:

- the engine should expose which node is being directly edited
- the engine should also expose which node remains the visual owner
- React overlays, hover treatment, and preview placement should derive their
  behavior from those engine-owned ownership rules instead of re-deriving
  parent or child special cases locally
- the path-edit backend should render contour chrome from the editable session
  and should not infer object-level visual ownership on its own

## Interface Boundary

Code outside the backend should talk about vector path editing, not about
Paper.

That means app-facing and engine-facing concepts should use names such as:

- `VectorPathSession`
- `EditablePathSession`
- `CanvasVectorPathOverlay`
- `createVectorPathSession`

The implementation that happens to use Paper should keep that detail local to
backend modules rather than leaking it through product-facing abstractions.

## Paper Boundary

Paper or a similar helper may be used for:

- the dedicated path-edit overlay backend
- explicit boolean or compound compilation work
- SVG import parsing or geometry normalization

Paper should not be the normal render surface for nodes on the canvas, and it
should not become the source of truth for saved vector data.

## Data Flow

The intended flow is:

1. The engine stores path and vector nodes as the durable document model.
2. The engine compiles that model into current SVG-ready render surfaces.
3. React paints those render surfaces on the main canvas.
4. Entering path edit mode mounts the specialized edit overlay backend.
5. Pointer interactions happen inside that edit overlay.
6. The backend reports high-level gestures or geometry changes back to the
   engine.
7. The engine updates path or vector nodes, invalidates compiled render
   surfaces, and React re-renders from that updated engine state.

This keeps the document model durable while still allowing a specialized path
interaction layer.

## Why Selected Point State Lives In The Engine

Selected point state is not only a rendering concern.

It affects:

- toolbar state and point-specific actions
- keyboard behavior
- undo/redo semantics
- mode transitions such as deselect, reselect, and re-entering path edit mode
- shape-to-path or shape-to-vector conversion rules
- tests and automation that need to inspect current editor state

For that reason, the backend should reflect point selection, not own it.

## Shape And Vector Policy

The backend should not decide whether a node remains a shape, becomes a
standalone path, or becomes a vector container.

The engine owns that policy.

Examples:

- moving an existing shape anchor may preserve live shape behavior
- adjusting an existing shape handle may preserve live shape behavior
- adding a point to a shape may convert it into editable path artwork
- creating a compound from independent paths may wrap them in a vector
  container

The backend may detect and report those gestures, but the engine decides their
durable meaning.

## SVG Import Direction

SVG import should normalize supported external path geometry into PunchPress
path nodes, vector containers, segments, handles, and point types, along with
the representable path styling that belongs on editable vector artwork.

That means:

- independent imported shapes become ordinary PunchPress path nodes
- grouped or compound imported artwork becomes ordinary PunchPress vector
  containers with child paths
- imported styling preserves the path semantics PunchPress can own durably

The importer may use Paper or another parser as an intermediate helper, but the
result should be engine-owned vector data rather than persisted backend objects
or raw imported runtime state.

## Practical Rules

When adding vector path editing features:

- put durable path and vector semantics in the engine first
- keep the backend focused on rendering, hit testing, and edit-session
  mechanics
- keep gesture-specific helpers in focused sibling modules instead of growing
  the main backend session into one large mixed-responsibility surface
- render nodes outside edit mode as ordinary SVG from engine-owned compiled
  surfaces
- avoid Paper in normal render and query paths
- keep node capability surfaces centralized instead of scattering vector
  special cases across canvas modules
- treat SVG import as a conversion into PunchPress vector data, not as a mode
  that keeps external runtime objects alive
