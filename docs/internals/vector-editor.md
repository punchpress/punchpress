---
summary: Explains the vector editing boundary between durable engine path/vector state, compiled render surfaces, Paper-backed edit overlays, and writeback.
read_when:
  - changing vector path editing, Paper sessions, point selection, pen insertion, endpoint closing, corner radius handles, or vector render surfaces
  - debugging stale vector chrome, backend leakage, or edits that do not write back to engine state
---

# Vector Editor

Vector editing has three layers:

1. Durable path and vector nodes in the engine.
2. Compiled render surfaces for normal canvas rendering.
3. Specialized Paper-backed overlays for path editing.

## Boundary

- Engine owns selected path points and durable vector geometry.
- Paper overlay owns browser interaction details during path edit mode.
- Overlay changes write back through editor path actions.
- Normal canvas rendering does not instantiate the path-edit backend.

## Rule

Paper is allowed in path-edit overlays, boolean/compound compilation, and SVG
import normalization. It is not the saved model or ordinary render path.
