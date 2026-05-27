---
summary: Explains selection state, focused groups, selection bounds, drag sessions, move/resize/rotate operations, and preview-vs-commit boundaries.
read_when:
  - changing selection actions, focused group behavior, selection bounds, drag preview, move, resize, or rotate sessions
  - debugging undo boundaries or visual movement during active transforms
---

# Selection And Transform

Selection and transform behavior lives in engine modules and is rendered by
React overlays.

## Selection

- Selection state stores selected node ids and focused group id.
- Effective selection may differ from raw selection for container behavior.
- Selection bounds are derived from node capability frames.

## Transform

- Move, resize, rotate, and selection drag use session objects.
- Active gestures preview without rewriting the document on every tick.
- Commit applies one document change at the gesture boundary.
- React supplies pointer input and renders preview surfaces.

## Resize Model

Resize sessions keep two scopes separate:

- selected roots: the nodes the user selected and the overlay manipulates
- commit targets: the durable nodes that may need geometry updates after the
  gesture completes

A selected container, including a group, vector container, imported SVG root, or
future container node, remains one selected root during the live interaction.
The canvas applies transient resize preview to that root surface. Descendants
are only expanded when committing source geometry, or when a node capability
explicitly says its own bounds can absorb the resize directly.

Node engines own resize policy over time. Selection decides the gesture scope;
node capabilities decide whether a node resizes by bounds, scale transform,
descendant geometry, or not at all.

## Rotation Model

Rotation sessions use the same selected-root and commit-target split as resize.
A normal leaf node can rotate directly during the gesture. A selected container
or multi-selection publishes a transient rotation preview for the selected roots
and defers descendant geometry updates until commit.

Node capabilities own rotate policy. Artboards do not rotate. Groups and
non-contour vector containers rotate through their descendants at commit time,
while leaf text, path, shape, and editable vector nodes rotate themselves.
