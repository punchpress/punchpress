---
summary: Records why PunchPress resolves tool, panning, node, and overlay cursor feedback at the canvas boundary instead of per node.
read_when:
  - changing cursor precedence for tools, overlays, nodes, panning, or path editing
  - adding a cursor token or deciding whether cursor logic belongs in CSS, React, or engine geometry
  - debugging cursor feedback that changes correctly in one canvas surface but not another
---

# Canvas Cursor Behavior

Status: Accepted
Date: 2026-03-07

## Context

Canvas cursor feedback needs to reflect tool intent without pushing
tool-specific cursor props into every node.

Examples:

- text mode shows a placement cursor on empty canvas
- text mode shows an I-beam over existing text
- hand mode and space-pan show pan feedback across canvas and nodes
- transform and edit overlays can expose their own semantic affordances

## Decision

Canvas cursor state is resolved at the canvas boundary.

- Tool and panning state belong on the canvas container.
- CSS selectors derive cursor behavior from semantic container state.
- Node components do not receive tool-specific cursor props.
- Overlay affordances expose semantic cursor tokens.
- Shared CSS resolves semantic tokens to keyword cursors or SVG cursor assets.
- Engine geometry and guide data do not carry raw CSS cursor strings.

## Consequences

- Tool changes do not fan out through the node list.
- Cursor behavior remains consistent between node surfaces and overlay surfaces.
- Cursor assets are injected as shared canvas CSS variables.
- Drag-preserved cursors should become container state, not inline styles on the
  original handle.
- Future cursor behavior should add semantic state and CSS rules before adding
  per-component cursor code.
