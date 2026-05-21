---
summary: Defines layers panel behavior for document tree display, selection sync, ordering, visibility, groups, vectors, and compounds.
read_when:
  - changing layer rows, drag reorder, layer selection, visibility toggles, group rows, vector child rows, or compound layer actions
  - debugging a mismatch between canvas selection and the layers panel
  - deciding whether an action belongs in the layer row, layer menu, context menu, or editor command surface
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

## Containers

- Groups appear as expandable layer rows.
- Vector nodes appear as parent rows with child path rows.
- During vector path editing, focused child path rows can become the active
  selection target.
- Compound path rows expose compound operations where the node is eligible.
