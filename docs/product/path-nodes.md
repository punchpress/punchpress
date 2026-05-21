---
summary: Defines standalone path nodes as first-class editable curve objects with contours, fill rules, stroke styling, transforms, and layer behavior.
read_when:
  - changing standalone path creation, contours, fill rules, stroke styling, path selection, or path export
  - deciding whether a drawn or imported curve should be a path node or part of a vector container
  - debugging open paths, multi-contour paths, holes, strokes, or path layer rows
---

# Path Nodes

Path nodes are first-class editable curve objects.

## Contract

- A standalone path has identity, layer behavior, visibility, transform, styling,
  and editable contours.
- A path may contain one or more contours.
- Multi-contour paths render as one painted object.
- Open contours remain visually open on canvas and export.
- Newly created editable paths default to even-odd fill behavior.
- Center-aligned strokes are the baseline editable vector stroke model.
- New vector paths default to `3px` stroke until changed.

## Styling

Path styling includes:

- fill color
- stroke color
- stroke width
- fill rule
- stroke line cap
- stroke line join
- miter limit

Changing style does not reduce editability.

## Composition

- A path's fill rule controls its own contours.
- Fill rule does not turn separate path nodes into a boolean compound.
- When multiple paths need one combined object identity, use a vector container.
