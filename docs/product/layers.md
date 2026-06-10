---
summary: Defines layers panel behavior for document tree display, empty layer materialization, source kind, selection sync, ordering, visibility, groups, vectors, and compounds.
read_when:
  - changing layer rows, empty layer materialization, source-kind display, drag reorder, layer selection, visibility toggles, group rows, vector child rows, or compound layer actions
  - debugging a mismatch between canvas selection and the layers panel
  - deciding whether an action belongs in the layer row, layer menu, context menu, materialization flow, or editor command surface
---

# Layers

The layers panel exposes the document tree as editable layer rows.

## Contract

- Rows mirror document hierarchy and layer order.
- Selecting a row selects the corresponding canvas node.
- Canvas selection updates the highlighted row.
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

Brush acts directly on image nodes. When Brush targets an empty layer,
PunchPress materializes that layer as raster image content.
