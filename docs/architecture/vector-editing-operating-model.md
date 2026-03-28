# Vector Editing Operating Model

This document describes how PunchPress should split responsibility between the
durable editor model and the vector editing subsystem.

## Core Rule

PunchPress owns the vector document model.

The vector editing subsystem may help render, hit-test, and manipulate that
model, but it does not become the saved document format or the durable source
of truth.

Today that specialized subsystem is the Paper-backed vector overlay in the web
app.

## Ownership Split

### Engine Owns

- canonical vector geometry stored in the document schema
- path editing mode and selected point state
- commands such as point conversion, point movement, insertion, deletion, and
  future path operations
- history boundaries and undo/redo meaning
- structured inspection used by tests, automation, and future CLI workflows

### Paper Overlay Owns

- path-edit rendering such as anchors, handles, and guide lines
- pointer-level hit testing for path edit affordances
- transient interaction plumbing during an active edit gesture
- geometric assistance that is immediately translated back into engine-owned
  vector data

### React Owns

- mounting and tearing down the overlay
- browser event capture and canvas lifecycle
- forwarding overlay edits into editor commands

## Data Flow

The intended flow is:

1. The engine exposes the currently edited vector node and path editing state.
2. React mounts the Paper-backed overlay for that node.
3. Paper renders editing chrome from engine-owned contours and current point
   selection.
4. Pointer interactions happen inside the overlay.
5. The resulting geometry updates are written back into the engine and schema
   model immediately.
6. React and Paper re-render from that updated engine state.

This keeps the editor model durable while still allowing a specialized vector
interaction layer.

## Why Selected Point State Lives In The Engine

Selected point state is not only a rendering concern.

It affects:

- toolbar state and point-specific actions
- keyboard behavior
- undo/redo semantics
- mode transitions such as deselect, reselect, and re-entering path edit mode
- tests and automation that need to inspect current editor state

For that reason, Paper should reflect point selection, not own it.

## SVG Import Direction

SVG import should normalize external geometry into PunchPress vector contours,
segments, handles, and point types.

That means imported Illustrator-style paths become ordinary PunchPress vector
nodes that the existing editor can modify.

The importer may use Paper or another parser as an intermediate helper, but the
result should be engine-owned vector data rather than persisted Paper objects or
raw imported runtime state.

## Practical Rules

When adding vector features:

- put durable path semantics in the engine first
- keep Paper focused on rendering, hit testing, and edit-session mechanics
- write edits back into engine-owned geometry immediately
- avoid Paper-local state for durable editor concepts
- treat SVG import as a conversion into PunchPress vector data, not as a mode
  that keeps external runtime objects alive
