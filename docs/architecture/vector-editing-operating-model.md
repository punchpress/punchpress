# Vector Path Editing Operating Model

This document describes how PunchPress should split responsibility between the
durable editor model and the vector path editing subsystem.

## Core Rule

PunchPress owns the durable meaning of editable vector paths.

The vector path editing subsystem may help render, hit-test, and manipulate
that meaning, but it does not become the saved document format or the durable
source of truth.

Today the web app's backend implementation for this subsystem is Paper. That is
an implementation detail, not the product abstraction.

## What Participates In The Subsystem

The vector path editing subsystem is not limited to freeform vector nodes.

It serves:

- vector nodes that expose ordinary freeform path editing
- shape nodes that expose constrained path-like editing while they remain live
  shapes
- future node types that need editable path affordances without owning a
  separate editing stack

Shapes and vectors are different node families, but they should feel like part
of one coherent path editing system.

## Ownership Split

### Engine Owns

- canonical geometry and durable shape meaning stored in the document schema
- path editing mode, live shape editing mode, and selected point state
- edit policies such as whether a gesture preserves a live shape or converts it
  into a vector node
- commands such as point conversion, point movement, insertion, deletion, and
  future path operations
- history boundaries and undo/redo meaning
- structured inspection used by tests, automation, and future CLI workflows

### Vector Path Backend Owns

- path-edit rendering such as anchors, handles, guide lines, and similar
  affordances
- pointer-level hit testing for path edit affordances
- transient interaction plumbing during an active edit gesture
- geometric assistance that is immediately translated back into engine-owned
  edits

### React Owns

- mounting and tearing down the backend host
- browser event capture and canvas lifecycle
- forwarding backend gestures into editor commands

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

## Data Flow

The intended flow is:

1. The engine exposes the currently edited node, editable contours, current
   point selection, and edit policy for that node.
2. React mounts the vector path backend for that session.
3. The backend renders editing chrome from engine-owned geometry and current
   selection state.
4. Pointer interactions happen inside the backend.
5. The backend reports high-level gestures or geometry changes back to the
   engine.
6. The engine decides whether those edits preserve a live shape, update a
   vector node directly, or convert a shape into a vector node.
7. React and the backend re-render from that updated engine state.

This keeps the editor model durable while still allowing a specialized path
interaction layer.

## Why Selected Point State Lives In The Engine

Selected point state is not only a rendering concern.

It affects:

- toolbar state and point-specific actions
- keyboard behavior
- undo/redo semantics
- mode transitions such as deselect, reselect, and re-entering path edit mode
- shape-to-vector conversion rules
- tests and automation that need to inspect current editor state

For that reason, the backend should reflect point selection, not own it.

## Shape And Vector Policy

The backend should not decide whether a node remains a shape or becomes a
vector.

The engine owns that policy.

Examples:

- moving an existing shape anchor may preserve live shape behavior
- adjusting an existing shape handle may preserve live shape behavior
- adding a point to a shape may convert it into a vector node
- deleting a point from a shape may convert it into a vector node

The backend may detect and report those gestures, but the engine decides their
durable meaning.

## SVG Import Direction

SVG import should normalize external geometry into PunchPress vector contours,
segments, handles, and point types.

That means imported Illustrator-style paths become ordinary PunchPress vector
nodes that the existing editor can modify.

The importer may use Paper or another parser as an intermediate helper, but the
result should be engine-owned vector data rather than persisted backend objects
or raw imported runtime state.

## Practical Rules

When adding vector path editing features:

- put durable path semantics and conversion rules in the engine first
- keep the backend focused on rendering, hit testing, and edit-session
  mechanics
- write edits back into engine-owned geometry immediately
- avoid backend-local state for durable editor concepts
- keep `Paper` and similar implementation details out of product-facing
  interfaces and names
- treat SVG import as a conversion into PunchPress vector data, not as a mode
  that keeps external runtime objects alive
