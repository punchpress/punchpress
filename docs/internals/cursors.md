---
summary: Explains cursor ownership across engine state, tool hover state, canvas data attributes, CSS cursor assets, and overlay cursor tokens.
read_when:
  - changing canvas cursor policy, cursor SVG assets, active cursor state, panning cursor, transform cursor, or Pen hover cursor mode
  - debugging cursor precedence across nodes, overlays, tools, and active gestures
---

# Cursor System

Cursor behavior is resolved by shared canvas state and CSS.

## Owners

- Engine/tool state determines semantic intent.
- Canvas React components expose semantic state as data attributes.
- CSS resolves semantic state to cursor keywords or SVG cursor variables.
- Overlay handles expose semantic cursor tokens.

## Rule

Do not push cursor props through every node. Add semantic canvas state or overlay
tokens and resolve them through shared cursor policy.
