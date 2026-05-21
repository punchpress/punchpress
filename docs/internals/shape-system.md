---
summary: Explains shape internals for live polygon, ellipse, star models, placement, geometry, resize, corner controls, and conversion to path artwork.
read_when:
  - changing shape model defaults, shape engine geometry, shape placement, shape resize, corner controls, or shape-to-path conversion
  - debugging a shape that converts unexpectedly or keeps invalid live-shape controls
---

# Shape System

Shape internals preserve live shape behavior until edits no longer fit the
current shape family.

## Owners

- shape model defaults define saved shape fields
- shape engine builds render geometry
- shape placement creates ergonomic starter shapes
- shape corner controls query and mutate eligible corners
- shape convert actions create path/vector artwork when live behavior breaks

Shape editing should keep shape-specific data while it remains meaningful.
