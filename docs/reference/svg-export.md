---
summary: Defines SVG export expectations for visible editable nodes, artboard crop boundaries, vector surfaces, text outlining, and production output.
read_when:
  - changing engine export code, selected artboard export, SVG serialization, or text/vector bake behavior
  - debugging exported SVG bounds, hidden nodes, missing artboard clipping, or editable-source metadata assumptions
---

# SVG Export

SVG export produces production output from editable document state.

## Contract

- Export reads the current document, not transient hover or drag state.
- Hidden nodes are excluded.
- Selected artboard export uses the artboard bounds as crop boundary.
- Artboard background is included when set.
- Text may be converted to outlines for production reliability.
- Vector and path nodes export from current editable source and composition
  semantics.
- Export output may be baked; `.punch` remains the editable source of truth.

## Boundaries

Export should not persist renderer caches, Paper sessions, overlay chrome,
selection state, or viewport state.
