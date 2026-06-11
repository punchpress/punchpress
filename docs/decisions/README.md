---
summary: Routes accepted PunchPress architecture decisions and separates durable tradeoffs from obsolete plans.
read_when:
  - checking why an interaction, rendering, vector, cursor, or ownership boundary exists
  - adding a new architecture decision or retiring a superseded one
  - deciding whether an old planning note still contains a durable rule
---

# Decisions

Decision docs record durable tradeoffs and rejected alternatives. They are not
plans, task lists, or implementation diaries.

| Area | Decision |
| --- | --- |
| Canvas interaction | [Canvas cursor behavior](canvas-cursor-behavior.md) |
| Canvas interaction | [Transform interaction model](transform-interaction-model.md) |
| Canvas interaction | [Interaction ownership boundary](interaction-ownership-boundary.md) |
| Rendering | [Node render contract](node-render-contract.md) |
| Rendering | [Interaction render hot path](interaction-render-hot-path.md) |
| Vector rendering | [Vector render surface pipeline](vector-render-surface-pipeline.md) |
| Raster rendering | [Raster tile store pipeline](raster-tile-store-pipeline.md) |
| Groups and vectors | [Group rotation overlay](group-rotation-overlay.md) |
