---
summary: Explains geometry primitives, rotation math, bounds, frames, path geometry, shape resize, group resize, and pointer-distance helpers.
read_when:
  - changing geometry primitives, bounds math, hit testing, resize math, rotation math, or path geometry conversion
  - debugging mismatch between node geometry, overlay frames, and transform math
---

# Geometry Model

Geometry primitives are plain TypeScript and do not depend on React.

## Owners

- `primitives/node-geometry.ts` and `path-geometry.ts` own geometry helpers.
- `primitives/rotation.ts` owns rotated frame math.
- `primitives/shape-resize.ts` and `group-resize.ts` own resize behavior.
- `queries/node-queries.ts` exposes geometry and frame inspection through the
  editor.

## Rules

- Geometry code stays headless.
- Coordinate spaces stay explicit.
- Hit, render, selection, and transform queries derive from the same node
  capability model.
