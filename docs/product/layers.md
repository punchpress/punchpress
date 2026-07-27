---
summary: Defines layers panel behavior for document tree display, persistent active layer state, empty layer materialization, source kind, transform-selection sync, ordering, visibility, groups, vectors, and compounds.
read_when:
  - changing layer rows, empty layer materialization, source-kind display, drag reorder, layer selection, visibility toggles, group rows, vector child rows, or compound layer actions
  - debugging a mismatch between canvas selection and the layers panel
  - deciding whether an action belongs in the layer row, layer menu, context menu, materialization flow, or editor command surface
---

# Layers

The layers panel exposes the document tree as editable layer rows.

## Contract

- Rows mirror document hierarchy and layer order.
- Every non-empty document has one persistent active layer. The active row
  remains highlighted when canvas transform selection is empty.
- Selecting a row makes it active and selects the corresponding canvas node for
  transform chrome.
- Canvas selection makes its primary node active. Clearing canvas selection
  hides transform handles without clearing the active layer.
- Deleting the active layer activates the nearest surviving sibling, then its
  parent Frame. An empty document has no active layer.
- Reordering rows changes document order.
- Visibility toggles update node visibility.
- Group and vector rows can expose child rows.
- Layer menus route to editor commands; they do not mutate private panel state.
- The New Layer button and `Cmd/Ctrl+Shift+N` create an empty layer. The first
  content action materializes its source kind.

## Containers

- Groups appear as expandable layer rows.
- Vector nodes appear as parent rows with child path rows.
- During vector path editing, focused child path rows can become the active
  selection target.
- Compound path rows expose compound operations where the node is eligible.

## Source Kind

Layer rows expose node source kind through the node type.

| Node type | Source kind |
| --- | --- |
| Empty layer | Empty source content. |
| `image` | Raster image content. |
| `text` | Live text content. |
| `shape` | Live vector shape content. |
| `path` | Editable vector path content. |
| `vector` | Editable vector container content. |
| `group` | Container of mixed source content. |
| `artboard` | Production surface and container. |

Brush targets the active layer. It acts directly on a writable image node, or
materializes an active empty layer after a Stroke first intersects its writable
Frame. Frames are active insertion targets, not pixel buffers. Reparenting a
Raster from a Frame to the root snapshots the former Frame-sized writable
canvas so the detached layer stays finite without shrinking to painted content.
