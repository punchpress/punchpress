---
summary: Lists canvas cursor precedence and semantic cursor ownership for tools, panning, transforms, Pen actions, Node editing, and overlays.
read_when:
  - changing cursor tokens, canvas cursor CSS, panning state, transform handles, Pen hover actions, or Node-tool targeting
  - debugging a cursor that disagrees with the active tool, selected target, or visible overlay affordance
---

# Canvas Cursors

Cursor state is semantic and resolved at the canvas boundary.

## Precedence

1. Active panning.
2. Active drag, transform, point, or handle gesture.
3. Pen concrete actions: close, continue, add point, delete point.
4. External visible path targets while path editing.
5. Transform handles and affordances.
6. Tool hover or placement state.
7. Default canvas cursor.

## Rules

- Cursor feedback pairs with visible hover, selection, handle, or guide chrome.
- Node components do not own tool-specific cursor props.
- Overlay handles expose semantic cursor tokens.
- Engine geometry does not carry raw CSS cursor strings.
