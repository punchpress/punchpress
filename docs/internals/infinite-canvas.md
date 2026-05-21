---
summary: Explains the infinite canvas implementation boundary across react-infinite-viewer, viewport state, canvas coordinate conversion, grid rendering, stage bounds, and pointer dispatch.
read_when:
  - changing canvas pan, zoom, viewport focus, pointer-to-canvas conversion, dot grid, or stage sizing
  - debugging viewport drift, zoom math, canvas placement, or pointer targeting after pan and zoom
---

# Infinite Canvas

The web canvas integrates `react-infinite-viewer` with engine viewport state.

## Owners

- React owns viewer refs, DOM host refs, pointer events, and canvas coordinate
  conversion.
- Engine owns viewport state, zoom helpers, pending focus, and tool dispatch.
- Canvas components render artboards, nodes, overlays, text editor, toolbar, and
  grid in the current viewport.

## Rules

- Convert client coordinates to canvas/world coordinates before engine dispatch.
- Viewport pan and zoom are session state.
- First-add focus may schedule viewport movement; ordinary later placement does
  not.
- Stage bounds are an interaction surface, not document size.
