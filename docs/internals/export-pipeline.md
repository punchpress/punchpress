---
summary: Explains engine export ownership for document export, selected artboard export, SVG node serialization, visible-node filtering, and production baking.
read_when:
  - changing `packages/engine/src/document/export.ts`, node SVG export, selected artboard export, or text/vector bake behavior
  - debugging exported bounds, hidden content, artboard crop, background, or SVG serialization
---

# Export Pipeline

Export converts editable document state into production output.

## Ownership

- Engine document actions expose export commands.
- Node export helpers serialize node output.
- Artboard export crops to selected artboard bounds.
- Platform adapters save the exported bytes.

## Rules

- Export reads durable document state, not transient editor state.
- Hidden content is excluded.
- Export may bake text and vector output.
- `.punch` remains the editable source of truth.
