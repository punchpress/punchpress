---
summary: Explains per-node engine modules for artboard, group, text, shape, path, and vector behavior.
read_when:
  - changing node-specific geometry, placement, property support, hit testing, or editing behavior
  - deciding which node folder should own a behavior
---

# Node Engines

Node-specific behavior lives under `packages/engine/src/nodes/<type>/`.

| Node | Owns |
| --- | --- |
| Artboard | rectangular production surface, placement, hit testing, property support. |
| Group | container bounds, placement, property support. |
| Text | metrics, layout, warps, hit regions, placement, font-dependent geometry. |
| Shape | live shape model, corner controls, shape geometry, placement. |
| Path | contour geometry, render surfaces, path capabilities. |
| Vector | child path composition, vector editing, render surfaces, property support. |

Shared behavior belongs in node capability helpers or primitives, not duplicated
inside React components.
