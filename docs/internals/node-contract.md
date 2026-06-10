---
summary: Explains the engine-owned node capability contract for render geometry, frames, hit testing, property support, rasterization, edit sessions, placement, and export.
read_when:
  - adding a node type or changing shared node geometry, hit testing, property support, rasterization, or export behavior
  - deciding whether a canvas special case should become a node capability
---

# Node Contract

Node capabilities are the main extension seam for node behavior.

## Contract

Each node family owns:

- default model creation
- geometry construction
- render, selection, transform, and hit frames
- placement behavior
- property support
- source-kind classification
- rasterization into image-backed content
- edit capabilities
- export behavior where applicable

Canvas systems ask the engine for capabilities instead of branching by node type
in React.
