---
summary: Defines vector nodes as editable multi-path containers with child path ordering, composition, styling aggregation, layer rows, and export behavior.
read_when:
  - changing vector container behavior, child path ordering, path composition, layer rows, aggregate appearance, or vector export
  - deciding whether imported or authored artwork needs a vector node instead of standalone paths or groups
  - debugging vector selection frames, child path focus, compound fill, or aggregate properties
---

# Vector Nodes

Vector nodes group child path nodes that need one object identity.

## Contract

- A vector node is a first-class canvas object with identity, visibility,
  transform, layer behavior, and object-level selection.
- A vector contains one or more child paths.
- Child path order is durable and controls composition.
- A vector may render children independently or as a compound filled result.
- Vector nodes preserve editable source geometry rather than only flattened SVG
  output.

## Layers And Properties

- A vector appears as one parent layer row with child path rows nested beneath.
- During path editing, the focused child path row becomes active.
- Selecting a vector exposes object-level controls and aggregate appearance.
- Selection colors list distinct child fill and stroke colors.
- Path-specific geometry and appearance stay on direct child path selection.

## Export

- Vector export uses the current editable source and composition semantics.
- Export output may be flattened for production, but the PunchPress document
  keeps editable vector source.
