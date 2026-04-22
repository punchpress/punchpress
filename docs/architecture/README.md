# Architecture Docs

- [Codebase Structure](./codebase-structure.md) — Current code layout, layer boundaries, and editor ownership
- [Editor Operating Model](./editor-operating-model.md) — Editor land, React land, and automation as clients of the same editor
- [Vector Path Editing Operating Model](./vector-editing-operating-model.md) — Engine ownership, vector path backend boundaries, shape/vector editing policy, and SVG import direction
- [Canvas Overlay Visual System Plan](./canvas-overlay-visual-system-plan.md) — Problem statement, tldraw comparison, desired output structure, and cleanup plan for overlay visuals
- [Editor Extraction Plan](./editor-extraction-plan.md) — Remaining migration work after extracting the engine and schema packages
- [Document Model](./document-model.md) — Persistent document schema, node invariants, and export boundaries
- [0005: Node Render Contract](./decisions/0005-node-render-contract.md) — Durable node capabilities, frame surfaces, and selection preview ownership
- [0006: Interaction Render Hot Path](./decisions/0006-interaction-render-hot-path.md) — Principles for keeping active transforms cheap and zoom-safe
- [0007: Vector Render Surface Pipeline](./decisions/0007-vector-render-surface-pipeline.md) — Durable vector nodes, compiled SVG render surfaces, and edit-overlay boundaries
- [Decisions](./decisions/README.md) — Durable architecture decisions
