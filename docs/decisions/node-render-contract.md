---
summary: Records the engine-owned node render contract for geometry, frames, hit testing, selection, transient previews, and scalable node extension.
read_when:
  - adding or changing a node type
  - changing render geometry, selection frames, hit bounds, export geometry, or transform previews
  - debugging large-selection drag cost or a mismatch between rendered artwork and selection chrome
---

# Node Render Contract

Status: Accepted
Date: 2026-03-24

## Context

Canvas nodes need two responsibilities kept separate:

- durable node capabilities such as geometry, bounds, transforms, and export
- transient interaction previews such as selection drag movement

When those blur, each node type recreates canvas behavior ad hoc and hot
interactions become expensive.

## Decision

The engine owns a strict node render contract. React renders the contract; it
does not define it.

Every node type provides durable capability surfaces for:

- render geometry
- render frame
- selection frame
- hit geometry or hit bounds
- edit affordance geometry when needed
- export output when applicable

Transient interaction preview stays separate from document-derived geometry.

## Interaction Model

Selection drag follows this model:

1. The document stays unchanged during the drag.
2. The engine stores one transient selection preview transform.
3. Selected nodes render through normal geometry and base frames.
4. The canvas applies the shared preview transform to the selected visual layer.
5. The engine commits final node transforms once when the drag ends.

## Consequences

- New node types plug into one capability model.
- Render, selection, hover, hit testing, transform, and export can agree.
- Large selection drag can stay cheap because preview motion is not a document
  rewrite per frame.
- DOM measurement is an escape hatch for browser-only editing affordances, not a
  source of truth for normal bounds.
- New special cases should extend node capabilities before bypassing the shared
  canvas model.
