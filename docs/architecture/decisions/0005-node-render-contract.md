# 0005: Node Render Contract

Status: Accepted

Date: 2026-03-24

## Context

PunchPress currently has only text nodes, but the canvas is already carrying
two responsibilities that need to stay separate as the editor grows:

- durable node capabilities such as geometry, bounds, and transforms
- transient interaction previews such as selection drag movement

When those concerns blur together, two things go wrong:

- new node types have to recreate canvas behavior ad hoc instead of fitting one
  shared model
- hot interactions become expensive because transient movement forces per-node
  recomputation or rerender work

The 500-node drag benchmark exposed that problem clearly. Node geometry and
selection bounds were mixed with live interaction preview in a way that caused
large selected sets to do much more work than needed.

## Decision

The engine owns a strict node render contract. React renders that contract, but
does not define it.

This contract is the primary node extension seam.

New node types and special node behaviors should fit into one shared
capability surface instead of teaching the canvas a new special case for each
type.

Every node type must provide these durable capabilities:

- render geometry: the plain visual payload used to draw the node when it is not
  being edited
- render frame: the world-space frame for placing that geometry on the canvas
- selection frame: the frame used for selection, hover, editing affordances, and
  transform chrome
- hit geometry: the geometry or bounds used for picking, if different from the
  selection frame

The durable rules are:

- geometry is engine-owned and must be derivable without reading the DOM
- render frame and selection frame are stable document-derived surfaces
- transient interaction preview does not rewrite node geometry or node frames on
  every tick
- large selection drag preview is represented as one shared interaction
  transform, not as 500 separate document updates
- React canvas components should render stable geometry inside a cheap frame
  wrapper
- DOM measurement is an escape hatch for browser-only editing affordances, not a
  source of truth for normal node bounds

## Interaction Model

Selection drag follows this model:

1. the document stays unchanged while the drag is active
2. the engine stores one transient selection preview transform
3. selected nodes render through their normal geometry and base frame
4. the canvas applies the shared preview transform to the selected visual layer
5. the engine commits the final node transforms once when the drag ends

This keeps the hot path focused on cheap visual movement instead of repeated
geometry or document work.

## Current Shape of the Contract

For now the editor should converge on three explicit surfaces:

- `getNodeRenderGeometry(nodeId)`
- `getNodeRenderFrame(nodeId)`
- `getNodeSelectionFrame(nodeId)`

Selection-wide preview state remains separate from those node surfaces.

As the editor grows, other node-facing geometry such as hit geometry,
indicators, clipping, or edit affordance geometry should extend this shared
capability surface rather than bypassing it.

## Rationale

- New node types can plug into one engine-owned capability model instead of
  teaching the canvas how each type works.
- Drag, selection, culling, snapping, and export can all consume the same shape
  contract.
- Stable geometry plus cheap frame updates is the only path to acceptable large
  selection performance in React and SVG.
- Treating transient preview as its own layer keeps document state, render
  state, and interaction state easier to test independently.

## Consequences

- Node implementations belong under `packages/engine/src/nodes/<type>/`.
- `packages/engine/src/nodes/node-capabilities.ts` is the main node capability
  seam, not just a helper file.
- React components should render node geometry as plain SVG output when the node
  is not in a specialized editing mode.
- Canvas modules should consume node capabilities rather than accumulating
  per-node special-case logic.
- Future optimizations such as viewport culling and large-selection indicator
  simplification should build on this contract rather than bypass it.

## Source of Truth

The current implementation lives in:

- `packages/engine/src/nodes/node-capabilities.ts`
- `packages/engine/src/queries/node-queries.ts`
- `packages/engine/src/selection/selection-bounds.ts`
- `packages/engine/src/transform/move-selection.ts`
- `apps/web/src/components/canvas/canvas-node.tsx`
- `apps/web/src/components/canvas/canvas-nodes.tsx`
