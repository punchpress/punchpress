# 0007: Vector Render Surface Pipeline

Status: Accepted

Date: 2026-04-21

## Context

Compound-path and vector editing work exposed a recurring architectural problem:

- the durable vector document model
- the compiled render output shown on canvas
- the transient path-edit backend

were leaking into one another.

That led to regressions where special-case vector behavior had to be fixed in
multiple places at once, and to performance problems where normal render or
query paths could accidentally instantiate backend-specific helpers.

## Decision

PunchPress will keep three explicit layers for vector artwork:

- durable document nodes
- compiled render surfaces
- specialized edit overlays

The durable model stays:

- `path` nodes own geometry and path styling
- `vector` nodes own child-path composition

Outside edit mode:

- the engine compiles vector and path nodes into SVG-ready render surfaces
- React paints that compiled output as ordinary SVG
- the compiled output is derived state, not saved document state

The engine may cache the current compiled surface for a node, but that cache is
current-state oriented, not an append-only history of past signatures.

Backend helpers such as Paper are allowed only in:

- the dedicated path-edit overlay
- explicit boolean or compound compilation work
- SVG import normalization

They are not allowed to become the ordinary render path for canvas nodes or the
source of truth for saved vector data.

## Overlay Direction

PunchPress should keep one centralized canvas overlay model.

Special node types should plug into shared node capability surfaces for:

- render geometry
- render frame
- selection frame
- hit geometry
- indicator or edit affordance geometry when needed

We should not solve special-case nodes by inventing separate mini-architectures
for hover, selection, or transform behavior.

The intended direction is one fixed overlay pipeline, with layers such as:

- normal node rendering
- hover and indicator treatment
- selection and transform chrome
- specialized edit overlays

Vector editing may have a specialized edit overlay, but that does not justify a
separate general-purpose hover, selection, or transform system for vectors.

## Consequences

- Normal node rendering should stay in plain SVG output driven by engine-owned
  render surfaces.
- Whole-object transforms should prefer shell movement and shared preview
  transforms over recompiling child geometry on every tick.
- Path edit overlays may be highly specialized, but they should remain local to
  the edit overlay boundary.
- New vector features should extend the shared node capability contract instead
  of scattering vector-specific logic across unrelated canvas modules.
